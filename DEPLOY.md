# 🚀 Deploy Script Usage

## Kako koristiti:

```bash
./deploy.sh user@server-ip
```

**Primer:**
```bash
./deploy.sh root@192.168.1.100
# ili
./deploy.sh ubuntu@your-server.com
```

---

## 📋 Šta skripta radi:

1. ✅ Proverava da li postoji `.env` fajl (ako ne, kopira iz `env.example`)
2. ✅ Kreira remote direktorijum (`/opt/llm-api`)
3. ✅ Kopira sve potrebne fajlove:
   - `llm_api.py`
   - `requirements.txt`
   - `.env` (ili `env.example`)
   - `start.sh` (ako postoji)
4. ✅ Instalira Python dependencies na serveru
5. ✅ Proverava da li Ollama radi
6. ✅ Kreira systemd service
7. ✅ Pokreće servis
8. ✅ Testira API

---

## 🔑 Pre deploy-a:

### 1. Kreiraj `.env` fajl (ako nemaš):
```bash
cd server
cp env.example .env
# Uredi .env i promeni API_KEY!
```

### 2. Proveri da li imaš SSH pristup:
```bash
ssh user@server-ip
```

### 3. Proveri da li Ollama radi na serveru:
```bash
ssh user@server-ip "curl http://localhost:11434/api/tags"
```

---

## ⚙️ Nakon deploy-a:

### Proveri status:
```bash
ssh user@server-ip "sudo systemctl status llm-api"
```

### Vidi logove:
```bash
ssh user@server-ip "sudo journalctl -u llm-api -f"
```

### Restart servisa:
```bash
ssh user@server-ip "sudo systemctl restart llm-api"
```

### Expose na port (firewall):
```bash
ssh user@server-ip "sudo ufw allow 8000/tcp"
```

---

## 🧪 Testiranje:

### Lokalno na serveru:
```bash
curl http://localhost:8000/health
```

### Sa spoljašnje mašine:
```bash
curl http://SERVER-IP:8000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "X-API-Key: YOUR-API-KEY" \
  -d '{"model":"llama3.1:8b","messages":[{"role":"user","content":"Hello"}]}'
```

---

## 🐛 Troubleshooting:

**Service ne radi:**
```bash
ssh user@server-ip "sudo journalctl -u llm-api -n 50"
```

**Ollama nije dostupan:**
```bash
ssh user@server-ip "curl http://localhost:11434/api/tags"
# Ako ne radi, instaliraj Ollama:
ssh user@server-ip "curl -fsSL https://ollama.com/install.sh | sh"
```

**Port blokiran:**
```bash
ssh user@server-ip "sudo ufw status"
ssh user@server-ip "sudo ufw allow 8000/tcp"
```

---

## 📝 Manual Deploy (ako skripta ne radi):

```bash
# 1. Kopiraj fajlove
scp server/llm_api.py user@server:/opt/llm-api/
scp server/requirements.txt user@server:/opt/llm-api/
scp server/.env user@server:/opt/llm-api/

# 2. SSH na server
ssh user@server

# 3. Instaliraj dependencies
cd /opt/llm-api
pip3 install --user -r requirements.txt

# 4. Pokreni ručno (za test)
python3 llm_api.py

# 5. Ili koristi systemd (vidi server/README.md)
```










