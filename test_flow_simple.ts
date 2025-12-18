import { CentralAgent } from './agents/central';

async function testFlow() {
    console.log("🔥 Testing TikTok Automation Flow (without images - will use fallback)...\n");

    const central = new CentralAgent();

    try {
        // Run the SCARY STORIES niche
        await central.runDailyCycle('scary_stories');
        console.log("\n✅ Flow completed!");
    } catch (error: any) {
        console.error("\n❌ Flow failed:", error.message);
        process.exit(1);
    }
}

testFlow();









