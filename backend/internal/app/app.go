package app

import (
	"log/slog"
	"net/http"
	"os"

	"voice-canvas-backend/config"
	"voice-canvas-backend/internal/handler"
	"voice-canvas-backend/internal/service"
)

// Run boots up the server setup and handles graceful dependencies wiring.
func Run() {
	// Initialize structured logger
	logger := slog.New(slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{
		Level: slog.LevelInfo,
	}))
	slog.SetDefault(logger)

	// Load configuration
	cfg := config.Load()

	// Initialize services
	var parserService service.ParserService
	llmParser := service.NewLLMParser(cfg)

	if llmParser == nil {
		slog.Warn("WARNING: No API Key (MODELSCOPE_API_KEY or DASHSCOPE_API_KEY) was set. Running in Mock Mode.")
		parserService = service.NewMockParser()
	} else {
		slog.Info("API Key found. Configuring ModelScope OpenAI Compatible Client...", "model", cfg.ModelName)
		parserService = llmParser
	}

	// Initialize handlers
	wsHandler := handler.NewWebSocketHandler(parserService)

	// Register routes
	http.Handle("/ws", wsHandler)

	// Start server
	slog.Info("Go Backend listening", "address", "http://localhost:"+cfg.Port+"/ws")
	if err := http.ListenAndServe(":"+cfg.Port, nil); err != nil {
		slog.Error("Server crashed", "error", err)
		os.Exit(1)
	}
}
