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
	upgrader      websocket.Upgrader
}

// NewWebSocketHandler creates a new WebSocketHandler instance.
func NewWebSocketHandler(parserService service.ParserService) *WebSocketHandler {
	return &WebSocketHandler{
		parserService: parserService,
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

		// Process using LLM Parser or Mock Parser
		responseData := h.parserService.Parse(ctx, clientMsg.Text, clientMsg.CanvasState)

		// Ensure raw text is set
		responseData.RawText = clientMsg.Text

		responseBytes, err := json.Marshal(responseData)
		if err != nil {
			slog.Error("Failed to marshal response", "error", err)
			h.sendError(conn, "Failed to encode response")
			continue
		}

		if err := conn.WriteMessage(websocket.TextMessage, responseBytes); err != nil {
			slog.Error("WebSocket write error", "error", err)
			break
		}
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
