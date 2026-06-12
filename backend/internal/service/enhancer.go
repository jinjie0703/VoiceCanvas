package service

import (
	"context"
	"encoding/json"
	"log/slog"
	"time"

	"voice-canvas-backend/config"
	"voice-canvas-backend/internal/model"
	"voice-canvas-backend/internal/prompts"

	"github.com/sashabaranov/go-openai"
)

type Enhancer struct {
	client    *openai.Client
	fastModel string
}

// NewEnhancer initializes the Enhancer service. Returns nil if keys are missing.
func NewEnhancer(cfg *config.Config) *Enhancer {
	if cfg.LLMAPIKey == "" {
		return nil
	}

	openaiCfg := openai.DefaultConfig(cfg.LLMAPIKey)
	openaiCfg.BaseURL = cfg.LLMBaseURL
	client := openai.NewClientWithConfig(openaiCfg)

	return &Enhancer{
		client:    client,
		fastModel: cfg.FastModel,
	}
}

type EnhancementResult struct {
	IsValid        bool   `json:"is_valid"`
	FeedbackMsg    string `json:"feedback_msg"`
	EnhancedPrompt string `json:"enhanced_prompt"`
}

// Enhance processes the raw input, canvas state, and chat history, returning the refined JSON result.
func (e *Enhancer) Enhance(ctx context.Context, text string, state []model.CanvasElement, history []string) (*EnhancementResult, error) {
	stateJSON, err := json.Marshal(state)
	if err != nil {
		stateJSON = []byte("[]")
	}

	historyJSON, err := json.Marshal(history)
	if err != nil {
		historyJSON = []byte("[]")
	}

	userMsg := "recent_history: " + string(historyJSON) + "\nraw_input: \"" + text + "\"\ncanvas_summary: " + string(stateJSON)

	messages := []openai.ChatCompletionMessage{
		{
			Role:    openai.ChatMessageRoleSystem,
			Content: prompts.EnhancerPrompt,
		},
		{
			Role:    openai.ChatMessageRoleUser,
			Content: userMsg,
		},
	}

	subCtx, cancel := context.WithTimeout(ctx, 15*time.Second)
	defer cancel()

	req := openai.ChatCompletionRequest{
		Model:       e.fastModel,
		Messages:    messages,
		Temperature: 0.1,
		ResponseFormat: &openai.ChatCompletionResponseFormat{
			Type: openai.ChatCompletionResponseFormatTypeJSONObject,
		},
	}

	resp, err := e.client.CreateChatCompletion(subCtx, req)
	if err != nil {
		slog.Error("Enhancer API Call failed", "error", err)
		return nil, err
	}

	content := resp.Choices[0].Message.Content
	var result EnhancementResult
	if err := json.Unmarshal([]byte(content), &result); err != nil {
		slog.Error("Enhancer Failed to unmarshal JSON response", "content", content, "error", err)
		return nil, err
	}

	return &result, nil
}
