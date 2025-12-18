# 🚀 Quick Start - Image API sa Lokalnim Modelom

## 📦 Korak 1: Kopiraj Fajlove na Server

```bash
# Uredi skriptu sa tvojim server podacima
nano copy_to_server.sh

# Pokreni (prvi parametar = user, drugi = host)
./copy_to_server.sh root tvoj-server.com
# ili
./copy_to_server.sh ubuntu 192.168.1.100
```

Fajlovi će biti kopirani u `/tmp/tt-printer-image-api/` na serveru.

---

## 🔧 Korak 2: Na Serveru - Setup

```bash
# SSH na server
ssh user@tvoj-server.com

# Idi u tmp direktorijum
cd /tmp/tt-printer-image-api

# Instaliraj dependencies
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

---

## 📁 Korak 3: Pronađi Lokalni Model

Ako si skinuo model sa Hugging Face, nađi gde je:

### Opcija A: Hugging Face Cache
```bash
# Model je verovatno ovde:
ls ~/.cache/huggingface/hub/models--stable-diffusion-v1-5--stable-diffusion-v1-5--snapshots/

# Ili:
find ~ -name "model_index.json" | grep stable-diffusion
```

### Opcija B: Custom Lokacija
Ako si skinuo model u specifičnu lokaciju:
```bash
ls /path/to/your/stable-diffusion-v1-5/
# Trebalo bi da vidiš: model_index.json, unet/, vae/, text_encoder/
```

---

## ⚙️ Korak 4: Konfiguriši .env

```bash
cd /tmp/tt-printer-image-api
cp env.example .env
nano .env
```

**Postavi:**
```env
API_KEY=tt-printer-secret-key-2025
IMAGE_API_PORT=8001
IMAGE_OUTPUT_DIR=./generated_images

# Ako je model u custom lokaciji:
IMAGE_MODEL=/path/to/your/stable-diffusion-v1-5

# ILI ako je u Hugging Face cache:
IMAGE_MODEL=stable-diffusion-v1-5/stable-diffusion-v1-5
```

---

## 🎯 Korak 5: Pokreni API

```bash
source venv/bin/activate
python image_api.py
```

Trebalo bi da vidiš:
```
🚀 Starting Image Generation API on port 8001...
📦 Model: /path/to/your/model
💻 Device: cpu
```

**Prvi zahtev** će učitati model (može potrajati 1-2 minuta).

---

## ✅ Korak 6: Testiraj

```bash
# U drugom terminalu na serveru
curl http://localhost:8001/health

# Trebalo bi da vidiš:
# {"status":"ok","model":"...","device":"cpu","model_loaded":false}
```

---

## 🔗 Korak 7: Exposuj API (Opciono)

Ako želiš da API bude dostupan sa drugih mašina:

### Opcija A: Firewall
```bash
# Otvori port 8001
sudo ufw allow 8001
```

### Opcija B: Nginx Reverse Proxy
```nginx
server {
    listen 80;
    server_name image-api.tvoj-server.com;

    location / {
        proxy_pass http://localhost:8001;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

---

## 📝 Korak 8: Postavi u Lokalnom Projektu

U tvom lokalnom projektu, u `.env`:
```env
IMAGE_API_URL=http://tvoj-server:8001
IMAGE_API_KEY=tt-printer-secret-key-2025
```

Zatim pokreni:
```bash
npm start
```

VideoAgent će automatski koristiti API sa servera! 🎉

---

## 🐛 Troubleshooting

### "Model not found"
- Proveri da li putanja u `.env` postoji: `ls /path/to/model`
- Proveri da li ima `model_index.json` u model direktorijumu

### "Out of memory"
- Smanji dimenzije u zahtevima (512x512 umesto 1024x1024)
- Smanji `num_inference_steps` (20 umesto 50)

### "Connection refused"
- Proveri da li API radi: `curl http://localhost:8001/health`
- Proveri firewall: `sudo ufw status`

---

## 📚 Detaljnije Uputstvo

Vidi `server/SETUP_LOCAL_MODEL.md` za detaljnije informacije.









