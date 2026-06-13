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
	IsValid           bool   `json:"is_valid"`
	FeedbackMsg       string `json:"feedback_msg"`
	EnhancedPrompt    string `json:"enhanced_prompt"`
	GlobalConstraints string `json:"global_constraints"`
}

// Enhance processes the raw input, canvas state, and chat history, returning the refined JSON result.
func (e *Enhancer) Enhance(ctx context.Context, text string, state []model.CanvasElement, history []string, currentConstraints string) (*EnhancementResult, error) {
	stateJSON, err := json.Marshal(state)
	if err != nil {
		stateJSON = []byte("[]")
	}

	historyJSON, err := json.Marshal(history)
	if err != nil {
		historyJSON = []byte("[]")
	}

	userMsg := "recent_history: " + string(historyJSON) + "\nraw_input: \"" + text + "\"\ncanvas_summary: " + string(stateJSON) + "\ncurrent_global_constraints: \"" + currentConstraints + "\""

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
			Content: "你是一个专业的画图提示词优化专家。请对用户输入的简短提示词进行适当润色，使其成为清晰明确的绘图指令。\n\n【严格要求】\n1. 直接输出优化后的指令，不要解释，不要任何开场白。\n2. 内容必须简短精炼，**输出文本的字数绝对不能超过原输入的 1.5 倍**。在原本基础上适当优化即可，切忌长篇大论或过度发散地添加用户未提及的组件。",
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
