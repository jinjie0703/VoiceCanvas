package service

import (
	"context"
	"log/slog"

	"voice-canvas-backend/internal/agent"
	"voice-canvas-backend/internal/model"
)

// ClientSession defines the interface for communicating with the connected client.
type ClientSession interface {
	// SendServerResponse sends the full ServerResponse payload to the client.
	SendServerResponse(resp model.ServerResponse, rawText string) error
	
	// SendFeedback sends feedback (e.g. from enhancer validation) to the client.
	SendFeedback(msg string, rawText string) error
	
	// SendError sends a generic error message to the client.
	SendError(msg string) error
	
	// RequestObservation requests the latest canvas state from the client, blocking until received or timeout.
	RequestObservation(ctx context.Context) ([]model.CanvasElement, error)
}

// Engine orchestrates the interactions between the client session, enhancer, and LLM agent.
type Engine struct {
	parserService ParserService
	enhancer      *Enhancer
	agent         *agent.Agent
}

func NewEngine(parserService ParserService, enhancer *Enhancer, ag *agent.Agent) *Engine {
	return &Engine{
		parserService: parserService,
		enhancer:      enhancer,
		agent:         ag,
	}
}

// ProcessInput handles a single incoming message from the client.
func (e *Engine) ProcessInput(ctx context.Context, session ClientSession, clientMsg model.ClientMessage, chatHistory []string, globalConstraints string) ([]string, string) {
	finalPrompt := clientMsg.Text
	newGlobalConstraints := globalConstraints

	// 1. Enhancer validation and expansion
	if e.enhancer != nil {
		enhRes, err := e.enhancer.Enhance(ctx, clientMsg.Text, clientMsg.CanvasState, chatHistory, globalConstraints)
		if err == nil {
			if !enhRes.IsValid {
				slog.Info("Enhancer rejected input", "feedback", enhRes.FeedbackMsg)
				session.SendFeedback(enhRes.FeedbackMsg, clientMsg.Text)
				return chatHistory, globalConstraints // Early return, don't update history with invalid input
			}
			finalPrompt = enhRes.EnhancedPrompt
			if enhRes.GlobalConstraints != "" {
				newGlobalConstraints = enhRes.GlobalConstraints
			}
			slog.Info("Prompt enhanced", "original", clientMsg.Text, "enhanced", finalPrompt, "constraints", newGlobalConstraints)
		} else {
			slog.Warn("Enhancer failed, falling back to raw text", "error", err)
		}
	}

	// 2. Update chat history (keep last 6 turns)
	newHistory := append(chatHistory, clientMsg.Text)
	if len(newHistory) > 6 {
		newHistory = newHistory[len(newHistory)-6:]
	}

	// 3. Dispatch to Agent or Legacy Parser
	if e.agent != nil {
		slog.Info("Using Agent mode")
		func(p string, s []model.CanvasElement, text string, gc string) {
			defer func() {
				_ = session.SendServerResponse(model.ServerResponse{Actions: []model.DrawAction{}}, "__done__")
			}()
			e.agent.Run(ctx, p, gc, s, clientMsg.Base64Image,
				func(resp model.ServerResponse) {
					// Add raw text back so client knows what it belongs to
					_ = session.SendServerResponse(resp, text)
				},
				func() ([]model.CanvasElement, error) {
					state, err := session.RequestObservation(ctx)
					if err != nil {
						if err.Error() != "observation timeout" && err != ctx.Err() {
							return nil, err
						}
						slog.Warn("Observation failed or timeout, using empty state", "error", err)
						return []model.CanvasElement{}, nil
					}
					return state, nil
				},
			)
		}(finalPrompt, clientMsg.CanvasState, clientMsg.Text, newGlobalConstraints)
	} else {
		// Legacy Mode
		slog.Info("Using Legacy Parser mode")
		func(p string, s []model.CanvasElement, text string) {
			defer func() {
				_ = session.SendServerResponse(model.ServerResponse{Actions: []model.DrawAction{}}, "__done__")
			}()
			e.parserService.ParseStream(ctx, p, s, func(chunk model.ServerResponse) {
				_ = session.SendServerResponse(chunk, text)
			})
		}(finalPrompt, clientMsg.CanvasState, clientMsg.Text)
	}

	return newHistory, newGlobalConstraints
}
