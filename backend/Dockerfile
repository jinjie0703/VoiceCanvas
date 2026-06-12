FROM golang:1.22-alpine AS builder

WORKDIR /app

# Enable CGO if needed, else set to 0
ENV CGO_ENABLED=0
ENV GOOS=linux

# Cache dependencies
COPY go.mod go.sum ./
RUN go mod download

# Build the binary
COPY . .
RUN go build -o main .

FROM alpine:latest

WORKDIR /app

# Install CA certificates for HTTPS requests
RUN apk --no-cache add ca-certificates

# Copy the binary and necessary files
COPY --from=builder /app/main .
COPY --from=builder /app/.env.example ./.env.example

# Copy data folder if it exists (for RAG embeddings)
# We use a wildcard to avoid failure if the directory is missing
COPY --from=builder /app/data* ./data/

EXPOSE 8080

CMD ["./main"]
