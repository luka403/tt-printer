# Debug Guide

Sistem sada automatski čuva sve korake u debug direktorijumu za svaki video.

## Debug Direktorijum Struktura

Za svaki video (npr. video ID 25), kreira se direktorijum:
```
videos/processed/25_debug/
```

### Fajlovi u Debug Direktorijumu

1. **script.txt** - Originalni script tekst
2. **audio.mp3** - Kopija generisanog audio fajla
3. **audio_info.txt** - Informacije o audio fajlu (duration, size, voice)
4. **subtitles.srt** - SRT fajl sa svim subtitlovima
5. **subtitles_info.txt** - Detaljne informacije o svakom subtitle segmentu
6. **drive_videos_list.txt** - Lista video fajlova korišćenih iz drive_videos
7. **final_video.mp4** - Kopija finalnog video fajla
8. **final_info.txt** - Informacije o finalnom videu
9. **error_*.txt** - Greške ako se desi problem (error_audio.txt, error_video.txt, itd.)

## Kako Debug-ovati

### 1. Proveri da li je audio generisan
```bash
ls -lh videos/processed/25_debug/audio.mp3
cat videos/processed/25_debug/audio_info.txt
```

### 2. Proveri subtitlove
```bash
cat videos/processed/25_debug/subtitles.srt
cat videos/processed/25_debug/subtitles_info.txt
```

### 3. Proveri greške
```bash
cat videos/processed/25_debug/error_*.txt
```

### 4. Proveri finalni video
```bash
ls -lh videos/processed/25_debug/final_video.mp4
cat videos/processed/25_debug/final_info.txt
```

## Česti Problemi

### Video nije generisan
1. Proveri `error_video.txt` ili `error_final.txt`
2. Proveri da li postoji `audio.mp3` i da li je validan
3. Proveri da li postoji video u `assets/drive_videos/`
4. Proveri FFmpeg logove u terminalu

### Audio nije generisan
1. Proveri `error_audio.txt`
2. Proveri TTS API konekciju
3. Proveri da li je script previše dugačak

### Subtitlovi se ne prikazuju
1. Proveri `subtitles.srt` - da li je format validan
2. Proveri `subtitles_info.txt` - da li su timing-i ispravni
3. Proveri da li FFmpeg ima libass podršku: `ffmpeg -filters | grep subtitles`

## Output Lokacije

- **Finalni video**: `videos/processed/{videoId}_final.mp4`
- **Debug fajlovi**: `videos/processed/{videoId}_debug/`
- **Audio**: `videos/processed/{videoId}_audio.mp3`
- **SRT**: `videos/processed/{videoId}_debug/subtitles.srt`

## Logging

Svi koraci se loguju sa emoji-ima za lakše praćenje:
- 📝 Script/text operations
- 🎤 Audio generation
- 🎬 Video composition
- ✅ Success
- ❌ Error
- 📁 File operations
- ⏱️ Timing information




