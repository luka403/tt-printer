# ⚡ Quick Setup - Image API na mage.7-all.com

## ✅ Server je spreman!

Tvoj Image API radi na: **https://mage.7-all.com**

---

## 🔧 Postavi u .env

Kreiraj `.env` fajl u root direktorijumu projekta:

```bash
cat > .env << EOF
# Image Generation API
IMAGE_API_URL=https://mage.7-all.com
IMAGE_API_KEY=tt-printer-secret-key-2025

# LLM API (ako već nije postavljeno)
LLM_API_URL=https://llama.7-all.com/v1
LLM_API_KEY=tt-printer-key_key-key

# TTS API (ako već nije postavljeno)
KOKORO_TTS_URL=https://tts.7-all.com
EOF
```

**VAŽNO:** Proveri da li je `IMAGE_API_KEY` isti kao na serveru!

---

## ✅ Test

```bash
# Proveri da li API radi
curl https://mage.7-all.com/health
```

Trebalo bi da vidiš:
```json
{"status":"ok","model":"...","device":"cpu","model_loaded":false}
```

---

## 🚀 Pokreni

```bash
npm start
```

Sve je spremno! VideoAgent će automatski koristiti API na `mage.7-all.com` 🎉

---

## 🔍 Ako ne radi

1. Proveri da li je URL tačan u `.env`
2. Proveri da li API key odgovara serveru
3. Proveri da li API radi: `curl https://mage.7-all.com/health`









