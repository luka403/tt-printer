# 🎨 Image API Setup - mage.7-all.com

## ✅ Server je spreman!

Tvoj Image API je exposovan na: **https://mage.7-all.com**

---

## 🔧 Konfiguracija

### 1. Postavi Environment Variable

U tvom lokalnom projektu, u `.env` fajlu:

```env
IMAGE_API_URL=https://mage.7-all.com
IMAGE_API_KEY=tt-printer-secret-key-2025
```

**Napomena:** Proveri da li je API key isti kao na serveru!

---

### 2. Proveri da li API radi

```bash
# Health check
curl https://mage.7-all.com/health

# Trebalo bi da vidiš:
# {"status":"ok","model":"...","device":"cpu","model_loaded":false}
```

---

### 3. Test generisanje slike

```bash
curl -X POST https://mage.7-all.com/generate-image \
  -H "Content-Type: application/json" \
  -H "X-API-Key: tt-printer-secret-key-2025" \
  -d '{
    "prompt": "test image, simple cartoon style",
    "style": "simple_cartoon",
    "width": 512,
    "height": 512
  }'
```

---

## 🚀 Pokreni Projekt

```bash
npm start
```

VideoAgent će automatski koristiti API na `mage.7-all.com`! 🎉

---

## 🔍 Troubleshooting

### Problem: "Connection refused" ili "ECONNREFUSED"

**Rešenje:**
- Proveri da li je URL tačan: `https://mage.7-all.com` (sa `https://`)
- Proveri da li API radi: `curl https://mage.7-all.com/health`

### Problem: "401 Unauthorized"

**Rešenje:**
- Proveri da li je `IMAGE_API_KEY` isti kao na serveru
- Proveri da li API zahteva drugi header format

### Problem: "SSL Certificate" greške

**Rešenje:**
- Kod već koristi `rejectUnauthorized: false` za HTTPS, tako da bi trebalo da radi
- Ako i dalje ima problema, proveri SSL sertifikat na serveru

---

## 📝 Provera u Kodu

Kod već podržava:
- ✅ HTTPS (koristi `httpsAgent`)
- ✅ Custom API URL (preko `IMAGE_API_URL`)
- ✅ Custom API Key (preko `IMAGE_API_KEY`)
- ✅ Download generisanih slika

Sve je spremno! 🎯









