import axios from 'axios';
import https from 'https';
import dotenv from 'dotenv';

dotenv.config();

const API_URL = process.env.LLM_API_URL || 'https://llama.7-all.com/v1';
const API_KEY = process.env.LLM_API_KEY || 'tt-printer-key_key-key';
const MODEL = process.env.LLM_MODEL || 'llama3.1:8b';

async function testRemoteLLM() {
    console.log("🧪 Testing Remote LLM API...\n");
    console.log(`URL: ${API_URL}`);
    console.log(`Model: ${MODEL}\n`);

    const httpsAgent = new https.Agent({ rejectUnauthorized: false });

    try {
        // Test 1: Check if API is reachable (health endpoint)
        console.log("1️⃣ Testing API connection...");
        try {
            const healthResponse = await axios.get(`${API_URL.replace('/v1', '')}/health`, {
                httpsAgent,
                timeout: 5000
            });
            console.log("✅ API is reachable!");
            console.log("Health:", healthResponse.data);
        } catch (healthError: any) {
            console.log("⚠️  Health endpoint not available, trying chat completions directly...");
        }
        console.log();

        // Test 2: Generate a simple response
        console.log("2️⃣ Testing text generation...");
        const payload = {
            model: MODEL,
            messages: [
                { role: "system", content: "You are a helpful assistant." },
                { role: "user", content: "Write a scary two-sentence story about mirrors." }
            ],
            temperature: 0.7
        };

        const headers: any = {
            'Content-Type': 'application/json'
        };

        // Add API key if provided (X-API-Key header for Python FastAPI server)
        if (API_KEY && API_KEY !== 'ollama') {
            headers['X-API-Key'] = API_KEY;
        }

        const startTime = Date.now();
        const response = await axios.post(`${API_URL}/chat/completions`, payload, {
            httpsAgent,
            headers,
            timeout: 60000 // 60 seconds for LLM generation
        });

        const duration = ((Date.now() - startTime) / 1000).toFixed(2);
        
        console.log(`✅ Generation successful! (${duration}s)`);
        console.log("\n📝 Generated text:");
        console.log("─".repeat(50));
        console.log(response.data.choices[0].message.content);
        console.log("─".repeat(50));
        console.log("\n🎉 Remote LLM API is working perfectly!");

    } catch (error: any) {
        console.error("\n❌ Error:", error.message);
        if (error.response) {
            console.error("Status:", error.response.status);
            console.error("Data:", error.response.data);
        }
        if (error.code === 'ECONNREFUSED') {
            console.error("\n💡 Tip: Make sure Ollama is running on the server and the URL is correct.");
        }
        process.exit(1);
    }
}

testRemoteLLM();

