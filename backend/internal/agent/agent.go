package agent

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log/slog"
	"strings"

	"voice-canvas-backend/internal/model"
	"voice-canvas-backend/internal/prompts"
	"voice-canvas-backend/internal/rag"

	einoopenai "github.com/cloudwego/eino-ext/components/model/openai"
	"github.com/cloudwego/eino/schema"
)

// OnActionCallback is called when the agent produces actions to be executed on the canvas.
type OnActionCallback func(resp model.ServerResponse)

// ObservationFunc is called after actions are sent; it should return the latest canvas state.
type ObservationFunc func() []model.CanvasElement

// Agent orchestrates the ReAct loop: Think → Act → Observe → Repeat.
type Agent struct {
	chatModel *einoopenai.ChatModel
	retriever *rag.Retriever
	embCfg    EmbeddingConfig
	maxRounds int
}

// EmbeddingConfig holds settings for query-time embedding.
type EmbeddingConfig struct {
	APIKey  string
	BaseURL string
	Model   string
}

// Config holds configuration for creating a new Agent.
type Config struct {
	ModelName    string
	APIKey       string
	BaseURL      string
	Retriever    *rag.Retriever
	EmbeddingCfg EmbeddingConfig
	MaxRounds    int
}

// NewAgent creates a new Agent with the given configuration.
func NewAgent(ctx context.Context, cfg Config) (*Agent, error) {
	chatModel, err := einoopenai.NewChatModel(ctx, &einoopenai.ChatModelConfig{
		Model:   cfg.ModelName,
		APIKey:  cfg.APIKey,
		BaseURL: cfg.BaseURL,
	})
	if err != nil {
		return nil, fmt.Errorf("failed to create chat model: %w", err)
	}

	maxRounds := cfg.MaxRounds
	if maxRounds == 0 {
		maxRounds = 5
	}

	return &Agent{
		chatModel: chatModel,
		retriever: cfg.Retriever,
		embCfg:    cfg.EmbeddingCfg,
		maxRounds: maxRounds,
	}, nil
}

