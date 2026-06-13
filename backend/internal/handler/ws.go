package handler

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"net/http"
	"sync"
	"time"

	"voice-canvas-backend/internal/model"
	"voice-canvas-backend/internal/service"

	"github.com/gorilla/websocket"
)

type WebSocketHandler struct {
	engine   *service.Engine
	upgrader websocket.Upgrader
}

// NewWebSocketHandler creates a new WebSocketHandler instance.
func NewWebSocketHandler(engine *service.Engine) *WebSocketHandler {
	return &WebSocketHandler{
		engine: engine,
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

type ObservationResponse struct {
	State []model.CanvasElement
	Error error
}

type wsSession struct {
	conn          *websocket.Conn
	writeMu       *sync.Mutex
	observationCh chan ObservationResponse
	inputCh       chan model.ClientMessage
}

func (s *wsSession) SendServerResponse(resp model.ServerResponse, rawText string) error {
	resp.RawText = rawText
	bytes, err := json.Marshal(resp)
	if err != nil {
		return err
	}
	s.writeMu.Lock()
	defer s.writeMu.Unlock()
	return s.conn.WriteMessage(websocket.TextMessage, bytes)
}

func (s *wsSession) SendFeedback(msg string, rawText string) error {
	resp := model.ServerResponse{
		Actions:  []model.DrawAction{},
		Feedback: msg,
		RawText:  rawText,
	}
	bytes, err := json.Marshal(resp)
	if err != nil {
		return err
	}
	s.writeMu.Lock()
	defer s.writeMu.Unlock()
	return s.conn.WriteMessage(websocket.TextMessage, bytes)
}

func (s *wsSession) SendError(msg string) error {
	errResp := model.ServerResponse{
		Actions: []model.DrawAction{},
		RawText: "Error: " + msg,
	}
	bytes, err := json.Marshal(errResp)
	if err != nil {
		return err
	}
	s.writeMu.Lock()
	defer s.writeMu.Unlock()
	return s.conn.WriteMessage(websocket.TextMessage, bytes)
}

func (s *wsSession) RequestObservation(ctx context.Context) ([]model.CanvasElement, error) {
	obsReq := model.ServerResponse{
		Actions: []model.DrawAction{},
		RawText: "__request_observation__",
	}
	reqBytes, _ := json.Marshal(obsReq)
	
	s.writeMu.Lock()
	err := s.conn.WriteMessage(websocket.TextMessage, reqBytes)
	s.writeMu.Unlock()
	
	if err != nil {
		return nil, err
	}

	select {
	case resp := <-s.observationCh:
		if resp.Error != nil {
			slog.Warn("Received observation with error", "error", resp.Error)
			return resp.State, resp.Error
		}
		slog.Info("Received observation", "shapes", len(resp.State))
		return resp.State, nil
	case <-time.After(10 * time.Second):
		return nil, fmt.Errorf("observation timeout")
	case <-ctx.Done():
		return nil, ctx.Err()
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

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	session := &wsSession{
		conn:          conn,
		writeMu:       &sync.Mutex{},
		observationCh: make(chan ObservationResponse, 1),
		inputCh:       make(chan model.ClientMessage, 20),
	}

	// Task Processor Goroutine
	// Ensures sequential processing of user inputs without blocking the Read loop
	go func() {
		var chatHistory []string
		var globalConstraints string
		for {
			select {
			case <-ctx.Done():
				return
			case clientMsg := <-session.inputCh:
				chatHistory, globalConstraints = h.engine.ProcessInput(ctx, session, clientMsg, chatHistory, globalConstraints)
			}
		}
	}()

	for {
		_, messageBytes, err := conn.ReadMessage()
		if err != nil {
			slog.Info("WebSocket connection closed or error read", "error", err)
			break
		}

		var clientMsg model.ClientMessage
		if err := json.Unmarshal(messageBytes, &clientMsg); err != nil {
			slog.Error("Failed to unmarshal client message", "error", err)
			session.SendError("Invalid client message payload")
			continue
		}

		// Ignore heartbeat ping
		if clientMsg.Text == "__ping__" {
			continue
		}

		// Check if this is an observation response (canvas_state feedback for Agent)
		if clientMsg.Text == "__observation__" {
			obsResp := ObservationResponse{State: clientMsg.CanvasState}
			if clientMsg.Error != "" {
				obsResp.Error = fmt.Errorf("%s", clientMsg.Error)
			}
			select {
			case session.observationCh <- obsResp:
			default:
				// Channel already has data, skip
			}
			continue
		}

		slog.Info("Received message", "text", clientMsg.Text, "state_len", len(clientMsg.CanvasState))

		// Enqueue the task instead of blocking the read loop
		select {
		case session.inputCh <- clientMsg:
		default:
			slog.Warn("Client input channel full, dropping message")
			session.SendError("系统繁忙，请稍后再试")
		}
	}
}
