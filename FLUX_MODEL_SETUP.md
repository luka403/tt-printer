# 🚀 Flux Model Setup

## Problem sa Stable Diffusion 1.5

Stable Diffusion 1.5 može generisati nedovršene/pixelated slike, posebno na CPU-u sa manje koraka.

## Rešenje: Flux Model

**Flux** je noviji i bolji model koji:
- ✅ Generiše kvalitetnije slike
- ✅ Bolje radi sa cartoon stilom
- ✅ Manje pixelated/artifacts
- ✅ Bolje završava slike

## Setup na Serveru

### 1. Promeni Model u `.env`

Na serveru, u `/tmp/tt-printer-image-api/.env`:

```env
# Promeni sa:
# IMAGE_MODEL=stable-diffusion-v1-5/stable-diffusion-v1-5

# Na:
IMAGE_MODEL=black-forest-labs/FLUX.1-dev
# Ili
IMAGE_MODEL=black-forest-labs/FLUX.1-schnell  # Brži ali manje kvalitetan
```

### 2. Ažuriraj Python Kod

U `image_api.py`, promeni pipeline:

```python
# Umesto:
from diffusers import StableDiffusionPipeline
_pipeline = StableDiffusionPipeline.from_pretrained(MODEL_ID, ...)

# Koristi:
from diffusers import DiffusionPipeline
_pipeline = DiffusionPipeline.from_pretrained(MODEL_ID, ...)
```

Flux koristi `DiffusionPipeline` umesto `StableDiffusionPipeline`.

### 3. Restart API

```bash
# Na serveru
systemctl restart image-api
# Ili
pkill -f image_api.py
python image_api.py
```

## Alternativni Modeli

### Flux.1-dev (Najbolji kvalitet)
- Model: `black-forest-labs/FLUX.1-dev`
- Kvalitet: ⭐⭐⭐⭐⭐
- Brzina: Sporije (~2-3 min po slici na CPU)

### Flux.1-schnell (Brži)
- Model: `black-forest-labs/FLUX.1-schnell`
- Kvalitet: ⭐⭐⭐⭐
- Brzina: Brže (~1-2 min po slici na CPU)

### Stable Diffusion XL (Srednji)
- Model: `stabilityai/stable-diffusion-xl-base-1.0`
- Kvalitet: ⭐⭐⭐⭐
- Brzina: Srednje (~1.5-2.5 min po slici na CPU)

## Testiranje

```bash
curl -X POST https://image.7-all.com/generate-image \
  -H "Content-Type: application/json" \
  -H "X-API-Key: tt-printer-secret-key-2025" \
  -d '{
    "prompt": "a dark room with a mysterious figure, cartoon style, detailed, high quality, complete image",
    "style": "simple_cartoon",
    "width": 512,
    "height": 512,
    "num_inference_steps": 30,
    "negative_prompt": "blurry, low quality, incomplete, unfinished, pixelated"
  }'
```

## Poređenje

| Model | Kvalitet | Brzina | RAM |
|-------|----------|--------|-----|
| SD 1.5 | ⭐⭐⭐ | ⚡⚡⚡ | 8GB |
| SD XL | ⭐⭐⭐⭐ | ⚡⚡ | 12GB |
| Flux.1-schnell | ⭐⭐⭐⭐ | ⚡⚡ | 10GB |
| Flux.1-dev | ⭐⭐⭐⭐⭐ | ⚡ | 16GB |

## Preporuka

Za tvoj setup (8 vCPU, 16GB RAM):
- **Flux.1-schnell** - dobar balans kvaliteta i brzine
- **SD XL** - ako Flux zauzme previše RAM-a








