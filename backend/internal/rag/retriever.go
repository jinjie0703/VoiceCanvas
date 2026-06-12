package rag

import (
	"encoding/json"
	"math"
	"os"
	"sort"
	"strings"
)

// Chunk represents a single documentation chunk with its embedding vector.
type Chunk struct {
	ID        string    `json:"id"`
	Title     string    `json:"title"`
	Content   string    `json:"content"`
	Embedding []float64 `json:"embedding"`
}

// Retriever performs similarity search over pre-computed document embeddings.
type Retriever struct {
	chunks []Chunk
}

// NewRetriever loads pre-computed embeddings from a JSON file.
func NewRetriever(embeddingsPath string) (*Retriever, error) {
	data, err := os.ReadFile(embeddingsPath)
	if err != nil {
		return nil, err
	}

	var chunks []Chunk
	if err := json.Unmarshal(data, &chunks); err != nil {
		return nil, err
	}

	return &Retriever{chunks: chunks}, nil
}

// SearchResult holds a chunk and its relevance score.
type SearchResult struct {
	Chunk Chunk
	Score float64
}

// Search returns the top-K most relevant chunks for the given query embedding.
func (r *Retriever) Search(queryEmbedding []float64, topK int) []SearchResult {
	results := make([]SearchResult, 0, len(r.chunks))

	for _, chunk := range r.chunks {
		score := cosineSimilarity(queryEmbedding, chunk.Embedding)
		results = append(results, SearchResult{Chunk: chunk, Score: score})
	}

	sort.Slice(results, func(i, j int) bool {
		return results[i].Score > results[j].Score
	})

	if topK > len(results) {
		topK = len(results)
	}
	return results[:topK]
}

// FormatContext formats search results into a string for LLM context injection.
func FormatContext(results []SearchResult) string {
	var sb strings.Builder
	sb.WriteString("=== TLDraw API Reference (Retrieved Context) ===\n\n")
	for i, r := range results {
		sb.WriteString("--- Section ")
		sb.WriteString(strings.Repeat("-", 1))
		sb.WriteString(" ")
		sb.WriteString(r.Chunk.Title)
		sb.WriteString(" ---\n")
		sb.WriteString(r.Chunk.Content)
		if i < len(results)-1 {
			sb.WriteString("\n\n")
		}
	}
	return sb.String()
}

// cosineSimilarity calculates the cosine similarity between two vectors.
func cosineSimilarity(a, b []float64) float64 {
	if len(a) != len(b) || len(a) == 0 {
		return 0
	}

	var dotProduct, normA, normB float64
	for i := range a {
		dotProduct += a[i] * b[i]
		normA += a[i] * a[i]
		normB += b[i] * b[i]
	}

	denominator := math.Sqrt(normA) * math.Sqrt(normB)
	if denominator == 0 {
		return 0
	}
	return dotProduct / denominator
}
