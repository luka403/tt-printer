import { CentralAgent } from './agents/central';

async function testFullFlow() {
    console.log("🔥 Testing Full Flow: Story + Hook + Audio + Drive Video\n");
    console.log("=".repeat(70));
    
    try {
        const central = new CentralAgent();
        
        // Run the did_you_know niche (uses Drive videos)
        console.log("\n📝 Step 1: Generating story + hook...");
        await central.runDailyCycle('did_you_know');
        
        console.log("\n✅ Full flow completed successfully!");
        console.log("=".repeat(70));
        console.log("\n📁 Check output in: videos/processed/");
        
    } catch (error: any) {
        console.error("\n❌ Flow failed:", error.message);
        console.error(error.stack);
        process.exit(1);
    }
}

testFullFlow().catch(console.error);



