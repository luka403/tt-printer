# 🚀 Python LLM API - Quick Start

## 1. Instaliraj dependencies:
```bash
cd server
pip install -r requirements.txt
```

## 2. Kreiraj .env fajl:
```bash
cp env.example .env
# Uredi .env i promeni API_KEY!
```

## 3. Pokreni server:
```bash
python llm_api.py
```

Ili koristi start.sh:
```bash
./start.sh
```

---

## 🔑 API Key

**VAŽNO:** Promeni `API_KEY` u `.env` fajlu!

Primer:
```env
API_KEY=moj-super-tajni-kljuc-12345
```

---

## 📡 Testiranje

### Health check:
```bash
curl http://localhost:8000/health
```

### Chat completions:
```bash
curl http://localhost:8000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "X-API-Key: tt-printer-secret-key-2025" \
  -d '{
    "model": "llama3.1:8b",
    "messages": [
      {"role": "user", "content": "Write a scary story"}
    ]
  }'
```

---

## 🔧 Konfiguracija u Node.js

Kada eksponuješ Python API na port, ažuriraj `.env`:

```env
LLM_API_URL=http://TVOJ-SERVER-IP:8000/v1
LLM_API_KEY=tt-printer-secret-key-2025
LLM_MODEL=llama3.1:8b
```

---

## 🐳 Docker (Opciono)

```bash
docker build -t llm-api .
docker run -p 8000:8000 --env-file .env llm-api
```

---

## ⚙️ Systemd Service

Vidi `README.md` za detalje.










