# 🚀 Setup Ollama API na Serveru

## 📋 Plan
1. Instaliraj Ollama na serveru
2. Expose API preko reverse proxy (Nginx) ili direktno
3. Ažuriraj Node.js kod da koristi remote API

---

## 1️⃣ INSTALACIJA OLLAMA NA SERVERU

### Linux Server:
```bash
# Instaliraj Ollama
curl -fsSL https://ollama.com/install.sh | sh

# Pokreni Ollama servis
ollama serve

# Ili kao systemd service (preporučeno):
sudo systemctl enable ollama
sudo systemctl start ollama
```

### Proveri da radi:
```bash
curl http://localhost:11434/api/tags
```

---

## 2️⃣ EXPOSE API (2 OPCIJE)

### OPCIJA A: Direktno (brzo, ali manje sigurno)
```bash
# Ollama već sluša na localhost:11434
# Da bi bilo dostupno sa spoljašnje IP:

# 1. Promeni bind address u Ollama config
# Kreiraj/uredi: ~/.ollama/config
OLLAMA_HOST=0.0.0.0:11434

# 2. Restartuj servis
sudo systemctl restart ollama

# 3. Otvori firewall port (ako imaš)
sudo ufw allow 11434/tcp
```

**⚠️ Napomena:** Ovo nije sigurno bez autentifikacije! Koristi samo ako je server iza VPN-a ili firewall-a.

---

### OPCIJA B: Nginx Reverse Proxy (PREPORUČENO) ✅

#### 1. Instaliraj Nginx:
```bash
sudo apt update
sudo apt install nginx
```

#### 2. Kreiraj Nginx config:
```bash
sudo nano /etc/nginx/sites-available/ollama-api
```

**Sadržaj:**
```nginx
server {
    listen 80;
    server_name tvoj-server-ip-ili-domen.com;  # Zameni sa svojim IP ili domenom

    # Rate limiting (opciono, ali preporučeno)
    limit_req_zone $binary_remote_addr zone=llm_limit:10m rate=10r/s;

    location / {
        limit_req zone=llm_limit burst=20 nodelay;
        
        proxy_pass http://localhost:11434;
        proxy_http_version 1.1;
        
        # Headers za WebSocket (ako koristiš streaming)
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        
        # Standardni headers
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # Timeouts (LLM može da traje dugo)
        proxy_read_timeout 300s;
        proxy_connect_timeout 75s;
    }
}
```

#### 3. Enable config i restart:
```bash
sudo ln -s /etc/nginx/sites-available/ollama-api /etc/nginx/sites-enabled/
sudo nginx -t  # Test config
sudo systemctl reload nginx
```

#### 4. Otvori port 80:
```bash
sudo ufw allow 80/tcp
```

---

## 3️⃣ SSL/HTTPS (OPCIONO, ali preporučeno)

Ako imaš domen, koristi Let's Encrypt:

```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d tvoj-domen.com
```

---

## 4️⃣ TESTIRANJE API-ja

### Sa servera:
```bash
curl http://localhost:11434/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "llama3.1:8b",
    "messages": [
      {"role": "user", "content": "Hello"}
    ]
  }'
```

### Sa spoljašnje mašine:
```bash
curl http://TVOJ-SERVER-IP/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "llama3.1:8b",
    "messages": [
      {"role": "user", "content": "Hello"}
    ]
  }'
```

---

## 5️⃣ AŽURIRANJE NODE.JS KODA

Kada ti kažeš da je API spreman, ažuriraćemo:

1. **`.env` fajl:**
```env
LLM_API_URL=http://TVOJ-SERVER-IP/v1
# ili sa HTTPS:
# LLM_API_URL=https://tvoj-domen.com/v1
LLM_MODEL=llama3.1:8b
LLM_API_KEY=ollama  # Ollama ne zahteva API key, ali možemo dodati ako želiš
```

2. **Kod već radi!** Samo promeni URL u `.env`.

---

## 🔒 SIGURNOST (VAŽNO!)

### 1. Dodaj Basic Auth (preko Nginx):
```bash
sudo apt install apache2-utils
sudo htpasswd -c /etc/nginx/.htpasswd username
# Unesi password

# Dodaj u nginx config:
auth_basic "Ollama API";
auth_basic_user_file /etc/nginx/.htpasswd;
```

### 2. Ili IP Whitelist:
```nginx
allow TVOJ-IP;
deny all;
```

### 3. Ili API Key middleware (naprednije):
- Možeš napraviti mali Node.js middleware koji proverava API key
- Ili koristi Nginx auth_request modul

---

## 📝 CHECKLIST

- [ ] Ollama instaliran i radi
- [ ] Model instaliran (`ollama pull llama3.1:8b`)
- [ ] Nginx config kreiran
- [ ] Port 80 otvoren
- [ ] Test API poziv radi
- [ ] (Opciono) SSL/HTTPS podešen
- [ ] (Opciono) Basic Auth ili IP whitelist

---

## 🧪 KADA ZAVRŠIŠ, JAVI MI:

1. **URL tvog API-ja:** `http://IP/v1` ili `https://domen.com/v1`
2. **Da li imaš autentifikaciju?** (API key, Basic Auth, itd.)
3. **Koji model koristiš?** (npr. `llama3.1:8b`)

I ja ću ti:
- Ažurirati `.env` fajl
- Dodati autentifikaciju u kod (ako treba)
- Testirati konekciju

---

## 🆘 TROUBLESHOOTING

**Ollama ne radi:**
```bash
sudo systemctl status ollama
sudo journalctl -u ollama -f
```

**Nginx ne radi:**
```bash
sudo nginx -t
sudo systemctl status nginx
sudo tail -f /var/log/nginx/error.log
```

**Port blokiran:**
```bash
sudo ufw status
sudo netstat -tulpn | grep 11434
```










