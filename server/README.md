# 🚀 Python LLM API Server Setup

## 📋 Instalacija

### 1. Instaliraj Python dependencies:
```bash
cd server
pip install -r requirements.txt
```

### 2. Konfiguriši environment:
```bash
cp .env.example .env
# Uredi .env i promeni API_KEY na nešto sigurno!
```

### 3. Pokreni server:
```bash
python llm_api.py
```

Ili sa uvicorn direktno:
```bash
uvicorn llm_api:app --host 0.0.0.0 --port 8000
```

---

## 🔑 API Key

**VAŽNO:** Promeni `API_KEY` u `.env` fajlu na nešto sigurno!

Primer:
```env
API_KEY=moj-super-tajni-kljuc-12345
```

---

## 📡 Endpoints

### Health Check
```bash
curl http://localhost:8000/health
```

### List Models
```bash
curl http://localhost:8000/v1/models \
  -H "X-API-Key: tt-printer-secret-key-2025"
```

### Chat Completions
```bash
curl http://localhost:8000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "X-API-Key: tt-printer-secret-key-2025" \
  -d '{
    "model": "llama3.1:8b",
    "messages": [
      {"role": "user", "content": "Write a scary story"}
    ],
    "temperature": 0.7
  }'
```

---

## 🎨 Image Generation API

### Setup

Image Generation API koristi Stable Diffusion za generisanje slika u cartoon stilu.

**VAŽNO:** Prvo pokretanje će preuzeti Stable Diffusion model (~4GB), što može potrajati.

```bash
# Pokreni Image API
./start_image_api.sh
```

Ili ručno:
```bash
cd server
source venv/bin/activate
python image_api.py
```

### Endpoints

#### Health Check
```bash
curl http://localhost:8001/health
```

#### Generate Image
```bash
curl http://localhost:8001/generate-image \
  -H "Content-Type: application/json" \
  -H "X-API-Key: tt-printer-secret-key-2025" \
  -d '{
    "prompt": "a dark room with a mysterious figure",
    "style": "simple_cartoon",
    "width": 512,
    "height": 512,
    "num_inference_steps": 20
  }'
```

### Performance Notes

- **CPU Mode**: Generisanje slike na CPU može potrajati 30-60 sekundi po slici
- **Memory**: Model zahteva ~8-12GB RAM
- **First Run**: Prvo pokretanje preuzima model (~4GB), može potrajati 10-20 minuta

### Configuration

U `.env` fajlu:
```env
IMAGE_API_PORT=8001
IMAGE_MODEL=runwayml/stable-diffusion-v1-5
IMAGE_OUTPUT_DIR=./generated_images
```

---

## 🔒 Sigurnost

- API key se proverava u `X-API-Key` headeru
- Promeni `API_KEY` u `.env` pre produkcije!
- Za produkciju, koristi HTTPS (Nginx reverse proxy sa SSL)

---

## 🐳 Docker (Opciono)

```dockerfile
FROM python:3.11-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install -r requirements.txt
COPY . .
CMD ["uvicorn", "llm_api:app", "--host", "0.0.0.0", "--port", "8000"]
```

---

## ⚙️ Systemd Service (Opciono)

Kreiraj `/etc/systemd/system/llm-api.service`:
```ini
[Unit]
Description=Ollama LLM API
After=network.target

[Service]
Type=simple
User=www-data
WorkingDirectory=/path/to/server
Environment="PATH=/usr/bin:/usr/local/bin"
ExecStart=/usr/bin/python3 /path/to/server/llm_api.py
Restart=always

[Install]
WantedBy=multi-user.target
```

Zatim:
```bash
sudo systemctl enable llm-api
sudo systemctl start llm-api
```


