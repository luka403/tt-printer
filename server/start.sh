#!/bin/bash
# Quick start script for Python LLM API

echo "🚀 Starting Ollama LLM API Server..."

# Check if .env exists
if [ ! -f .env ]; then
    echo "📝 Creating .env from example..."
    cp env.example .env
    echo "⚠️  Don't forget to change API_KEY in .env!"
fi

# Check if dependencies are installed
if [ ! -d "venv" ]; then
    echo "📦 Creating virtual environment..."
    python3 -m venv venv
    source venv/bin/activate
    echo "📥 Installing dependencies..."
    pip install -r requirements.txt
else
    source venv/bin/activate
fi

# Load environment variables
export $(cat .env | grep -v '^#' | xargs)

# Start server
echo "🎯 Starting server on port ${PORT:-8000}..."
python llm_api.py










