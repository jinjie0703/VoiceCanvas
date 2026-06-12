package agent

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
)

// getQueryEmbedding calls the DashScope embedding API for a single query string.
func getQueryEmbedding(ctx context.Context, cfg EmbeddingConfig, query string) ([]float64, error) {
	type embReq struct {
		Model string `json:"model"`
		Input struct {
			Texts []string `json:"texts"`
		} `json:"input"`
	}

	reqBody := embReq{Model: cfg.Model}
	reqBody.Input.Texts = []string{query}

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

	var embResp struct {
		Output struct {
			Embeddings []struct {
				Embedding []float64 `json:"embedding"`
			} `json:"embeddings"`
		} `json:"output"`
	}

	if err := json.Unmarshal(respBody, &embResp); err != nil {
		return nil, err
	}

	if len(embResp.Output.Embeddings) == 0 {
		return nil, fmt.Errorf("no embeddings returned")
	}

	return embResp.Output.Embeddings[0].Embedding, nil
}
