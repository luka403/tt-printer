# 🎨 Image Generation - Šta je urađeno i kako da koristiš

## 📋 Šta sam uradio:

### 1. **Python FastAPI Server** (`server/image_api.py`)
   - ✅ **OVO SE POKREĆE NA TVOM SERVERU** (gde imaš Stable Diffusion)
   - ✅ FastAPI server koji prima HTTP zahteve
   - ✅ Generiše slike koristeći Stable Diffusion model
   - ✅ Endpoint: `POST /generate-image`
   - ✅ Port: 8001 (možeš promeniti)

### 2. **TypeScript Wrapper** (`core/image_generator.ts`)
   - ✅ **OVO JE OVDE LOKALNO** (u tvom projektu)
   - ✅ Poziva Python API preko HTTP
   - ✅ Slično kao što `RemoteKokoroTTS` poziva TTS API
   - ✅ Koristi se u `VideoAgent`

### 3. **VideoAgent Integration** (`agents/video/index.ts`)
   - ✅ Koristi `RemoteImageGenerator` da generiše slike
   - ✅ Automatski poziva API kada generiše video

---

## 🚀 Kako da pokreneš:

### KORAK 1: Na TVOM SERVERU (gde imaš Stable Diffusion)

```bash
# 1. Kopiraj image_api.py na server
scp server/image_api.py user@tvoj-server:/path/to/server/
scp server/requirements.txt user@tvoj-server:/path/to/server/
scp server/start_image_api.sh user@tvoj-server:/path/to/server/

# 2. Na serveru, instaliraj dependencies
cd /path/to/server
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# 3. Konfiguriši .env
cat > .env << EOF
API_KEY=tt-printer-secret-key-2025
IMAGE_MODEL=stable-diffusion-v1-5/stable-diffusion-v1-5
IMAGE_API_PORT=8001
IMAGE_OUTPUT_DIR=./generated_images
EOF

# 4. Pokreni API server
python image_api.py
# Ili kao systemd service (kao što imaš za LLM API)
```

**API će biti dostupan na:** `http://tvoj-server:8001`

---

### KORAK 2: OVDE LOKALNO (u tvom projektu)

```bash
# 1. Postavi environment variable da pokazuje na tvoj server
cat >> .env << EOF
IMAGE_API_URL=http://tvoj-server:8001
IMAGE_API_KEY=tt-printer-secret-key-2025
EOF

# 2. Pokreni normalno
npm start
```

**TypeScript kod će automatski pozivati API na tvom serveru!**

---

## 🔄 Kako funkcioniše:

```
┌─────────────────┐
│  VideoAgent     │  (ovde lokalno)
│  (TypeScript)   │
└────────┬────────┘
         │
         │ poziva
         ▼
┌─────────────────┐
│ ImageGenerator  │  (ovde lokalno)
│  (TypeScript)   │
└────────┬────────┘
         │
         │ HTTP POST
         ▼
┌─────────────────┐
│  Image API      │  (NA TVOM SERVERU)
│  (Python)       │
└────────┬────────┘
         │
         │ koristi
         ▼
┌─────────────────┐
│ Stable Diffusion│  (NA TVOM SERVERU)
│     Model       │
└─────────────────┘
```

---

## 📝 Primer:

### Na serveru:
```bash
# Server pokreće Python API
python image_api.py
# API radi na http://server:8001
```

### Lokalno:
```bash
# .env fajl
IMAGE_API_URL=http://tvoj-server:8001

# Pokreni projekt
npm start

# VideoAgent automatski poziva:
# http://tvoj-server:8001/generate-image
```

---

## ✅ Provera da li radi:

### 1. Testiraj API na serveru:
```bash
curl http://tvoj-server:8001/health
```

### 2. Testiraj generisanje slike:
```bash
curl -X POST http://tvoj-server:8001/generate-image \
  -H "Content-Type: application/json" \
  -H "X-API-Key: tt-printer-secret-key-2025" \
  -d '{
    "prompt": "test image",
    "style": "simple_cartoon"
  }'
```

### 3. Ako radi, pokreni lokalno:
```bash
npm start
```

---

## 🎯 Rezime:

- **Python API** = na serveru (gde imaš Stable Diffusion)
- **TypeScript wrapper** = ovde lokalno (poziva remote API)
- **VideoAgent** = koristi wrapper da generiše slike

**Sve je spremno, samo treba da:**
1. Pokreneš Python API na serveru
2. Postaviš `IMAGE_API_URL` u `.env` da pokazuje na server
3. Pokreneš projekt normalno









