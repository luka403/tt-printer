# 🚀 Quick Setup Guide - Remote LLM API

## 📋 Koraci na Serveru

### 1. Instaliraj Ollama
```bash
curl -fsSL https://ollama.com/install.sh | sh
ollama pull llama3.1:8b
sudo systemctl enable ollama
sudo systemctl start ollama
```

### 2. Expose API (izaberi jednu opciju)

**OPCIJA A: Direktno (brzo)**
```bash
# U ~/.ollama/config ili environment
OLLAMA_HOST=0.0.0.0:11434
sudo systemctl restart ollama
sudo ufw allow 11434/tcp
```

**OPCIJA B: Nginx Reverse Proxy (preporučeno)**
- Vidi `SERVER_SETUP.md` za detaljna uputstva
- Kreiraj `/etc/nginx/sites-available/ollama-api`
- Enable i restart Nginx

### 3. Testiraj
```bash
curl http://TVOJ-SERVER-IP/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{"model":"llama3.1:8b","messages":[{"role":"user","content":"Hello"}]}'
```

---

## 📝 Kada Završiš, Javi Mi:

1. **API URL:** `http://IP/v1` ili `https://domen.com/v1`
2. **Model:** `llama3.1:8b` (ili koji koristiš)
3. **Autentifikacija:** Da li imaš API key ili Basic Auth?

---

## 🔧 Ažuriranje Koda (Kada Mi Kažeš URL)

### 1. Ažuriraj `.env`:
```env
LLM_API_URL=http://TVOJ-SERVER-IP/v1
LLM_MODEL=llama3.1:8b
LLM_API_KEY=ollama  # Ili tvoj API key ako imaš auth
```

### 2. Testiraj:
```bash
npm run test:llm
```

### 3. Pokreni pipeline:
```bash
npm start
```

---

## ✅ Sve je Spremno!

Tvoj kod već podržava remote API. Samo promeni URL u `.env` i radi! 🎉










