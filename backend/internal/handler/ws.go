package handler

import (
	"context"
	"encoding/json"
	"log/slog"
	"net/http"

	"voice-canvas-backend/internal/model"
	"voice-canvas-backend/internal/service"

	"github.com/gorilla/websocket"
)

type WebSocketHandler struct {
	parserService service.ParserService
	enhancer      *service.Enhancer
	upgrader      websocket.Upgrader
}

// NewWebSocketHandler creates a new WebSocketHandler instance.
func NewWebSocketHandler(parserService service.ParserService, enhancer *service.Enhancer) *WebSocketHandler {
	return &WebSocketHandler{
		parserService: parserService,
		enhancer:      enhancer,
		upgrader: websocket.Upgrader{
			ReadBufferSize:  1024,
			WriteBufferSize: 1024,
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

	for {
		_, messageBytes, err := conn.ReadMessage()
		if err != nil {
			slog.Info("WebSocket connection closed or error read", "error", err)
			break
		}

		var clientMsg model.ClientMessage
		if err := json.Unmarshal(messageBytes, &clientMsg); err != nil {
			slog.Error("Failed to unmarshal client message", "error", err)
			h.sendError(conn, "Invalid client message payload")
			continue
		}

		slog.Info("Received message", "text", clientMsg.Text, "state_len", len(clientMsg.CanvasState))

		finalPrompt := clientMsg.Text

		if h.enhancer != nil {
			enhRes, err := h.enhancer.Enhance(ctx, clientMsg.Text, clientMsg.CanvasState, chatHistory)
			if err == nil {
				if !enhRes.IsValid {
					slog.Info("Enhancer rejected input", "feedback", enhRes.FeedbackMsg)
					h.sendFeedback(conn, enhRes.FeedbackMsg)
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

		// Process using LLM Parser or Mock Parser, streaming chunks back
		h.parserService.ParseStream(ctx, finalPrompt, clientMsg.CanvasState, func(chunk model.ServerResponse) {
			// Ensure raw text is set for the chunk
			chunk.RawText = clientMsg.Text

			responseBytes, err := json.Marshal(chunk)
			if err != nil {
				slog.Error("Failed to marshal stream chunk", "error", err)
				return
			}

			if err := conn.WriteMessage(websocket.TextMessage, responseBytes); err != nil {
				slog.Error("WebSocket write error during stream", "error", err)
			}
		})
	}
}

func (h *WebSocketHandler) sendError(conn *websocket.Conn, message string) {
	errResp := model.ServerResponse{
		Actions: []model.DrawAction{},
		RawText: "Error: " + message,
	}
	bytes, _ := json.Marshal(errResp)
	_ = conn.WriteMessage(websocket.TextMessage, bytes)
}

func (h *WebSocketHandler) sendFeedback(conn *websocket.Conn, message string) {
	resp := model.ServerResponse{
		Actions: []model.DrawAction{},
		RawText: message,
	}
	bytes, _ := json.Marshal(resp)
	_ = conn.WriteMessage(websocket.TextMessage, bytes)
}
