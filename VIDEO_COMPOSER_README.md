# Video Composer Service

Servis za spajanje video klipova, audio-a i teksta u finalni video.

## Features

- ✅ Kombinuje više video klipova u jedan video
- ✅ Dodaje audio track (TTS ili muziku)
- ✅ Automatski generiše subtitlove iz teksta
- ✅ Podrška za Google Drive video klipove
- ✅ Customizabilni stilovi za subtitlove
- ✅ Loop video klipova ako su kraći od potrebnog
- ✅ TikTok format (1080x1920, 9:16)

## Usage

### Basic Usage

```typescript
import { VideoComposer, VideoSegment, SubtitleSegment } from './core/video_composer';

const composer = new VideoComposer();

// Simple composition with background video + audio + subtitles
await composer.compose({
    outputPath: './output/final.mp4',
    backgroundVideo: './assets/broll/background.mp4',
    audioPath: './audio/tts.mp3',
    subtitles: [
        {
            text: 'Did you know?',
            startTime: 0,
            duration: 2
        },
        {
            text: 'This is an amazing fact!',
            startTime: 2,
            duration: 3
        }
    ]
});
```

### Multiple Video Segments

```typescript
const videoSegments: VideoSegment[] = [
    {
        path: './assets/drive_videos/clip1.mp4',
        duration: 5,
        loop: true
    },
    {
        path: './assets/drive_videos/clip2.mp4',
        duration: 5,
        loop: true
    }
];

await composer.compose({
    outputPath: './output/final.mp4',
    videoSegments,
    audioPath: './audio/tts.mp3',
    subtitles: VideoComposer.createSubtitlesFromText(script, audioDuration)
});
```

### Custom Subtitle Styles

```typescript
const subtitles: SubtitleSegment[] = [
    {
        text: 'Hook text',
        startTime: 0,
        duration: 3,
        style: {
            fontSize: 80,
            fontColor: 'yellow',
            backgroundColor: 'black@0.7',
            position: 'top',
            outlineColor: 'black',
            outlineWidth: 3
        }
    }
];
```

## Integration with VideoAgent

VideoAgent automatski koristi VideoComposer:

```typescript
// Automatski se koristi kada se generiše video
const videoResult = await videoAgent.processTask({
    id: 'task-video',
    type: 'video',
    payload: {
        videoId: 123,
        script: 'Full script text here...',
        niche: 'did_you_know',
        useDriveVideos: true // Opciono: koristi Drive klipove
    },
    status: 'pending'
});
```

## Google Drive Integration

Za korišćenje Google Drive klipova:

1. Podesi environment variable:
```bash
export GOOGLE_DRIVE_FOLDER_ID="your_folder_id_here"
export GOOGLE_APPLICATION_CREDENTIALS="/path/to/credentials.json"
```

2. VideoAgent će automatski:
   - Sync-ovati klipove sa Drive-a
   - Koristiti ih umesto generisanih slika
   - Kombinovati ih sa audio-om i subtitlovima

## Helper Methods

### Auto-generate Subtitles from Text

```typescript
const subtitles = VideoComposer.createSubtitlesFromText(
    'Your full script text here...',
    audioDuration, // Total duration in seconds
    2.5 // Words per second (default: 2.5)
);
```

Ova metoda automatski:
- Deli tekst na segmente
- Računa timing za svaki segment
- Kreira subtitle objekte

## Options

```typescript
interface VideoCompositionOptions {
    outputPath: string;              // Output file path
    videoSegments?: VideoSegment[];   // Array of video clips
    audioPath?: string;               // Audio file path
    subtitles?: SubtitleSegment[];    // Subtitle segments
    backgroundVideo?: string;         // Background video (if no segments)
    width?: number;                   // Video width (default: 1080)
    height?: number;                  // Video height (default: 1920)
    fps?: number;                    // FPS (default: 30)
    audioVolume?: number;            // 0.0 to 1.0 (default: 1.0)
    videoCodec?: string;              // Default: 'libx264'
    audioCodec?: string;             // Default: 'aac'
}
```

## VideoSegment

```typescript
interface VideoSegment {
    path: string;        // Path to video file
    startTime?: number;  // Start time in source (for trimming)
    duration?: number;   // Duration to use
    loop?: boolean;      // Loop if shorter than needed
}
```

## SubtitleSegment

```typescript
interface SubtitleSegment {
    text: string;        // Subtitle text
    startTime: number;   // Start time in seconds
    duration: number;    // Duration in seconds
    style?: SubtitleStyle; // Optional styling
}
```

## Examples

### Example 1: Background Video + Audio + Subtitles

```typescript
await composer.compose({
    outputPath: './output/video.mp4',
    backgroundVideo: './assets/broll/default.mp4',
    audioPath: './audio/tts.mp3',
    subtitles: VideoComposer.createSubtitlesFromText(script, 30)
});
```

### Example 2: Multiple Drive Clips

```typescript
// VideoAgent automatski koristi Drive klipove ako je useDriveVideos: true
await videoAgent.processTask({
    id: 'task',
    type: 'video',
    payload: {
        videoId: 1,
        script: 'Full script...',
        niche: 'did_you_know',
        useDriveVideos: true
    },
    status: 'pending'
});
```

### Example 3: Custom Styled Subtitles

```typescript
const subtitles: SubtitleSegment[] = [
    {
        text: 'HOOK: Did you know?',
        startTime: 0,
        duration: 2,
        style: {
            fontSize: 90,
            fontColor: 'yellow',
            position: 'top'
        }
    },
    {
        text: 'Body content here...',
        startTime: 2,
        duration: 10,
        style: {
            fontSize: 60,
            fontColor: 'white',
            position: 'bottom'
        }
    }
];
```

## Notes

- FFmpeg mora biti instaliran
- Video klipovi se automatski skaliraju na 1080x1920 (TikTok format)
- Audio se automatski sync-uje sa video-om
- Subtitlovi se prikazuju samo tokom definisanog vremena
- Video klipovi se loop-uju ako su kraći od potrebnog





