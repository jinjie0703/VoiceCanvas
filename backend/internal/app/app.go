package app

import (
	"context"
	"log/slog"
	"net/http"
	"os"

	"voice-canvas-backend/config"
	"voice-canvas-backend/internal/agent"
	"voice-canvas-backend/internal/handler"
	"voice-canvas-backend/internal/rag"
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
	ctx := context.Background()

	// Check if we should run the preprocess step
	if len(os.Args) > 1 && os.Args[1] == "preprocess" {
		slog.Info("Running RAG preprocessing...")
		err := rag.Preprocess(ctx, rag.PreprocessConfig{
			DocsPath:       "data/llms-docs.txt",
			OutputPath:     "data/embeddings.json",
			APIKey:         cfg.LLMAPIKey,
			BaseURL:        cfg.LLMBaseURL,
			EmbeddingModel: "text-embedding-v3",
		})
		if err != nil {
			slog.Error("Preprocessing failed", "error", err)
			os.Exit(1)
		}
		slog.Info("Preprocessing complete!")
		os.Exit(0)
	}

	// Initialize services
	var parserService service.ParserService
	var enhancer *service.Enhancer
	var ag *agent.Agent
	llmParser := service.NewLLMParser(cfg)

	if llmParser == nil {
		slog.Warn("WARNING: No DASHSCOPE_API_KEY was set. Running in Mock Mode.")
		parserService = service.NewMockParser()
	} else {
		slog.Info("API Key found. Configuring Agent Pipeline...", "fast_model", cfg.FastModel, "large_model", cfg.LargeModel)
		parserService = llmParser
		enhancer = service.NewEnhancer(cfg)

		// Try to initialize RAG retriever
		var retriever *rag.Retriever
		if _, err := os.Stat("data/embeddings.json"); err == nil {
			retriever, err = rag.NewRetriever("data/embeddings.json")
			if err != nil {
				slog.Warn("Failed to load RAG embeddings, Agent will run without RAG", "error", err)
			} else {
				slog.Info("RAG retriever loaded", "chunks", "ready")
			}
		} else {
			slog.Info("No embeddings.json found. Run 'go run main.go preprocess' to generate. Agent will run without RAG.")
		}

		// Initialize Agent
		agentInstance, err := agent.NewAgent(ctx, agent.Config{
			ModelName: cfg.LargeModel,
			APIKey:    cfg.LLMAPIKey,
			BaseURL:   cfg.LLMBaseURL,
			Retriever: retriever,
			EmbeddingCfg: agent.EmbeddingConfig{
				APIKey:  cfg.LLMAPIKey,
				BaseURL: cfg.LLMBaseURL,
				Model:   "text-embedding-v3",
			},
			MaxRounds: 5,
		})
		if err != nil {
			slog.Warn("Failed to create Agent, falling back to legacy parser", "error", err)
		} else {
			ag = agentInstance
			slog.Info("Agent V2 initialized successfully")
		}
	}

	// Initialize handlers
	wsHandler := handler.NewWebSocketHandler(parserService, enhancer, ag)

	// Register routes
	http.Handle("/ws", wsHandler)
	http.HandleFunc("/api/image", handler.HandleImage)

	// Start server
	slog.Info("Go Backend listening", "address", "http://localhost:"+cfg.Port+"/ws")
	if err := http.ListenAndServe(":"+cfg.Port, nil); err != nil {
		slog.Error("Server crashed", "error", err)
		os.Exit(1)
	}
}

