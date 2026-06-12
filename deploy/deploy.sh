#!/bin/bash
set -e

echo "============================================="
echo "   VoiceCanvas Linux Deployment Script       "
echo "============================================="
echo ""
echo "Please select a deployment method:"
echo "  1. Deploy using Docker (Recommended)"
echo "  2. Deploy Manually (Requires Go & Node.js)"
echo ""
read -p "Enter your choice (1 or 2): " OPTION

if [ "$OPTION" = "1" ]; then
    echo ""
    echo ">>> Starting Docker deployment..."
    
    if ! command -v docker &> /dev/null; then
        echo "Error: docker is not installed. Please install Docker first."
        exit 1
    fi

    # Check for docker-compose or docker compose
    if command -v docker-compose &> /dev/null; then
        docker-compose up -d --build
    elif docker compose version &> /dev/null; then
        docker compose up -d --build
    else
        echo "Error: docker-compose plugin is not installed."
        exit 1
    fi

    echo ""
    echo "✅ Docker deployment started successfully!"
    echo "🌐 Access the frontend at: http://localhost"
    echo "🔌 Backend WebSocket at: ws://localhost:8080/ws"

elif [ "$OPTION" = "2" ]; then
    echo ""
    echo ">>> Starting Manual Build Process..."
    
    if ! command -v go &> /dev/null; then
        echo "❌ Error: Go is not installed."
        exit 1
    fi
    if ! command -v npm &> /dev/null; then
        echo "❌ Error: Node.js/npm is not installed."
        exit 1
    fi
    
    echo ""
    echo "📦 Building Backend..."
    cd backend
    go build -o voice-canvas-backend main.go
    cd ..
    
    echo ""
    echo "📦 Building Frontend..."
    cd frontend
    npm install
    npm run build
    cd ..
    
    echo ""
    echo "✅ Manual build complete!"
    echo ""
    echo "To run the services, you will need two terminals:"
    echo "  Terminal 1 (Backend):"
    echo "    cd backend"
    echo "    export DASHSCOPE_API_KEY=\"your_key_here\""
    echo "    ./voice-canvas-backend"
    echo ""
    echo "  Terminal 2 (Frontend - Dev Mode):"
    echo "    cd frontend"
    echo "    npm run dev"
    echo ""
    echo "Note: For production manual deployment, serve the 'frontend/dist' folder using Nginx."
else
    echo "❌ Invalid option."
    exit 1
fi
