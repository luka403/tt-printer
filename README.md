# TikTok Automation Agency - Scary Stories Pipeline

## 🎯 Overview

Multi-agent sistem za automatsko generisanje TikTok videa. Trenutno fokus na **Scary Stories** nišu.

## 🏗️ Architecture

- **Central Agent**: Orchestrator koji koordinira sve agente
- **Content Agent**: Generiše horor priče koristeći LLM (Ollama/Llama3)
- **Video Agent**: Kombinuje audio (Kokoro TTS) sa video pozadinom (FFmpeg)
- **Publishing Agent**: Upload na TikTok (mock za sada)

## 🚀 Quick Start

### 1. Install Dependencies
```bash
npm install
```

### 2. Setup Environment
Kreiraj `.env` fajl (ili koristi postojeći):
```env
KOKORO_TTS_URL=https://tts.7-all.com
LLM_API_URL=http://localhost:11434/v1
LLM_MODEL=llama3
```

### 3. Test TTS Connection
```bash
npx ts-node test_remote_tts.ts
```

### 4. Run Full Pipeline
```bash
npx ts-node main.ts
```

## 📁 Project Structure

```
/agents
  /central    - Main orchestrator
  /content    - Content generation (scary.ts, index.ts)
  /video      - Video production (FFmpeg + TTS)
  /publish    - Publishing logic
/core
  /tts.ts     - RemoteKokoroTTS service
  /llm.ts     - LLM service (Ollama compatible)
  /db.ts      - SQLite database
/videos
  /processed  - Generated videos
/assets
  /broll      - Background video files (scary_loop.mp4)
```

## 🎤 TTS Configuration

Sistem koristi **Remote Kokoro TTS API** (`https://tts.7-all.com`).

**Available Voices:**
- `af_alloy` - Neutral, good for scary stories
- `af_bella` - Female voice
- (Check API docs for more: `/v1/audio/voices`)

**Usage in Code:**
```typescript
const tts = new RemoteKokoroTTS();
await tts.generateAudio(text, outputPath, { 
    voice: 'af_alloy', 
    speed: 0.9  // Slower for dramatic effect
});
```

## 🎬 Video Production

**Requirements:**
1. Background video: `assets/broll/scary_loop.mp4` (dark forest, fog, etc.)
2. FFmpeg installed on system
3. Audio generated via TTS

**Process:**
1. Content Agent → Generiše priču
2. Video Agent → Poziva TTS API → Generiše audio
3. Video Agent → FFmpeg spaja audio + background video
4. Output → `videos/processed/{videoId}_final.mp4`

## 📊 Database

SQLite baza (`database/db.sqlite`) prati:
- Video zapise (status, script, file path)
- Trendove
- Performance stats (kasnije)

## 🔧 Next Steps

1. **Add Real Background Videos**: Skini dark stock footage sa Pexels/Pixabay
2. **Add Subtitles**: FFmpeg `drawtext` filter za tekst preko videa
3. **Real TikTok Upload**: Integracija sa TikTok API ili Puppeteer automation
4. **Multiple Niches**: Dodaj `motivation`, `facts`, `reddit_stories` agente
5. **Scheduling**: Cron job za dnevno generisanje (2-3 videa)

## 🐛 Troubleshooting

**TTS fails:**
- Proveri da li je `KOKORO_TTS_URL` tačan
- Proveri internet konekciju
- API možda zahteva autentifikaciju (dodaj headers ako treba)

**FFmpeg fails:**
- Proveri da li je FFmpeg instaliran: `ffmpeg -version`
- Proveri da li postoji background video fajl
- Proveri audio fajl (mora biti validan MP3)

**LLM fails:**
- Proveri da li Ollama radi: `curl http://localhost:11434/api/tags`
- Proveri da li je model instaliran: `ollama list`
- Ako nema Ollama, sistem koristi mock response










