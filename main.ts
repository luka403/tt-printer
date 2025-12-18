import { CentralAgent } from './agents/central';

async function main() {
    console.log("🔥 Starting TikTok Automation Agency...");

    const central = new CentralAgent();

    // Run the DID YOU KNOW niche (first channel)
    await central.runDailyCycle('did_you_know');
    
    // Uncomment to run other niches:
    // await central.runDailyCycle('scary_stories');
    // await central.runDailyCycle('motivation');
}

main().catch(console.error);
