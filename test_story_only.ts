import { ScaryContentAgent } from './agents/content/scary';
import { AgentTask } from './core/agent';

async function testStoryGeneration() {
    console.log('📖 Generating Scary Story (no images)...\n');
    console.log('='.repeat(70));
    
    const agent = new ScaryContentAgent();
    
    try {
        const result = await agent.processTask({
            id: 'test-story',
            type: 'content',
            payload: { topic: 'random' },
            status: 'pending'
        });
        
        console.log('\n' + '='.repeat(70));
        console.log('✅ STORY GENERATED');
        console.log('='.repeat(70));
        console.log('\n📝 RAW STORY SCRIPT:\n');
        console.log(result.script);
        console.log('\n' + '='.repeat(70));
        console.log(`📊 Video ID: ${result.videoId}`);
        console.log(`📊 Title: ${result.title}`);
        console.log(`📊 Length: ${result.script.length} characters`);
        console.log(`📊 Words: ${result.script.split(' ').length} words`);
        console.log('='.repeat(70));
        
    } catch (error: any) {
        console.error('\n❌ Error:', error.message);
        console.error(error.stack);
        process.exit(1);
    }
}

testStoryGeneration();








