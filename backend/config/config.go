package config

import (
	"log/slog"
	"os"

	"github.com/joho/godotenv"
)

type Config struct {
	Port               string
	ModelScopeAPIKey   string
	DashScopeAPIKey    string
	ModelName          string
	ModelScopeBaseURL  string
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

	modelName := os.Getenv("MODEL_NAME")
	if modelName == "" {
		modelName = "qwen-plus"
	}

	baseURL := os.Getenv("MODELSCOPE_BASE_URL")
	if baseURL == "" {
		baseURL = "https://dashscope.aliyuncs.com/compatible-mode/v1"
	}

	return &Config{
		Port:              port,
		ModelScopeAPIKey:  os.Getenv("MODELSCOPE_API_KEY"),
		DashScopeAPIKey:   os.Getenv("DASHSCOPE_API_KEY"),
		ModelName:         modelName,
		ModelScopeBaseURL: baseURL,
	}
}
