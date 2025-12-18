#!/bin/bash
# Test curl komanda za generisanje slike

echo "🎨 Testing Image Generation API..."
echo ""

# Brza verzija (256x256, 10 koraka) - brže generisanje
curl -X POST https://image.7-all.com/generate-image \
  -H "Content-Type: application/json" \
  -H "X-API-Key: tt-printer-secret-key-2025" \
  -d '{
    "prompt": "a dark room with a mysterious figure, simple cartoon style",
    "style": "simple_cartoon",
    "width": 256,
    "height": 256,
    "num_inference_steps": 10
  }' \
  --max-time 300 \
  -w "\n\n⏱️  Time: %{time_total}s\n📊 Status: %{http_code}\n"

echo ""
echo "✅ Done! Check response above for image_url"









