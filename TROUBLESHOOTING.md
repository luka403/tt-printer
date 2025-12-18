# 🔧 Troubleshooting - Image Generation

## ❌ Problem: 504 Gateway Timeout

### Šta se dešava:
- API pozivi vraćaju `504 Gateway Time-out`
- Nginx timeout je prekratak (verovatno 60s)
- Image generation na CPU traje 2-5 minuta

### Rešenje na serveru:

**1. Povećaj Nginx timeout:**

U nginx konfiguraciji za `image.7-all.com`:

```nginx
server {
    # ...
    proxy_read_timeout 600s;
    proxy_connect_timeout 600s;
    proxy_send_timeout 600s;
    # ...
}
```

**2. Ili u FastAPI (Python) kodu:**

Dodaj u `image_api.py`:
```python
from fastapi.middleware.timeout import TimeoutMiddleware

app.add_middleware(TimeoutMiddleware, timeout=600.0)
```

**3. Proveri da li Python proces radi:**

```bash
# Na serveru
ps aux | grep image_api
# Ili
systemctl status image-api
```

---

## ✅ Test da proveriš da li API radi:

```bash
# Health check (brz)
curl https://image.7-all.com/health
  # Test generisanje (može potrajati)
curl -X POST https://image.7-all.com/generate-image \
  -H "Content-Type: application/json" \
  -H "X-API-Key: tt-printer-secret-key-2025" \
    "prompt": "test",
    "style": "simple_cartoon",
    "width": 256,
    "height": 256,
    "num_inference_steps": 10
  }' \
  --max-time 300
```

---

## 🔍 Debugging:

### 1. Proveri da li Python API proces radi:
```bash
ssh na-server
ps aux | grep python | grep image_api
```

### 2. Proveri logove:
```bash
# Ako koristiš systemd
journalctl -u image-api -f

# Ili direktno
tail -f /path/to/image_api.log
```

### 3. Test lokalno na serveru:
```bash
curl http://localhost:8001/health
curl -X POST http://localhost:8001/generate-image \
  -H "Content-Type: application/json" \
  -H "X-API-Key: tt-printer-secret-key-2025" \
  -d '{"prompt":"test","width":256,"height":256}'
```

---

## 💡 Brzo rešenje:

Ako ne možeš da promeniš nginx timeout odmah, možeš:

1. **Smanji parametre generisanja:**
   - `width: 256, height: 256` (umesto 512)
   - `num_inference_steps: 10` (umesto 20)

2. **Koristi fallback:**
   - Sistem automatski koristi background video ako image generation ne uspe
   - Video će se generisati bez slika

---

## 🎯 Trenutno stanje:

- ✅ Image API je pokrenut na `https://image.7-all.com`
- ✅ Health check radi
- ❌ Generisanje slika vraća 504 (nginx timeout)
- ✅ Fallback na background video radi

**Glavni problem:** Nginx timeout treba da se poveća na serveru!



