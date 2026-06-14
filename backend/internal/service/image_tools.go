package service

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"net/url"
	"os"
	"strings"
	"time"
)

// GenerateWanxImage calls DashScope's Wanx model to generate an image
func GenerateWanxImage(ctx context.Context, prompt string) (string, error) {
	apiKey := os.Getenv("DASHSCOPE_API_KEY")
	if apiKey == "" {
		return "", fmt.Errorf("DASHSCOPE_API_KEY is not set")
	}

	modelName := os.Getenv("IMAGE_MODEL")
	if modelName == "" {
		modelName = "wanx-v1"
	}

	reqBody := map[string]interface{}{
		"model": modelName,
		"input": map[string]interface{}{
			"prompt": prompt,
		},
		"parameters": map[string]interface{}{
			"style": "<auto>",
			"size":  "1024*1024",
			"n":     1,
		},
	}
	reqBytes, _ := json.Marshal(reqBody)

	// 1. Submit async task
	req, err := http.NewRequestWithContext(ctx, "POST", "https://dashscope.aliyuncs.com/api/v1/services/aigc/text2image/image-synthesis", bytes.NewBuffer(reqBytes))
	if err != nil {
		return "", err
	}
	req.Header.Set("X-DashScope-Async", "enable")
	req.Header.Set("Authorization", "Bearer "+apiKey)
	req.Header.Set("Content-Type", "application/json")

	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return "", fmt.Errorf("wanx submit error: %w", err)
	}
	defer resp.Body.Close()

	var submitRes struct {
		Output struct {
			TaskID     string `json:"task_id"`
			TaskStatus string `json:"task_status"`
		} `json:"output"`
		Message string `json:"message"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&submitRes); err != nil {
		return "", fmt.Errorf("wanx decode error: %w", err)
	}

	if submitRes.Output.TaskID == "" {
		return "", fmt.Errorf("wanx failed to get task id, msg: %s", submitRes.Message)
	}

	taskID := submitRes.Output.TaskID
	slog.Info("Wanx image task submitted", "task_id", taskID)

	// 2. Poll for completion
	pollClient := &http.Client{Timeout: 5 * time.Second}
	for i := 0; i < 30; i++ {
		time.Sleep(2 * time.Second)
		pollReq, _ := http.NewRequestWithContext(ctx, "GET", "https://dashscope.aliyuncs.com/api/v1/tasks/"+taskID, nil)
		pollReq.Header.Set("Authorization", "Bearer "+apiKey)

		pResp, err := pollClient.Do(pollReq)
		if err != nil {
			continue
		}

		var taskRes struct {
			Output struct {
				TaskStatus string `json:"task_status"`
				Results    []struct {
					URL string `json:"url"`
				} `json:"results"`
			} `json:"output"`
		}
		
		bodyBytes, _ := io.ReadAll(pResp.Body)
		pResp.Body.Close()
		json.Unmarshal(bodyBytes, &taskRes)

		if taskRes.Output.TaskStatus == "SUCCEEDED" {
			if len(taskRes.Output.Results) > 0 {
				return taskRes.Output.Results[0].URL, nil
			}
			return "", fmt.Errorf("wanx succeeded but no url returned")
		} else if taskRes.Output.TaskStatus == "FAILED" || taskRes.Output.TaskStatus == "CANCELED" {
			return "", fmt.Errorf("wanx task failed or canceled")
		}
		// PENDING or RUNNING, continue loop
	}

	return "", fmt.Errorf("wanx task timed out")
}

// SearchWikiImage uses the Wikipedia Media API to find an image url for a given keyword
func SearchWikiImage(ctx context.Context, keyword string) (string, error) {
	searchURL := fmt.Sprintf("https://en.wikipedia.org/w/api.php?action=query&generator=search&gsrsearch=%s&gsrnamespace=6&prop=imageinfo&iiprop=url&format=json", url.QueryEscape(keyword))
	
	req, err := http.NewRequestWithContext(ctx, "GET", searchURL, nil)
	if err != nil {
		return "", err
	}
	req.Header.Set("User-Agent", "VoiceCanvas/1.0 (test)")

	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return "", fmt.Errorf("wiki request failed: %w", err)
	}
	defer resp.Body.Close()

	var res struct {
		Query struct {
			Pages map[string]struct {
				Title     string `json:"title"`
				Imageinfo []struct {
					URL string `json:"url"`
				} `json:"imageinfo"`
			} `json:"pages"`
		} `json:"query"`
	}

	if err := json.NewDecoder(resp.Body).Decode(&res); err != nil {
		return "", err
	}

	for _, page := range res.Query.Pages {
		if len(page.Imageinfo) > 0 {
			url := page.Imageinfo[0].URL
			// Ignore PDFs
			if !strings.HasSuffix(strings.ToLower(url), ".pdf") {
				return url, nil
			}
		}
	}

	return "", fmt.Errorf("no images found in wiki search")
}
