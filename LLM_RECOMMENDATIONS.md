# 🧠 Najbolji Lokalni LLM Modeli za 2025 (16GB RAM)

## 🏆 TOP 3 PREPORUKE za TikTok Skripte i Priče

### 1. **Llama 3.1 8B** ⭐⭐⭐⭐⭐ (NAJBOLJI IZBOR)
**Zašto:**
- ✅ Odličan za kreativno pisanje (priče, skripte)
- ✅ Brz na CPU-u (8 vCPU će ga pokrenuti za 5-15 sekundi po generaciji)
- ✅ Stanje: ~5GB RAM (q4_k_m quantization)
- ✅ Podržava dobar ton i stil (može da bude mračan, motivacioni, itd.)
- ✅ Lako se instalira preko Ollama

**Instalacija:**
```bash
ollama pull llama3.1:8b
```

**Konfiguracija u .env:**
```env
LLM_MODEL=llama3.1:8b
```

---

### 2. **Qwen 2.5 7B** ⭐⭐⭐⭐
**Zašto:**
- ✅ Odličan za kratke forme (TikTok skripte su kratke!)
- ✅ Brz (~3-10 sekundi)
- ✅ Stanje: ~4.5GB RAM
- ✅ Dobar za različite jezike (ako planiraš multi-language)

**Instalacija:**
```bash
ollama pull qwen2.5:7b
```

---

### 3. **Mistral 7B** ⭐⭐⭐⭐
**Zašto:**
- ✅ Brz i efikasan
- ✅ Stanje: ~4GB RAM
- ✅ Dobar balans kvaliteta/brzine

**Instalacija:**
```bash
ollama pull mistral:7b
```

---

## 🚀 INSTALACIJA (Ollama)

### 1. Instaliraj Ollama na serveru:
```bash
# Linux
curl -fsSL https://ollama.com/install.sh | sh

# Ili preuzmi sa: https://ollama.com/download
```

### 2. Pokreni Ollama servis:
```bash
ollama serve
# Ili kao systemd service:
sudo systemctl enable ollama
sudo systemctl start ollama
```

### 3. Instaliraj model:
```bash
ollama pull llama3.1:8b
```

### 4. Testiraj:
```bash
ollama run llama3.1:8b "Write a scary two-sentence story about mirrors"
```

---

## 📊 PERFORMANSE (na tvom serveru - 8 vCPU, 16GB RAM)

| Model | RAM Usage | Generacija (CPU) | Kvalitet Skripti |
|-------|-----------|------------------|------------------|
| **Llama 3.1 8B** | ~5GB | 5-15s | ⭐⭐⭐⭐⭐ |
| Qwen 2.5 7B | ~4.5GB | 3-10s | ⭐⭐⭐⭐ |
| Mistral 7B | ~4GB | 3-8s | ⭐⭐⭐⭐ |
| Phi-3.5 3.8B | ~2.5GB | 2-5s | ⭐⭐⭐ |

---

## 🎯 PREPORUKA ZA TVOJ SLUČAJ

**Za Scary Stories / TikTok Skripte:**
→ **Llama 3.1 8B** je najbolji izbor jer:
- Najbolji kvalitet kreativnog pisanja
- Dobar balans brzine i kvaliteta
- Ima dovoljno "kreativnosti" za horor priče
- Brz dovoljno da ne blokira pipeline

**Za Production (kad skaliraš na više kanala):**
- Možeš da koristiš **Qwen 2.5 7B** za brže generisanje
- Ili **Phi-3.5 3.8B** ako trebaš da generišeš 10+ videa istovremeno

---

## ⚙️ OPTIMIZACIJA za tvoj server

### 1. Podesi num_threads u Ollama:
```bash
# U ~/.ollama/config ili environment variable
export OLLAMA_NUM_THREADS=8  # Koristi sve tvoje CPU jezgre
```

### 2. Koristi quantization q4_k_m (default):
- Najbolji balans kvaliteta/veličine
- q8 je bolji ali sporiji i veći

### 3. Cache model u RAM-u:
```bash
# Ollama automatski kešira model nakon prve upotrebe
# Prvi poziv će biti sporiji (~30s), sledeći brži (~5-10s)
```

---

## 🔧 AŽURIRANJE TVOG KODA

Tvoj kod već koristi Ollama format! Samo promeni `.env`:

```env
LLM_API_URL=http://localhost:11434/v1
LLM_MODEL=llama3.1:8b
LLM_API_KEY=ollama
```

I to je to! Sistem će automatski koristiti novi model.

---

## 🧪 TESTIRANJE

Nakon instalacije, testiraj:

```bash
# 1. Proveri da li Ollama radi
curl http://localhost:11434/api/tags

# 2. Testiraj model direktno
ollama run llama3.1:8b "Write a scary TikTok story in 2 sentences"

# 3. Testiraj kroz tvoj sistem
npx ts-node main.ts
```

---

## 💡 BONUS: Alternativa (ako ne želiš Ollama)

**LM Studio** (GUI) ili **llama.cpp** direktno:
- Više kontrole
- Možeš da koristiš custom quantization
- Ali komplikovanije za setup

**Preporuka:** Koristi Ollama - najlakše i najbrže za početak! 🚀










