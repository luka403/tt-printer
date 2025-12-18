#!/bin/bash
# Test sa poboljšanim promptovima

echo "🎨 Testing with improved prompts..."
echo ""

curl -X POST https://image.7-all.com/generate-image \
  -H "Content-Type: application/json" \
  -H "X-API-Key: tt-printer-secret-key-2025" \
  -d '{
    "prompt": "cartoon style, clean lines, vibrant colors, dark mood, eerie atmosphere, detailed, high quality, complete image, finished artwork, a dark room with a mysterious figure in the corner",
    "style": "simple_cartoon",
    "width": 512,
    "height": 512,
    "num_inference_steps": 30,
    "negative_prompt": "blurry, low quality, incomplete, unfinished, pixelated, low resolution, corrupted, glitch, artifacts, noise, grainy, out of focus"
  }' \
  --max-time 600 \
  -w "\n\n⏱️  Time: %{time_total}s\n📊 Status: %{http_code}\n" \
  | jq '.' 2>/dev/null || cat

echo ""
echo "✅ Done!"

