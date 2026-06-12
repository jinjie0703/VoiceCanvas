package service

import (
	"context"
	"voice-canvas-backend/internal/model"
)

// ParserService defines the contract for parsing voice input into whiteboard actions.
type ParserService interface {
	Parse(ctx context.Context, text string, state []model.CanvasElement) model.ServerResponse
}
