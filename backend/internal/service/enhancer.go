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

// StreamEnhance provides a streaming chat completion for optimizing a prompt into a detailed description.
func (e *Enhancer) StreamEnhance(ctx context.Context, text string) (*openai.ChatCompletionStream, error) {
	messages := []openai.ChatCompletionMessage{
		{
			Role:    openai.ChatMessageRoleSystem,
			Content: "你是一个专业的画图提示词优化专家。请将用户输入的简短提示词扩充成详细的拓扑图、架构图、流程图或其他图表描述。请详细列出涉及的核心组件、合理的布局位置、连线关系以及样式建议（如颜色、虚线等），使其极度适合交给 AI 画图引擎执行。直接输出优化后的完整提示词，不要解释，不要说任何多余的话。",
		},
		{
			Role:    openai.ChatMessageRoleUser,
			Content: text,
		},
	}

	req := openai.ChatCompletionRequest{
		Model:       e.fastModel,
		Messages:    messages,
		Temperature: 0.7,
		Stream:      true,
	}

	return e.client.CreateChatCompletionStream(ctx, req)
}
