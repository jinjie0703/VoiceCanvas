package service

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"strings"
	"time"

	"voice-canvas-backend/config"
	"voice-canvas-backend/internal/model"
	"voice-canvas-backend/internal/prompts"

	"github.com/sashabaranov/go-openai"
)


type LLMParser struct {
	client    *openai.Client
	modelName string
}

// NewLLMParser initializes LLMParser if keys are available. Returns nil otherwise.
func NewLLMParser(cfg *config.Config) *LLMParser {
	apiKey := cfg.ModelScopeAPIKey
	if apiKey == "" {
		apiKey = cfg.DashScopeAPIKey
	}

	if apiKey == "" {
		return nil
	}

	openaiCfg := openai.DefaultConfig(apiKey)
	openaiCfg.BaseURL = cfg.ModelScopeBaseURL
	client := openai.NewClientWithConfig(openaiCfg)

	return &LLMParser{
		client:    client,
		modelName: cfg.ModelName,
	}
}

// Parse sends the user input and canvas state to the configured LLM API.
func (p *LLMParser) Parse(ctx context.Context, text string, state []model.CanvasElement) model.ServerResponse {
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

	var jsonOutput string
	maxRetries := 2
	for attempt := 0; attempt <= maxRetries; attempt++ {
		subCtx, cancel := context.WithTimeout(ctx, 15*time.Second)
		resp, err := p.client.CreateChatCompletion(subCtx, openai.ChatCompletionRequest{
			Model: p.modelName,
			Messages: messages,
			ResponseFormat: &openai.ChatCompletionResponseFormat{
				Type: openai.ChatCompletionResponseFormatTypeJSONObject,
			},
			Temperature: 0.1,
		})
		cancel()

		if err != nil {
			slog.Error("LLM API Call failed", "attempt", attempt, "error", err)
			if attempt == maxRetries {
				return model.ServerResponse{Actions: []model.DrawAction{}}
			}
			time.Sleep(1 * time.Second)
			continue
		}

		if len(resp.Choices) == 0 {
			slog.Error("LLM API returned empty choices", "attempt", attempt)
			if attempt == maxRetries {
				return model.ServerResponse{Actions: []model.DrawAction{}}
			}
			time.Sleep(1 * time.Second)
			continue
		}

		jsonOutput = resp.Choices[0].Message.Content
		jsonOutput = cleanJSONString(jsonOutput)

		// Self-correction check: Validate if it's correct JSON matching ServerResponse schema
		var parsed model.ServerResponse
		if err := json.Unmarshal([]byte(jsonOutput), &parsed); err != nil {
			slog.Error("LLM returned invalid JSON", "attempt", attempt, "output", jsonOutput, "error", err)
			if attempt < maxRetries {
				// Feed error back to model for correction
				messages = append(messages, openai.ChatCompletionMessage{
					Role:    openai.ChatMessageRoleAssistant,
					Content: jsonOutput,
				})
				messages = append(messages, openai.ChatCompletionMessage{
					Role:    openai.ChatMessageRoleUser,
					Content: fmt.Sprintf("Your output failed JSON parsing. Error: %v. Please correct your output and return only the corrected JSON.", err),
				})
				continue
			}
			return model.ServerResponse{Actions: []model.DrawAction{}}
		}

		// Success!
		return parsed
	}

	return model.ServerResponse{Actions: []model.DrawAction{}}
}

// cleanJSONString removes markdown backticks if the LLM outputted them despite instructions.
func cleanJSONString(s string) string {
	s = strings.TrimSpace(s)
	if strings.HasPrefix(s, "```") {
		lines := strings.Split(s, "\n")
		if len(lines) > 2 {
			s = strings.Join(lines[1:len(lines)-1], "\n")
		}
	}
	return strings.TrimSpace(s)
}
