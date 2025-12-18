import { QuizAgent } from './agents/quiz/index';

async function testQuizAgent() {
    console.log("🧠 Testing Quiz Agent...");
    
    const agent = new QuizAgent();
    
    try {
        const result = await agent.processTask({
            id: 'test-1',
            type: 'generate_daily_quiz',
            payload: {},
            status: 'pending'
        });

        console.log("\n✅ Quiz Generation Complete!");
        console.log(JSON.stringify(result.quiz, null, 2));
        console.log("\n🖼 Visuals generated at:", result.visuals.baseDir);
        console.log("Options:", result.visuals.optionImages);
        console.log("Reveals:", result.visuals.revealImages);

    } catch (error) {
        console.error("❌ Test failed:", error);
    }
}

testQuizAgent();







