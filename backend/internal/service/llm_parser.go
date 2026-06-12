package service

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log/slog"
	"strings"
	"time"

	"voice-canvas-backend/config"
	"voice-canvas-backend/internal/model"
	"voice-canvas-backend/internal/prompts"

	"github.com/sashabaranov/go-openai"
)

type LLMParser struct {
	client     *openai.Client
	largeModel string
}

// NewLLMParser initializes LLMParser if keys are available. Returns nil otherwise.
func NewLLMParser(cfg *config.Config) *LLMParser {
	apiKey := cfg.LLMAPIKey
	if apiKey == "" {
		return nil
	}

	openaiCfg := openai.DefaultConfig(apiKey)
	openaiCfg.BaseURL = cfg.LLMBaseURL
	client := openai.NewClientWithConfig(openaiCfg)

	return &LLMParser{
		client:     client,
		largeModel: cfg.LargeModel,
	}
}

// ParseStream sends the user input and canvas state to the LLM API and streams the output line by line.
func (p *LLMParser) ParseStream(ctx context.Context, text string, state []model.CanvasElement, onChunk func(model.ServerResponse)) {
	stateJSON, err := json.Marshal(state)
	if err != nil {
		stateJSON = []byte("[]")
	}

	userMsg := fmt.Sprintf("User Voice Input: %q\n\nCurrent Canvas State: %s", text, string(stateJSON))
	messages := []openai.ChatCompletionMessage{
		{
			Role:    openai.ChatMessageRoleSystem,
			Content: prompts.SystemPrompt,
		},
		{
			Role:    openai.ChatMessageRoleUser,
			Content: userMsg,
		},
	}

	// Increase timeout significantly to allow large models to stream complex JSON layouts
	subCtx, cancel := context.WithTimeout(ctx, 180*time.Second)
	defer cancel()

	req := openai.ChatCompletionRequest{
		Model:       p.largeModel,
		Messages:    messages,
		Temperature: 0.1,
		Stream:      true,
	}

	stream, err := p.client.CreateChatCompletionStream(subCtx, req)
	if err != nil {
		slog.Error("LLM API Stream Call failed", "error", err)
		onChunk(model.ServerResponse{Actions: []model.DrawAction{}})
		return
	}
	defer stream.Close()

	var lineBuffer string

	for {
		resp, err := stream.Recv()
		if errors.Is(err, io.EOF) {
			break
		}
		if err != nil {
			slog.Error("Stream recv error", "error", err)
			break
		}

		if len(resp.Choices) > 0 {
			content := resp.Choices[0].Delta.Content
			lineBuffer += content
		}

		for {
			idx := strings.Index(lineBuffer, "\n")
			if idx == -1 {
				break
			}

			line := strings.TrimSpace(lineBuffer[:idx])
			lineBuffer = lineBuffer[idx+1:]

			if line == "" || strings.HasPrefix(line, "```") {
				continue
			}

			// Skip lines that clearly aren't JSON objects (e.g. <think> tags, markdown text)
			if !strings.HasPrefix(line, "{") {
				continue
			}

			var parsed model.ServerResponse
			if err := json.Unmarshal([]byte(line), &parsed); err != nil {
				slog.Warn("Failed to unmarshal JSON line", "line", line, "error", err)
				continue
			}

			onChunk(parsed)
		}
	}

	lineBuffer = strings.TrimSpace(lineBuffer)
	if lineBuffer != "" && !strings.HasPrefix(lineBuffer, "```") {
		var parsed model.ServerResponse
		if err := json.Unmarshal([]byte(lineBuffer), &parsed); err == nil {
			onChunk(parsed)
		}
	}
}
