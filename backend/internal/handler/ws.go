package handler

import (
	"context"
	"encoding/json"
	"log/slog"
	"net/http"
	"sync"
	"time"

	"voice-canvas-backend/internal/agent"
	"voice-canvas-backend/internal/model"
	"voice-canvas-backend/internal/service"

	"github.com/gorilla/websocket"
)

type WebSocketHandler struct {
	parserService service.ParserService
	enhancer      *service.Enhancer
	agent         *agent.Agent
	upgrader      websocket.Upgrader
}

// NewWebSocketHandler creates a new WebSocketHandler instance.
func NewWebSocketHandler(parserService service.ParserService, enhancer *service.Enhancer, ag *agent.Agent) *WebSocketHandler {
	return &WebSocketHandler{
		parserService: parserService,
		enhancer:      enhancer,
		agent:         ag,
		upgrader: websocket.Upgrader{
			ReadBufferSize:  1024,
			WriteBufferSize: 4096,
			CheckOrigin: func(r *http.Request) bool {
				// Allow all origins for local development
				return true
			},
		},
	}
}

// ServeHTTP handles incoming HTTP requests and upgrades them to WebSocket connection.
func (h *WebSocketHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	conn, err := h.upgrader.Upgrade(w, r, nil)
	if err != nil {
		slog.Error("WebSocket Upgrade error", "error", err)
		return
	}
	defer conn.Close()
	slog.Info("Client connected via WebSocket")

	ctx := context.Background()
	var chatHistory []string

	// Mutex to protect concurrent writes to the WebSocket connection
	var writeMu sync.Mutex

	// Channel for receiving canvas state observations from the frontend
	observationCh := make(chan []model.CanvasElement, 1)

	for {
		_, messageBytes, err := conn.ReadMessage()
		if err != nil {
			slog.Info("WebSocket connection closed or error read", "error", err)
			break
		}

		var clientMsg model.ClientMessage
		if err := json.Unmarshal(messageBytes, &clientMsg); err != nil {
			slog.Error("Failed to unmarshal client message", "error", err)
			h.sendError(conn, &writeMu, "Invalid client message payload")
			continue
		}

		// Check if this is an observation response (canvas_state feedback for Agent)
		if clientMsg.Text == "__observation__" {
			select {
			case observationCh <- clientMsg.CanvasState:
			default:
				// Channel already has data, skip
			}
			continue
		}

		slog.Info("Received message", "text", clientMsg.Text, "state_len", len(clientMsg.CanvasState))

		finalPrompt := clientMsg.Text

		if h.enhancer != nil {
			enhRes, err := h.enhancer.Enhance(ctx, clientMsg.Text, clientMsg.CanvasState, chatHistory)
			if err == nil {
				if !enhRes.IsValid {
					slog.Info("Enhancer rejected input", "feedback", enhRes.FeedbackMsg)
					h.sendFeedback(conn, &writeMu, enhRes.FeedbackMsg, clientMsg.Text)
					continue
				}
				finalPrompt = enhRes.EnhancedPrompt
				slog.Info("Prompt enhanced", "original", clientMsg.Text, "enhanced", finalPrompt)
			} else {
				slog.Warn("Enhancer failed, falling back to raw text", "error", err)
			}
		}

		// Keep only last 3 turns
		chatHistory = append(chatHistory, clientMsg.Text)
		if len(chatHistory) > 3 {
			chatHistory = chatHistory[1:]
		}

		// Use Agent mode if available, otherwise fall back to legacy ParseStream
		if h.agent != nil {
			slog.Info("Using Agent mode")
			go func(p string, s []model.CanvasElement, text string) {
				h.agent.Run(ctx, p, s,
					// onAction: send actions to the frontend
					func(chunk model.ServerResponse) {
						chunk.RawText = text
						responseBytes, err := json.Marshal(chunk)
						if err != nil {
							slog.Error("Failed to marshal agent chunk", "error", err)
							return
						}
						writeMu.Lock()
						if err := conn.WriteMessage(websocket.TextMessage, responseBytes); err != nil {
							slog.Error("WebSocket write error during agent", "error", err)
						}
						writeMu.Unlock()
					},
					// observe: request and wait for canvas state from the frontend
					func() []model.CanvasElement {
						// Send observation request to frontend
						obsReq := model.ServerResponse{
							Actions: []model.DrawAction{},
							RawText: "__request_observation__",
						}
						reqBytes, _ := json.Marshal(obsReq)
						writeMu.Lock()
						_ = conn.WriteMessage(websocket.TextMessage, reqBytes)
						writeMu.Unlock()

						// Wait for observation with timeout
						select {
						case state := <-observationCh:
							slog.Info("Received observation", "shapes", len(state))
							return state
						case <-time.After(10 * time.Second):
							slog.Warn("Observation timeout, using empty state")
							return []model.CanvasElement{}
						}
					},
				)
			}(finalPrompt, clientMsg.CanvasState, clientMsg.Text)
		} else {
			// Legacy mode: single-pass ParseStream
			go func(p string, s []model.CanvasElement, text string) {
				h.parserService.ParseStream(ctx, p, s, func(chunk model.ServerResponse) {
					chunk.RawText = text
					responseBytes, err := json.Marshal(chunk)
					if err != nil {
						slog.Error("Failed to marshal stream chunk", "error", err)
						return
					}
					writeMu.Lock()
					if err := conn.WriteMessage(websocket.TextMessage, responseBytes); err != nil {
						slog.Error("WebSocket write error during stream", "error", err)
					}
					writeMu.Unlock()
				})
			}(finalPrompt, clientMsg.CanvasState, clientMsg.Text)
		}
	}
}

func (h *WebSocketHandler) sendError(conn *websocket.Conn, mu *sync.Mutex, message string) {
	errResp := model.ServerResponse{
		Actions: []model.DrawAction{},
		RawText: "Error: " + message,
	}
	bytes, _ := json.Marshal(errResp)
	mu.Lock()
	_ = conn.WriteMessage(websocket.TextMessage, bytes)
	mu.Unlock()
}

func (h *WebSocketHandler) sendFeedback(conn *websocket.Conn, mu *sync.Mutex, message string, rawText string) {
	resp := model.ServerResponse{
		Actions:  []model.DrawAction{},
		Feedback: message,
		RawText:  rawText,
	}
	bytes, _ := json.Marshal(resp)
	mu.Lock()
	_ = conn.WriteMessage(websocket.TextMessage, bytes)
	mu.Unlock()
}

