import { RemoteImageGenerator } from './core/image_generator';
import path from 'path';
import fs from 'fs';

async function testImageGeneration() {
    console.log('🧪 Testing Image Generation API...\n');

    const imageGenerator = new RemoteImageGenerator();
    const testImagePath = path.join(__dirname, 'test_image.png');

    try {
        console.log('📡 Calling Image API...');
        console.log(`API URL: ${process.env.IMAGE_API_URL || 'http://localhost:8001'}`);
        console.log(`API Key: ${process.env.IMAGE_API_KEY || 'not set'}\n`);

        const result = await imageGenerator.generateImage(
            'a dark room with a mysterious figure, simple cartoon style',
            testImagePath,
            {
                style: 'simple_cartoon',
                width: 512,
                height: 512,
                numInferenceSteps: 20
            }
        );

        console.log('\n✅ Image generated successfully!');
        console.log(`📁 Path: ${result}`);
        
        if (fs.existsSync(result)) {
            const stats = fs.statSync(result);
            console.log(`📊 Size: ${(stats.size / 1024).toFixed(2)} KB`);
        }

    } catch (error: any) {
        console.error('\n❌ Error:', error.message);
        if (error.response) {
            console.error('Status:', error.response.status);
            console.error('Response:', JSON.stringify(error.response.data, null, 2));
        }
        process.exit(1);
    }
}

testImageGeneration();









