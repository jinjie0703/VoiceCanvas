package handler

import (
	"errors"
	"fmt"
	"io"
	"net/http"

	"voice-canvas-backend/internal/service"
)

type OptimizeHandler struct {
	enhancer *service.Enhancer
}

func NewOptimizeHandler(enhancer *service.Enhancer) *OptimizeHandler {
	return &OptimizeHandler{enhancer: enhancer}
}

func (h *OptimizeHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	// CORS
	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.Header().Set("Access-Control-Allow-Methods", "GET, OPTIONS")
	w.Header().Set("Access-Control-Allow-Headers", "Content-Type")

	if r.Method == "OPTIONS" {
		w.WriteHeader(http.StatusOK)
		return
	}

	if h.enhancer == nil {
		http.Error(w, "Enhancer service is not configured", http.StatusInternalServerError)
		return
	}

	// Read prompt from query or body (we will use query for simplicity, or we can use body if needed)
	prompt := r.URL.Query().Get("prompt")
	if prompt == "" {
		http.Error(w, "missing prompt parameter", http.StatusBadRequest)
		return
	}

	stream, err := h.enhancer.StreamEnhance(r.Context(), prompt)
	if err != nil {
		http.Error(w, fmt.Sprintf("failed to start stream: %v", err), http.StatusInternalServerError)
		return
	}
	defer stream.Close()

	// Set headers for SSE
	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("Connection", "keep-alive")

	flusher, ok := w.(http.Flusher)
	if !ok {
		http.Error(w, "Streaming unsupported!", http.StatusInternalServerError)
		return
	}

	for {
		resp, err := stream.Recv()
		if errors.Is(err, io.EOF) {
			fmt.Fprintf(w, "data: [DONE]\n\n")
			flusher.Flush()
			break
		}
		if err != nil {
			fmt.Fprintf(w, "event: error\ndata: %v\n\n", err)
			flusher.Flush()
			break
		}

		// Write data
		fmt.Fprintf(w, "data: %s\n\n", resp.Choices[0].Delta.Content)
		flusher.Flush()
	}
}
