import { SceneAnalyzer } from './core/scene_analyzer';
import { RemoteImageGenerator } from './core/image_generator';
import path from 'path';
import fs from 'fs';

async function debugImageGeneration() {
    console.log('🔍 Debugging Image Generation...\n');

    // Test story
    const testStory = `I'd always been fascinated by the art of voice acting, so I landed a job as a narrator for a popular audiobook series. The scripts were usually straightforward, but one particular story caught my attention - "The Darkness Beyond". As I read the words aloud, I began to feel an unsettling presence in the studio with me. The whispers started soft and subtle, growing louder until they seemed to emanate from all directions. My heart racing, I realized that I wasn't reading the script at all - I was being narrated by it. The voice on the recording... was my own.`;
    
    const audioDuration = 30; // Estimated duration

    // 1. Test Scene Analysis
    console.log('📝 Step 1: Scene Analysis\n');
    const sceneAnalyzer = new SceneAnalyzer();
    
    try {
        const scenes = await sceneAnalyzer.analyzeStory(testStory, audioDuration, 'scary_stories');
        
        console.log(`✅ Found ${scenes.length} scenes:\n`);
        scenes.forEach((scene, i) => {
            console.log(`Scene ${i + 1}:`);
            console.log(`  Timestamp: ${scene.timestamp.toFixed(2)}s`);
            console.log(`  Duration: ${scene.duration.toFixed(2)}s`);
            console.log(`  Description: ${scene.description.substring(0, 80)}...`);
            console.log(`  Image Prompt: ${scene.imagePrompt.substring(0, 120)}...`);
            console.log('');
        });

        // 2. Test Image Generation for first scene
        console.log('🎨 Step 2: Testing Image Generation (first scene only)\n');
        const firstScene = scenes[0];
        const testImagePath = path.join(__dirname, 'debug_test_image.png');
        
        const imageGenerator = new RemoteImageGenerator();
        
        console.log(`Generating image with prompt:`);
        console.log(`"${firstScene.imagePrompt}"\n`);
        console.log(`Parameters: width=512, height=512, steps=15\n`);
        
        try {
            const result = await imageGenerator.generateImage(
                firstScene.imagePrompt,
                testImagePath,
                {
                    style: 'simple_cartoon',
                    width: 512,
                    height: 512,
                    numInferenceSteps: 15
                }
            );
            
            console.log(`✅ Image generated: ${result}`);
            if (fs.existsSync(result)) {
                const stats = fs.statSync(result);
                console.log(`📊 Size: ${(stats.size / 1024).toFixed(2)} KB`);
            }
        } catch (error: any) {
            console.error(`❌ Image generation failed:`, error.message);
            if (error.response) {
                console.error(`Status: ${error.response.status}`);
                console.error(`Response:`, JSON.stringify(error.response.data, null, 2));
            }
        }

    } catch (error: any) {
        console.error(`❌ Scene analysis failed:`, error.message);
        console.error(error.stack);
    }
}

debugImageGeneration();








