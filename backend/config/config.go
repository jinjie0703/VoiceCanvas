package config

import (
	"log/slog"
	"os"

	"github.com/joho/godotenv"
)

type Config struct {
	Port        string
	LLMProvider string
	LLMBaseURL  string
	LLMAPIKey   string
	FastModel   string
	LargeModel  string
}

// Load reads config variables from the environment and .env file.
func Load() *Config {
	if err := godotenv.Load(); err != nil {
		slog.Warn("Note: .env file not found, using system environment variables.")
	}

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	// Unified API Key
	apiKey := os.Getenv("DASHSCOPE_API_KEY")
	if apiKey == "" {
		apiKey = os.Getenv("LLM_API_KEY")
	}

	provider := os.Getenv("LLM_PROVIDER")
	if provider == "" {
		provider = "dashscope"
	}

	baseURL := os.Getenv("LLM_BASE_URL")
	if baseURL == "" {
		baseURL = "https://dashscope.aliyuncs.com/compatible-mode/v1"
	}

	fastModel := os.Getenv("FAST_MODEL")
	if fastModel == "" {
		fastModel = "qwen3.6-flash"
	}

	largeModel := os.Getenv("LARGE_MODEL")
	if largeModel == "" {
		largeModel = "qwen-plus"
	}

	return &Config{
		Port:        port,
		LLMProvider: provider,
		LLMBaseURL:  baseURL,
		LLMAPIKey:   apiKey,
		FastModel:   fastModel,
		LargeModel:  largeModel,
	}
}
