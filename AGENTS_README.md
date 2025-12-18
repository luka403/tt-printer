# Agents Architecture

## Overview

Sistem je reorganizovan da odvoji **Hook Agent** od **Story Agent**-a, i dodao je novi **Facts Agent** za "Did You Know" kanal.

## Agent Structure

### 1. HookAgent (`agents/hook/index.ts`)
- **Svrha**: Generiše samo hook (0-3 sekunde, 5-15 reči)
- **Input**: Topic ili story context
- **Output**: Kratak, catchy hook koji privlači pažnju
- **Koristi se za**: Sve niše (scary_stories, did_you_know, motivation)

### 2. StoryAgent (`agents/story/index.ts`)
- **Svrha**: Generiše body priče (80-120 reči)
- **Input**: Topic + opciono hook
- **Output**: Vredan, engaging sadržaj
- **Koristi se za**: Sve niše (scary_stories, did_you_know, motivation)

### 3. FactsAgent (`agents/facts/index.ts`)
- **Svrha**: Generiše "Did You Know" facts
- **Input**: Nema (koristi random teme)
- **Output**: Surprising, educational facts
- **Koristi se za**: `did_you_know` nišu

## Workflow

### Did You Know Flow
1. **FactsAgent** → Generiše fact
2. **HookAgent** → Generiše hook za fact
3. Kombinuje: `hook + fact`
4. **VideoAgent** → Producira video
5. **PublishingAgent** → Publikuje

### Other Niches Flow (scary_stories, motivation)
1. **HookAgent** → Generiše hook
2. **StoryAgent** → Generiše story (sa hook context-om)
3. Kombinuje: `hook + story`
4. **VideoAgent** → Producira video
5. **PublishingAgent** → Publikuje

## Database Schema

Nova tabela `hooks`:
```sql
CREATE TABLE hooks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    niche TEXT NOT NULL,
    hook_content TEXT NOT NULL,
    topic TEXT,
    video_id INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

## Usage

```typescript
import { CentralAgent } from './agents/central';

const central = new CentralAgent();

// Run Did You Know channel
await central.runDailyCycle('did_you_know');

// Run Scary Stories
await central.runDailyCycle('scary_stories');

// Run Motivation
await central.runDailyCycle('motivation');
```

## Google Drive Integration

Za pullovanje videa sa Google Drive-a, vidi `GOOGLE_DRIVE_SETUP.md`.

Klase:
- `GoogleDriveService` (`core/drive.ts`)
- Metode: `listVideos()`, `downloadVideo()`, `syncVideos()`


