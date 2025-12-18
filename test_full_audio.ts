import { RemoteKokoroTTS } from './core/tts';
import path from 'path';
import { db } from './core/db';

async function testFullAudio() {
    console.log("🧪 Testing Full Audio Generation...\n");
    
    // Get the script from database
    const video: any = db.get("SELECT script_content FROM videos WHERE id = 3");
    
    if (!video) {
        console.error("Video 3 not found in database");
        return;
    }
    
    const script = video.script_content as string;
    console.log(`📝 Script length: ${script.length} characters`);
    console.log(`📝 Script preview: "${script.substring(0, 100)}..."`);
    console.log(`📝 Script full: "${script}"\n`);
    
    const tts = new RemoteKokoroTTS();
    const outputPath = path.resolve(__dirname, 'test_full_audio.mp3');

    try {
        console.log("🎤 Generating audio...");
        await tts.generateAudio(script, outputPath, { voice: 'af_alloy', speed: 0.9 });
        
        // Check file size and duration
        const fs = require('fs');
        const stats = fs.statSync(outputPath);
        console.log(`\n✅ Audio generated!`);
        console.log(`   File size: ${(stats.size / 1024).toFixed(2)} KB`);
        console.log(`   File path: ${outputPath}`);
        
        // Try to get duration with ffprobe if available
        const { spawn } = require('child_process');
        const ffprobe = spawn('ffprobe', ['-i', outputPath, '-show_entries', 'format=duration', '-v', 'quiet', '-of', 'csv=p=0']);
        
        let duration = '';
        ffprobe.stdout.on('data', (data: Buffer) => {
            duration += data.toString();
        });
        
        ffprobe.on('close', () => {
            if (duration) {
                const seconds = parseFloat(duration.trim());
                console.log(`   Duration: ${seconds.toFixed(2)} seconds (${(seconds / 60).toFixed(2)} minutes)`);
            }
        });
        
    } catch (error: any) {
        console.error(`\n❌ Failed: ${error.message}`);
        if (error.response) {
            console.error("Response:", error.response.data);
        }
    }
}

testFullAudio();

