#!/bin/bash
# Quick start script for Python Image Generation API

echo "🚀 Starting Image Generation API Server..."

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
    echo "📥 Installing dependencies (this may take a while, especially for PyTorch)..."
    pip install -r requirements.txt
else
    source venv/bin/activate
fi


# Load environment variables
export $(cat .env | grep -v '^#' | xargs)

# Start server
echo "🎯 Starting Image Generation API on port ${IMAGE_API_PORT:-8001}..."
echo "⚠️  First run will download Stable Diffusion model (~4GB), this may take time!"
python image_api.py



curl -X POST https://image.7-all.com/generate-image \
  -H "Content-Type: application/json" \
  -H "X-API-Key: tt-printer-secret-key-2025" \
  -d '{
    "prompt": "dog with a red hat",
    "style": "simple_cartoon",
    "width": 256,
    "height": 256,
    "num_inference_steps": 30
  }' \
  --max-time 300 \
  -v

EOF

