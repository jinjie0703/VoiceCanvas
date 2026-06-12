package handler

import (
	"io"
	"net/http"
	"log/slog"

	"voice-canvas-backend/internal/service"
)

func HandleImage(w http.ResponseWriter, r *http.Request) {
	action := r.URL.Query().Get("action")
	prompt := r.URL.Query().Get("prompt")

	// Allow CORS for the frontend
	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.Header().Set("Access-Control-Allow-Methods", "GET, OPTIONS")
	
	if r.Method == "OPTIONS" {
		w.WriteHeader(http.StatusOK)
		return
	}

	if prompt == "" {
		http.Error(w, "missing prompt", http.StatusBadRequest)
		return
	}

	var imgURL string
	var err error

	ctx := r.Context()

	switch action {
	case "generate":
		slog.Info("Handling image generation via Wanx", "prompt", prompt)
		imgURL, err = service.GenerateWanxImage(ctx, prompt)
	case "search":
		slog.Info("Handling image search via Wiki", "keyword", prompt)
		imgURL, err = service.SearchWikiImage(ctx, prompt)
	default:
		http.Error(w, "invalid action", http.StatusBadRequest)
		return
	}

	if err != nil {
		slog.Error("Image tool failed", "error", err)
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	// Fetch the actual image and pipe it to frontend
	imgReq, err := http.NewRequestWithContext(ctx, "GET", imgURL, nil)
	if err != nil {
		http.Error(w, "failed to create request", http.StatusInternalServerError)
		return
	}
	
	// Masquerade for Bing images to avoid 403
	imgReq.Header.Set("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")

	imgResp, err := http.DefaultClient.Do(imgReq)
	if err != nil {
		slog.Error("Failed to fetch final image", "url", imgURL, "error", err)
		http.Error(w, "failed to fetch image", http.StatusInternalServerError)
		return
	}
	defer imgResp.Body.Close()

	w.Header().Set("Content-Type", imgResp.Header.Get("Content-Type"))
	w.Header().Set("Cache-Control", "public, max-age=86400")
	io.Copy(w, imgResp.Body)
}
