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

// ObservationFunc is called after actions are sent; it should return the latest canvas state and an optional error string.
type ObservationFunc func() ([]model.CanvasElement, error)

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
func (a *Agent) Run(ctx context.Context, enhancedPrompt string, globalConstraints string, canvasState []model.CanvasElement, base64Image string, onAction OnActionCallback, observe ObservationFunc) {
	// 1. Retrieve relevant TLDraw API documentation
	ragContext := ""
	if a.retriever != nil {
		ragContext = a.retrieveContext(ctx, enhancedPrompt)
	}

	// 2. Build system prompt with RAG context
	systemPrompt := a.buildSystemPrompt(ragContext, a.maxRounds, globalConstraints)

	// 3. Initialize conversation history
	stateJSON, _ := json.Marshal(canvasState)
	userContent := fmt.Sprintf("User Request: %s\n\nCurrent Canvas State: %s\n\n[System Info] Total allowed interactions for this task: %d. Please aim to complete the task within this limit.", enhancedPrompt, string(stateJSON), a.maxRounds)

	var userMsg *schema.Message
	if base64Image != "" {
		dataURI := "data:image/png;base64," + base64Image
		userMsg = &schema.Message{
			Role: schema.User,
			UserInputMultiContent: []schema.MessageInputPart{
				{Type: schema.ChatMessagePartTypeText, Text: userContent},
				{Type: schema.ChatMessagePartTypeImageURL, Image: &schema.MessageInputImage{
					MessagePartCommon: schema.MessagePartCommon{
						URL: &dataURI,
					},
					Detail: schema.ImageURLDetailHigh,
				}},
			},
		}
	} else {
		userMsg = schema.UserMessage(userContent)
	}

	messages := []*schema.Message{
		schema.SystemMessage(systemPrompt),
		userMsg,
	}

	var currentPlan []string

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
		var allActions []model.DrawAction
		isDone := false

		var buffer string

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
				for _, ch := range chunk.Content {
					fullContent += string(ch)
					buffer += string(ch)
				}
			}

			// Robust JSON stream parsing
			for {
				idx := strings.Index(buffer, "{")
				if idx == -1 {
					buffer = "" // No start of object found, discard buffer
					break
				}

				// Discard anything before the first '{'
				buffer = buffer[idx:]

				dec := json.NewDecoder(strings.NewReader(buffer))
				var rawMsg json.RawMessage
				err := dec.Decode(&rawMsg)
				if err != nil {
					// Check if it's incomplete
					if strings.Contains(err.Error(), "EOF") || strings.Contains(err.Error(), "unexpected end of JSON input") {
						break // Wait for more data
					}
					// Invalid JSON, skip this '{'
					buffer = buffer[1:]
					continue
				}

				// Parse successful
				var doneCheck struct {
					Status string `json:"status"`
				}
				if err := json.Unmarshal(rawMsg, &doneCheck); err == nil && doneCheck.Status == "done" {
					isDone = true
				} else {
					var resp model.ServerResponse
					if err := json.Unmarshal(rawMsg, &resp); err == nil {
						if len(resp.StepByStepPlan) > 0 {
							currentPlan = resp.StepByStepPlan
						}
						hasContent := len(resp.Actions) > 0 || resp.VoiceReply != "" || resp.Feedback != "" || resp.TaskAnalysis != ""
						if hasContent {
							if len(resp.Actions) > 0 {
								allActions = append(allActions, resp.Actions...)
							}
							onAction(resp)
						}
					}
				}

				buffer = buffer[int(dec.InputOffset()):]
			}
		}

		stream.Close()

		slog.Info("Agent response", "round", round+1, "content_len", len(fullContent))

		if isDone || len(allActions) == 0 {
			slog.Info("Agent finished", "round", round+1, "reason", "done_or_no_actions")
			break
		}

		// Observe: get updated canvas state
		messages = append(messages, schema.AssistantMessage(fullContent, nil))

		if observe != nil {
			newState, obsErr := observe()
			if obsErr != nil {
				errorMsg := fmt.Sprintf("CRITICAL ERROR executing actions on frontend: %v. Please carefully review the schema and correct your output.", obsErr)
				messages = append(messages, schema.UserMessage(errorMsg))
			} else {
				newStateJSON, _ := json.Marshal(newState)
				remaining := a.maxRounds - (round + 1)
				var systemWarning string
				if remaining <= 2 {
					systemWarning = fmt.Sprintf("\n[CRITICAL SYSTEM WARNING] You ONLY have %d interaction(s) remaining! You MUST finish the current task and ensure you return `{\"status\": \"done\"}` before you are cut off.", remaining)
				} else {
					systemWarning = fmt.Sprintf("\n[System Info] You have %d interaction(s) remaining. If the current canvas already meets the user's requirement, YOU MUST STOP NOW by responding ONLY with `{\"status\": \"done\"}`.", remaining)
				}

				if len(currentPlan) > 0 {
					planJSON, _ := json.Marshal(currentPlan)
					systemWarning += fmt.Sprintf("\n[Task Plan Tracker] 你的初始任务计划是: %s。请基于当前画布状态，严格遵循该计划执行下一步！不要遗忘计划！", string(planJSON))
				}

				observation := fmt.Sprintf("Actions executed successfully. Updated canvas state (%d shapes): %s%s", len(newState), string(newStateJSON), systemWarning)
				messages = append(messages, schema.UserMessage(observation))
			}
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

	results := a.retriever.Search(embedding, 6)
	if len(results) == 0 {
		return ""
	}

	return rag.FormatContext(results)
}

// buildSystemPrompt constructs the full system prompt with RAG context injected.
func (a *Agent) buildSystemPrompt(ragContext string, maxRounds int, globalConstraints string) string {
	base := prompts.SystemPrompt

	if globalConstraints != "" {
		base += "\n\n### 全局绘图约束 (最高优先级)\n以下是基于过去对话提纯出的全局长效约束，你必须在本次绘图中严格遵循这些限制与偏好：\n" + globalConstraints
	}

	if ragContext != "" {
		base += "\n\n### TLDraw API 参考文档 (由 RAG 检索)\n以下是与当前任务最相关的 TLDraw SDK 文档片段。你可以参考这些 API 来执行更丰富的操作：\n\n" + ragContext
	}

	base += fmt.Sprintf("\n\n### Agent 模式补充规则\n"+
		"- 你现在运行在 Agent 模式下。每轮你可以输出一批 actions，系统会执行它们并返回最新的画布状态。\n"+
		"- 你可以根据返回的画布状态继续调整（例如发现布局不合理、节点重叠、缺少连线等）。\n"+
		"- **尽早结束**：当你认为任务已经达到用户要求时，**请必须并且立即**输出 `{\"status\": \"done\"}` 结束循环。不要为了凑轮次而画蛇添足！\n"+
		"- 每轮最多输出 5 个 actions，不要一次性输出太多。\n"+
		"- 注意：你的最大交互轮数为 %d 轮。如果在最后几次交互中你发现无法画完所有细节，也请立即收尾并返回 done 状态。", maxRounds)

	return base
}
