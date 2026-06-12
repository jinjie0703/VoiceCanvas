package service

import (
	"context"
	"strings"
	"voice-canvas-backend/internal/model"
)

type MockParser struct{}

// NewMockParser instantiates a mock voice command parser.
func NewMockParser() *MockParser {
	return &MockParser{}
}

// Parse runs mock detection logic on incoming text.
func (p *MockParser) Parse(ctx context.Context, text string, state []model.CanvasElement) model.ServerResponse {
	textLower := strings.ToLower(text)
	actions := []model.DrawAction{}

	if strings.Contains(textLower, "画") || strings.Contains(textLower, "创建") || strings.Contains(textLower, "add") || strings.Contains(textLower, "create") {
		if strings.Contains(textLower, "便签") || strings.Contains(textLower, "note") {
			color := "yellow"
			if strings.Contains(textLower, "红") || strings.Contains(textLower, "red") {
				color = "red"
			} else if strings.Contains(textLower, "蓝") || strings.Contains(textLower, "blue") {
				color = "blue"
			} else if strings.Contains(textLower, "绿") || strings.Contains(textLower, "green") {
				color = "green"
			}

			pos := "center"
			if strings.Contains(textLower, "右上") || strings.Contains(textLower, "right") {
				pos = "top_right"
			} else if strings.Contains(textLower, "左上") {
				pos = "top_left"
			}

			actions = append(actions, model.DrawAction{
				Command:  "create_shape",
				Type:     "note",
				Position: pos,
				Props: map[string]interface{}{
					"color": color,
					"w":     200,
					"h":     200,
				},
				Text: "Mock 便签",
			})
		} else {
			shapeType := "rectangle"
			if strings.Contains(textLower, "圆") || strings.Contains(textLower, "circle") {
				shapeType = "circle"
			} else if strings.Contains(textLower, "三角") {
				shapeType = "triangle"
			} else if strings.Contains(textLower, "菱形") || strings.Contains(textLower, "diamond") {
				shapeType = "diamond"
			}

			color := "blue"
			if strings.Contains(textLower, "红") || strings.Contains(textLower, "red") {
				color = "red"
			}

			pos := "center"
			if strings.Contains(textLower, "左上") {
				pos = "top_left"
			} else if strings.Contains(textLower, "右上") {
				pos = "top_right"
			}

			actions = append(actions, model.DrawAction{
				Command:  "create_shape",
				Type:     "geo",
				Position: pos,
				Props: map[string]interface{}{
					"geo":   shapeType,
					"color": color,
					"w":     150,
					"h":     100,
				},
			})
		}
	} else if strings.Contains(textLower, "清空") || strings.Contains(textLower, "清除") || strings.Contains(textLower, "clear") {
		actions = append(actions, model.DrawAction{
			Command: "clear_canvas",
		})
	}

	return model.ServerResponse{Actions: actions}
}
