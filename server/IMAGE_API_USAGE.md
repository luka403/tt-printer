# 🎨 Image Generation API - Uputstvo

## 🚀 Pokretanje API-ja

### 1. Instaliraj dependencies
```bash
cd server
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

### 2. Konfiguriši environment
```bash
cp env.example .env
# Uredi .env i postavi:
# IMAGE_MODEL=stable-diffusion-v1-5/stable-diffusion-v1-5
# IMAGE_API_PORT=8001
# API_KEY=tt-printer-secret-key-2025
```

### 3. Pokreni API
```bash
./start_image_api.sh
```

Ili ručno:
```bash
source venv/bin/activate
python image_api.py
```

**Prvo pokretanje** će preuzeti model (~4GB) ako nije već skinut lokalno.

---

## 📡 API Endpoints

### Health Check
```bash
curl http://localhost:8001/health
```

### Generate Image (Custom Prompt)

**POST** `/generate-image`

**Headers:**
```
Content-Type: application/json
X-API-Key: tt-printer-secret-key-2025
```

**Body:**
```json
{
  "prompt": "a dark room with a mysterious figure in the corner, cartoon style",
  "style": "simple_cartoon",
  "negative_prompt": "blurry, low quality",
  "num_inference_steps": 25,
  "width": 1024,
  "height": 1024,
  "seed": 42
}
```

**Response:**
```json
{
  "image_path": "/path/to/generated_images/uuid.png",
  "image_url": "/images/uuid.png",
  "prompt": "simple cartoon style, clean lines, vibrant colors, a dark room...",
  "seed": 42
}
```

**Primer poziva:**
```bash
curl -X POST http://localhost:8001/generate-image \
  -H "Content-Type: application/json" \
  -H "X-API-Key: tt-printer-secret-key-2025" \
  -d '{
    "prompt": "a scary abandoned house at night, cartoon style, dark atmosphere",
    "style": "simple_cartoon",
    "width": 1024,
    "height": 1024,
    "num_inference_steps": 25
  }'
```

### Download Generated Image
```bash
curl http://localhost:8001/images/{filename} -o image.png
```

---

## 🎨 Parametri

### `prompt` (required)
- Tekstualni opis slike koji želiš da generišeš
- Može biti bilo šta: "a scary room", "a person walking", itd.
- API automatski dodaje style keywords na osnovu `style` parametra

### `style` (optional, default: "simple_cartoon")
- `simple_cartoon` - Jednostavan cartoon stil
- `anime` - Anime stil
- `western_cartoon` - Zapadni cartoon (Disney/Pixar)
- `comic_book` - Strip stil
- `default` - Osnovni stil

### `negative_prompt` (optional)
- Šta NE želiš u slici
- Default: "blurry, low quality, distorted, ugly, bad anatomy, watermark"

### `num_inference_steps` (optional, default: 20)
- Broj koraka za generisanje (više = bolje kvalitet, sporije)
- Preporuka: 20-30 za CPU, 30-50 za GPU

### `width` / `height` (optional, default: 512)
- Dimenzije slike
- Preporuka: 512, 768, ili 1024
- Veće dimenzije = više RAM-a i sporije generisanje

### `seed` (optional)
- Seed za reproduktivnost
- Isti seed = ista slika (ako su ostali parametri isti)

---

## 🔧 Lokalni Model

Ako si skinuo model lokalno, možeš koristiti lokalnu putanju:

U `.env`:
```env
IMAGE_MODEL=/path/to/your/local/model
```

Ili koristi Hugging Face cache (automatski):
```env
IMAGE_MODEL=stable-diffusion-v1-5/stable-diffusion-v1-5
```

---

## 💡 Primeri Promptova

### Scary Stories
```json
{
  "prompt": "a dark abandoned house at midnight, foggy atmosphere, eerie shadows",
  "style": "simple_cartoon"
}
```

```json
{
  "prompt": "a person looking in a mirror, but reflection is different, horror atmosphere",
  "style": "simple_cartoon"
}
```

### General
```json
{
  "prompt": "a beautiful sunset over mountains, peaceful scene",
  "style": "simple_cartoon"
}
```

---

## ⚡ Performance

- **CPU**: ~30-60 sekundi po slici (512x512)
- **GPU**: ~5-15 sekundi po slici
- **Memory**: ~8-12GB RAM potrebno
- **First Run**: Preuzima model (~4GB) ako nije lokalno

---

## 🔒 Sigurnost

- API key se proverava u `X-API-Key` headeru
- Promeni `API_KEY` u `.env` pre produkcije!
- Za produkciju, koristi HTTPS (Nginx reverse proxy sa SSL)









