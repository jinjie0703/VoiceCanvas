package rag

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"os"
	"strings"
)

// PreprocessConfig holds settings for the preprocessing pipeline.
type PreprocessConfig struct {
	DocsPath       string // Path to the raw llms-docs.txt file
	OutputPath     string // Path to write the embeddings JSON
	APIKey         string // DashScope API key
	BaseURL        string // DashScope base URL
	EmbeddingModel string // e.g. "text-embedding-v3"
}

// embeddingRequest is the request payload for DashScope embedding API (OpenAI-compatible).
type embeddingRequest struct {
	Model string   `json:"model"`
	Input []string `json:"input"`
}

// embeddingResponse is the response from DashScope embedding API.
type embeddingResponse struct {
	Output struct {
		Embeddings []struct {
			TextIndex int       `json:"text_index"`
			Embedding []float64 `json:"embedding"`
		} `json:"embeddings"`
	} `json:"output"`
}

// Preprocess reads the docs file, splits into chunks, computes embeddings, and saves to JSON.
func Preprocess(ctx context.Context, cfg PreprocessConfig) error {
	// 1. Read raw docs
	raw, err := os.ReadFile(cfg.DocsPath)
	if err != nil {
		return fmt.Errorf("failed to read docs file: %w", err)
	}

	// 2. Split into chunks by the "--------" separator (TLDraw's section divider)
	sections := strings.Split(string(raw), "--------")
	chunks := make([]Chunk, 0, len(sections))

	for i, section := range sections {
		section = strings.TrimSpace(section)
		if len(section) < 50 {
			continue // Skip tiny fragments
		}

		// Extract title from the first heading line
		title := fmt.Sprintf("Section_%d", i)
		lines := strings.SplitN(section, "\n", 5)
		for _, line := range lines {
			trimmed := strings.TrimSpace(line)
			if strings.HasPrefix(trimmed, "# ") {
				title = strings.TrimPrefix(trimmed, "# ")
				break
			}
		}

		// Truncate very long sections to ~2000 chars to keep embeddings focused
		content := section
		if len(content) > 2000 {
			content = content[:2000] + "\n... (truncated)"
		}

		chunks = append(chunks, Chunk{
			ID:      fmt.Sprintf("chunk_%d", i),
			Title:   title,
			Content: content,
		})
	}

	slog.Info("Split docs into chunks", "count", len(chunks))

	// 3. Compute embeddings in batches of 10
	batchSize := 10
	for i := 0; i < len(chunks); i += batchSize {
		end := i + batchSize
		if end > len(chunks) {
			end = len(chunks)
		}

		batch := chunks[i:end]
		texts := make([]string, 0, len(batch))
		for _, c := range batch {
			// Use title + first 500 chars for embedding
			text := strings.TrimSpace(c.Title + "\n" + c.Content)
			if len(text) > 500 {
				text = text[:500]
			}
			if len(text) > 0 {
				texts = append(texts, text)
			}
		}

		if len(texts) == 0 {
			continue
		}

		embeddings, err := callEmbeddingAPI(ctx, cfg, texts)
		if err != nil {
			return fmt.Errorf("embedding API call failed at batch %d: %w", i/batchSize, err)
		}

		for j, emb := range embeddings {
			chunks[i+j].Embedding = emb
		}

		slog.Info("Embedded batch", "batch", i/batchSize+1, "total_chunks", len(chunks))
	}

	// 4. Save to JSON
	output, err := json.MarshalIndent(chunks, "", "  ")
	if err != nil {
		return fmt.Errorf("failed to marshal chunks: %w", err)
	}

	if err := os.WriteFile(cfg.OutputPath, output, 0644); err != nil {
		return fmt.Errorf("failed to write output: %w", err)
	}

	slog.Info("Preprocessing complete", "output", cfg.OutputPath, "chunks", len(chunks))
	return nil
}

// callEmbeddingAPI calls the DashScope-compatible embedding API.
func callEmbeddingAPI(ctx context.Context, cfg PreprocessConfig, texts []string) ([][]float64, error) {
	reqBody := embeddingRequest{
		Model: cfg.EmbeddingModel,
		Input: texts,
	}

	bodyBytes, err := json.Marshal(reqBody)
	if err != nil {
		return nil, err
	}

	url := strings.TrimSuffix(cfg.BaseURL, "/") + "/embeddings"
	req, err := http.NewRequestWithContext(ctx, "POST", url, strings.NewReader(string(bodyBytes)))
	if err != nil {
		return nil, err
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+cfg.APIKey)

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("embedding API returned %d: %s", resp.StatusCode, string(respBody))
	}

	var embResp embeddingResponse
	if err := json.Unmarshal(respBody, &embResp); err != nil {
		return nil, fmt.Errorf("failed to parse embedding response: %w", err)
	}

	results := make([][]float64, len(texts))
	for _, emb := range embResp.Output.Embeddings {
		if emb.TextIndex < len(results) {
			results[emb.TextIndex] = emb.Embedding
		}
	}

	return results, nil
}
