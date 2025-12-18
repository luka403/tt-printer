import { RemoteKokoroTTS } from './core/tts';
import path from 'path';

async function testKokoroTTS() {
    console.log("🎤 Testing Remote Kokoro TTS...\n");
    
    const tts = new RemoteKokoroTTS();
    const testText = "Hej druže, ovo je test Kokoro TTS API-ja. Zvuči veoma prirodno i ljudski.";
    const outputPath = path.resolve(__dirname, 'test_audio.mp3');

    try {
        await tts.generateAudio(testText, outputPath, { voice: 'af_alloy', speed: 1.0 });
        console.log(`\n✅ Success! Audio file saved to: ${outputPath}`);
        console.log("You can play it with: open test_audio.mp3 (on Mac) or any audio player");
    } catch (error: any) {
        console.error(`\n❌ Failed: ${error.message}`);
    }
}

testKokoroTTS();
