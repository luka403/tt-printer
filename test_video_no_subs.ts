import { VideoAgent } from './agents/video';
import { db } from './core/db';

async function testNoSubs() {
    console.log("🔥 Testing Video Generation WITHOUT Subtitles\n");
    
    const videoAgent = new VideoAgent();
    
    // 1. Create a dummy video entry in DB
    // better-sqlite3 run is synchronous and returns info
    const info = db.run(`INSERT INTO videos (niche, script_content, status) VALUES (?, ?, ?)`, 
        ['did_you_know', 'Test script', 'pending']
    );
    
    const videoId = info.lastInsertRowid as number;

    console.log(`🎬 Created test video ID: ${videoId}`);

    const script = "Did you know that your brain processes images 60,000 times faster than text? This is why video content is taking over the internet completely.";
    const hook = "Did you know";

    // 2. Run Video Agent with noSubtitles: true
    try {
        const result = await videoAgent.processTask({
            id: 'test-video-task',
            type: 'video',
            payload: {
                videoId: videoId,
                script: script,
                niche: 'did_you_know',
                useDriveVideos: true,
                hook: hook,
                noSubtitles: true // <--- THE KEY FLAG
            },
            status: 'pending'
        });

        console.log("\n✅ Result:", result);
        
    } catch (error) {
        console.error("❌ Error:", error);
    }
}

testNoSubs().catch(console.error);
