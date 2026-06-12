package service

import (
	"context"
	"voice-canvas-backend/internal/model"
)

// ParserService defines the contract for parsing voice input into whiteboard actions.
type ParserService interface {
	ParseStream(ctx context.Context, text string, state []model.CanvasElement, onChunk func(model.ServerResponse))
}