// Run executes the ReAct agent loop.
// enhancedPrompt: the refined user intent from the Enhancer.
// canvasState: the current state of the canvas.
// onAction: callback to send actions to the frontend for execution.
// observe: callback to retrieve updated canvas state after actions are executed.
func (a *Agent) Run(ctx context.Context, enhancedPrompt string, canvasState []model.CanvasElement, onAction OnActionCallback, observe ObservationFunc) {
	// 1. Retrieve relevant TLDraw API documentation
	ragContext := ""
	if a.retriever != nil {
		ragContext = a.retrieveContext(ctx, enhancedPrompt)
	}

	// 2. Build system prompt with RAG context
	systemPrompt := a.buildSystemPrompt(ragContext)

	// 3. Initialize conversation history
	stateJSON, _ := json.Marshal(canvasState)
	messages := []*schema.Message{
		schema.SystemMessage(systemPrompt),
		schema.UserMessage(fmt.Sprintf("User Request: %s\n\nCurrent Canvas State: %s", enhancedPrompt, string(stateJSON))),
	}

	// 4. ReAct Loop
	for round := 0; round < a.maxRounds; round++ {
		slog.Info("Agent round", "round", round+1, "max", a.maxRounds)

		// Think: call LLM using Stream
		stream, err := a.chatModel.Stream(ctx, messages)
		if err != nil {
			slog.Error("Agent LLM call failed", "error", err, "round", round+1)
			break
		}

		var fullContent string
		var lineBuffer string
		var allActions []model.DrawAction
		isDone := false

		for {
			chunk, err := stream.Recv()
			if errors.Is(err, io.EOF) {
				break
			}
			if err != nil {
				slog.Error("Stream recv error", "error", err)
				break
			}

			if chunk != nil {
				content := chunk.Content
				fullContent += content
				lineBuffer += content

				for {
					idx := strings.Index(lineBuffer, "\n")
					if idx == -1 {
						break
					}

					line := strings.TrimSpace(lineBuffer[:idx])
					lineBuffer = lineBuffer[idx+1:]

					if line == "" || strings.HasPrefix(line, "```") || !strings.HasPrefix(line, "{") {
						continue
					}

					// Check for done signal
					var doneCheck struct {
						Status string `json:"status"`
					}
					if json.Unmarshal([]byte(line), &doneCheck) == nil && doneCheck.Status == "done" {
						isDone = true
						continue
					}

					// Parse as ServerResponse
					var resp model.ServerResponse
					if err := json.Unmarshal([]byte(line), &resp); err != nil {
						continue
					}

					if len(resp.Actions) > 0 {
						allActions = append(allActions, resp.Actions...)
						onAction(resp)
					}
				}
			}
		}

		stream.Close()

		// Handle remaining buffer
		lineBuffer = strings.TrimSpace(lineBuffer)
		if lineBuffer != "" && strings.HasPrefix(lineBuffer, "{") && !strings.HasPrefix(lineBuffer, "```") {
			var doneCheck struct {
				Status string `json:"status"`
			}
			if json.Unmarshal([]byte(lineBuffer), &doneCheck) == nil && doneCheck.Status == "done" {
				isDone = true
			} else {
				var resp model.ServerResponse
				if err := json.Unmarshal([]byte(lineBuffer), &resp); err == nil && len(resp.Actions) > 0 {
					allActions = append(allActions, resp.Actions...)
					onAction(resp)
				}
			}
		}

		slog.Info("Agent response", "round", round+1, "content_len", len(fullContent))

		if isDone || len(allActions) == 0 {
			slog.Info("Agent finished", "round", round+1, "reason", "done_or_no_actions")
			break
		}

		// Observe: get updated canvas state
		messages = append(messages, schema.AssistantMessage(fullContent, nil))

		if observe != nil {
			newState := observe()
			newStateJSON, _ := json.Marshal(newState)
			observation := fmt.Sprintf("Actions executed successfully. Updated canvas state (%d shapes): %s\nContinue if more work is needed, or respond with {\"status\": \"done\"} if the task is complete.", len(newState), string(newStateJSON))
			messages = append(messages, schema.UserMessage(observation))
		} else {
			// No observation function, single-pass mode
			break
		}
	}
}

// retrieveContext performs RAG retrieval for the given query.
func (a *Agent) retrieveContext(ctx context.Context, query string) string {
	// For simplicity, use keyword-based matching if embedding config is empty
	if a.embCfg.APIKey == "" {
		// Fallback: return a generic context snippet
		return ""
	}

	// Call embedding API for the query
	embedding, err := getQueryEmbedding(ctx, a.embCfg, query)
	if err != nil {
		slog.Warn("Failed to get query embedding", "error", err)
		return ""
	}

	results := a.retriever.Search(embedding, 3)
	if len(results) == 0 {
		return ""
	}

	return rag.FormatContext(results)
}

// buildSystemPrompt constructs the full system prompt with RAG context injected.
func (a *Agent) buildSystemPrompt(ragContext string) string {
	base := prompts.SystemPrompt

	if ragContext != "" {
		base += "\n\n### TLDraw API 参考文档 (由 RAG 检索)\n以下是与当前任务最相关的 TLDraw SDK 文档片段。你可以参考这些 API 来执行更丰富的操作：\n\n" + ragContext
	}

	base += "\n\n### Agent 模式补充规则\n" +
		"- 你现在运行在 Agent 模式下。每轮你可以输出一批 actions，系统会执行它们并返回最新的画布状态。\n" +
		"- 你可以根据返回的画布状态继续调整（例如发现布局不合理、节点重叠、缺少连线等）。\n" +
		"- 当你认为任务已经完成时，输出 `{\"status\": \"done\"}` 结束循环。\n" +
		"- 每轮最多输出 5 个 actions，不要一次性输出太多。"

	return base
}
