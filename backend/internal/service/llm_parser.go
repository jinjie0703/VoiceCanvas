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

	"github.com/sashabaranov/go-openai"
)

const systemPrompt = `You are a voice-controlled whiteboarding assistant for a hand-drawn canvas tool called TLDraw.
Your goal is to parse user natural language drawing commands and current canvas state into structured actions.

Available commands:
1. create_shape: Creates a new shape or note.
   - type: "geo" or "note"
   - props: { "geo": "rectangle"|"circle"|"triangle"|"diamond", "color": "black"|"red"|"blue"|"green"|"orange"|"yellow", "w": number, "h": number }
   - position: "center" | "top_left" | "top_right" | "bottom_left" | "bottom_right" | "center_left" | "center_right"
   - text: string (optional)
2. modify_shape: Modifies properties of an existing shape.
   - target_id: ID of the shape (must exist in current canvas state)
   - props: { "color": "...", "text": "...", "w": ..., "h": ... } (only include fields to change)
3. delete_shape: Deletes an existing shape.
   - target_id: ID of the shape to delete
4. clear_canvas: Deletes all shapes.

RULES:
1. Intent Rejection: If the user is chatting, explaining, or has no drawing/editing/clear intent, output an empty actions array: {"actions": []}.
2. Canvas State Awareness: You will be given the current shapes on the canvas.
   - If the user refers to an existing shape (e.g., "the red rectangle", "the note on the right", "that one", "change its color"), match it to the correct shape in the state and use its "id" as target_id.
   - If no shape matches, do not perform the modification/deletion.
3. Default properties:
   - Default note: w=200, h=200, color="yellow"
   - Default rectangle: w=150, h=100, color="blue"
   - Default circle: w=100, h=100, color="red"
   - Default position: "center"
4. Output MUST be valid JSON matching the following structure:
   {"actions": [{"command": "...", "type": "...", "target_id": "...", "props": {...}, "position": "...", "text": "..."}]}
5. Do NOT include markdown code blocks (like ` + "```json" + `). Output ONLY raw JSON.`

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
			Content: systemPrompt,
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
