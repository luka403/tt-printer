# 🎨 Setup Image API sa Lokalnim Stable Diffusion Modelom

## 📋 Preduslovi

- Skinut Stable Diffusion v1.5 model sa Hugging Face
- Model je lokalno na serveru (npr. u `~/stable-diffusion-v1-5/`)

---

## 🚀 Setup Koraci

### 1. Instaliraj Python Dependencies

```bash
cd /tmp/tt-printer-image-api

# Kreiraj virtual environment
python3 -m venv venv
source venv/bin/activate

# Instaliraj dependencies
pip install -r requirements.txt
```

**Napomena:** Instalacija može potrajati, posebno PyTorch.

---

### 2. Konfiguriši Environment

```bash
# Kopiraj env.example
cp env.example .env

# Uredi .env
nano .env
```

**Postavi u `.env`:**
```env
# API Key
API_KEY=tt-printer-secret-key-2025

# Model - KORISTI LOKALNU PUTANJU
IMAGE_MODEL=/path/to/your/stable-diffusion-v1-5

# Ili ako je u Hugging Face cache:
# IMAGE_MODEL=stable-diffusion-v1-5/stable-diffusion-v1-5

# Port
IMAGE_API_PORT=8001

# Output directory
IMAGE_OUTPUT_DIR=./generated_images
```

---

### 3. Opcije za Lokalni Model

#### Opcija A: Model je u custom direktorijumu

Ako si skinuo model u specifičnu lokaciju, npr.:
```bash
~/stable-diffusion-v1-5/
  ├── model_index.json
  ├── unet/
  ├── vae/
  └── ...
```

U `.env` postavi:
```env
IMAGE_MODEL=/home/username/stable-diffusion-v1-5
```

#### Opcija B: Model je u Hugging Face cache

Ako si koristio `huggingface-cli download`, model je verovatno u:
```bash
~/.cache/huggingface/hub/models--stable-diffusion-v1-5--stable-diffusion-v1-5/
```

U ovom slučaju, možeš koristiti Hugging Face ID:
```env
IMAGE_MODEL=stable-diffusion-v1-5/stable-diffusion-v1-5
```

Diffusers automatski će naći model u cache-u.

#### Opcija C: Simbolički link

Ako želiš da koristiš model iz druge lokacije:
```bash
# Kreiraj simbolički link u Hugging Face cache
mkdir -p ~/.cache/huggingface/hub/models--stable-diffusion-v1-5--stable-diffusion-v1-5--snapshots
ln -s /path/to/your/model ~/.cache/huggingface/hub/models--stable-diffusion-v1-5--stable-diffusion-v1-5--snapshots/main
```

---

### 4. Proveri da li Model Postoji

```bash
# Ako koristiš lokalnu putanju
ls -la /path/to/your/stable-diffusion-v1-5/

# Trebalo bi da vidiš:
# - model_index.json
# - unet/ direktorijum
# - vae/ direktorijum
# - text_encoder/ direktorijum
```

---

### 5. Pokreni API

```bash
# Aktiviraj virtual environment
source venv/bin/activate

# Pokreni API
python image_api.py
```

Ili koristi startup skriptu:
```bash
chmod +x start_image_api.sh
./start_image_api.sh
```

---

### 6. Testiraj API

```bash
# Health check
curl http://localhost:8001/health

# Test generisanje slike
curl -X POST http://localhost:8001/generate-image \
  -H "Content-Type: application/json" \
  -H "X-API-Key: tt-printer-secret-key-2025" \
  -d '{
    "prompt": "test image, simple cartoon style",
    "style": "simple_cartoon",
    "width": 512,
    "height": 512,
    "num_inference_steps": 20
  }'
```

---

### 7. Pokreni kao Systemd Service (Opciono)

Kreiraj `/etc/systemd/system/image-api.service`:

```ini
[Unit]
Description=Image Generation API
After=network.target

[Service]
Type=simple
User=www-data
WorkingDirectory=/tmp/tt-printer-image-api
Environment="PATH=/usr/bin:/usr/local/bin"
ExecStart=/tmp/tt-printer-image-api/venv/bin/python /tmp/tt-printer-image-api/image_api.py
Restart=always

[Install]
WantedBy=multi-user.target
```

Zatim:
```bash
sudo systemctl enable image-api
sudo systemctl start image-api
sudo systemctl status image-api
```

---

## 🔍 Troubleshooting

### Problem: Model se ne učitava

**Rešenje:**
```bash
# Proveri da li putanja postoji
ls -la /path/to/your/stable-diffusion-v1-5/

# Proveri da li ima model_index.json
cat /path/to/your/stable-diffusion-v1-5/model_index.json
```

### Problem: "Model not found"

**Rešenje:**
- Proveri da li je putanja tačna u `.env`
- Proveri da li model ima sve potrebne fajlove (unet, vae, text_encoder)

### Problem: Out of Memory

**Rešenje:**
- Smanji `width` i `height` u zahtevima (512x512 umesto 1024x1024)
- Smanji `num_inference_steps` (20 umesto 50)
- API već koristi CPU optimizacije, ali možeš dodati u `image_api.py`:
  ```python
  _pipeline.enable_sequential_cpu_offload()
  ```

---

## 📝 Primer .env Fajla

```env
# API Key
API_KEY=tt-printer-secret-key-2025

# Model - LOKALNA PUTANJA
IMAGE_MODEL=/home/username/stable-diffusion-v1-5

# Port
IMAGE_API_PORT=8001

# Output
IMAGE_OUTPUT_DIR=./generated_images
```

---

## ✅ Provera da li Radi

1. **Health Check:**
   ```bash
   curl http://localhost:8001/health
   ```
   Trebalo bi da vidiš:
   ```json
   {
     "status": "ok",
     "model": "/path/to/your/model",
     "device": "cpu",
     "model_loaded": false
   }
   ```
   (`model_loaded` će biti `true` nakon prvog zahteva)

2. **Test Generisanje:**
   ```bash
   curl -X POST http://localhost:8001/generate-image \
     -H "Content-Type: application/json" \
     -H "X-API-Key: tt-printer-secret-key-2025" \
     -d '{"prompt": "test"}'
   ```

3. **Proveri Logove:**
   ```bash
   # Ako koristiš systemd
   sudo journalctl -u image-api -f
   ```

---

## 🎯 Sledeći Korak

Kada API radi na serveru, postavi u lokalnom projektu (u `.env`):
```env
IMAGE_API_URL=http://tvoj-server:8001
IMAGE_API_KEY=tt-printer-secret-key-2025
```

Zatim pokreni projekt normalno - automatski će koristiti API sa servera!

