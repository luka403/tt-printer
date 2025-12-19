import axios from 'axios';
import dotenv from 'dotenv';
import https from 'https';
import http from 'http';

dotenv.config();

export class LLMService {
    private baseUrl: string;
    private apiKey: string;
    private model: string;
    private httpsAgent: https.Agent;
    private httpAgent: http.Agent;

    constructor() {
        // Defaults to remote Python FastAPI server
        // FORCE the IP provided by user, ignoring .env for now since .env is read-only/stuck
        this.baseUrl = 'http://54.84.200.147:8080'; 
        this.apiKey = process.env.LLM_API_KEY || 'tt-printer-key_key-key';
        this.model = process.env.LLM_MODEL || 'llama3.1:8b';
        
        // HTTPS agent for remote APIs (skip SSL verification if needed)
        this.httpsAgent = new https.Agent({ 
            rejectUnauthorized: false,
            keepAlive: true 
        });

        // HTTP agent for non-SSL remote APIs
        this.httpAgent = new http.Agent({
            keepAlive: true
        });
    }

    async generate(prompt: string, systemPrompt: string = "You are a helpful assistant.", options: { temperature?: number, max_tokens?: number, task?: string } = {}): Promise<string> {
        try {
            // Task mapping based on user request
            // "fact" -> "phi3:mini"
            // "hook" -> "phi3:mini"
            // "motivation" -> "phi3:mini"
            // "story" -> "mistral:7b-instruct-q4_0"
            // Default to "fact" if not specified, or use the one passed in options
            const task = options.task || 'fact';
            
            // The prompt field contains both system and user instructions in a specific format
            // But for the new simple endpoint, maybe just sending "prompt" is enough if the backend handles system prompts?
            // The user's example shows:
            // "prompt": "You generate ONLY the factual body ... \n\nTopic: human body..."
            // It seems they are combining instructions into one prompt string.
            // My previous code combined system + user into `fullPrompt`. I will keep that.
            const fullPrompt = `### SYSTEM\n${systemPrompt}\n\n### USER\n${prompt}`;
            
            const payload = {
                task: task,
                prompt: fullPrompt
            };

            const headers: any = {
                'Content-Type': 'application/json'
            };

            // Use httpsAgent for HTTPS URLs, httpAgent for HTTP
            const isHttps = this.baseUrl.startsWith('https://');
            const axiosConfig: any = {
                headers,
                timeout: 0, // 0 = no timeout
                maxContentLength: Infinity,
                maxBodyLength: Infinity,
                httpAgent: false, // Disable http agent (no keep-alive)
                httpsAgent: false, // Disable https agent
                proxy: false
            };
            
            // Clean base URL to remove /v1 if present
            const cleanBaseUrl = this.baseUrl.replace(/\/v1$/, '');
            const endpoint = `${cleanBaseUrl}/generate`;

            console.log(`\n[LLMService] ----------------------------------------------------------------`);
            console.log(`[LLMService] 🕒 Request Start: ${new Date().toISOString()}`);
            console.log(`[LLMService] 🌐 Endpoint: ${endpoint}`);
            console.log(`[LLMService] ⚙️  Config: Timeout=${axiosConfig.timeout}, Agent=false`);
            console.log(`[LLMService] 📤 Payload:`, JSON.stringify(payload, null, 2));
            console.log(`[LLMService] ----------------------------------------------------------------\n`);

            const startTime = Date.now();
            const response = await axios.post(endpoint, payload, axiosConfig);
            const duration = (Date.now() - startTime) / 1000;

            console.log(`\n[LLMService] ----------------------------------------------------------------`);
            console.log(`[LLMService] 🕒 Response Received: ${new Date().toISOString()}`);
            console.log(`[LLMService] ⏱️  Duration: ${duration.toFixed(2)}s`);
            console.log(`[LLMService] 🔢 Status: ${response.status} ${response.statusText}`);
            console.log(`[LLMService] ----------------------------------------------------------------\n`);

            // The response format from the simple endpoint might be different. 
            // Assuming it returns a JSON with 'fact' or 'text' or just the raw text based on "generate-fact".
            // However, typical custom endpoints return a JSON. Let's inspect response.
            // If the user's curl example implies a direct response, we'll see. 
            // Usually these return { "response": "..." } or similar. 
            // If it mimics OpenAI somewhat it might have choices, but the input format is different.
            // Let's assume it returns { "response": "text" } or similar, or we log and see.
            // But wait, standard simple servers often return { "generated_text": ... } or just the body.
            // Let's assume response.data is the object and we need to find the text.
            
            let generatedText = "";
            if (typeof response.data === 'string') {
                generatedText = response.data;
            } else if (response.data.response) {
                generatedText = response.data.response;
            } else if (response.data.text) {
                generatedText = response.data.text;
            } else if (response.data.fact) {
                generatedText = response.data.fact;
            } else if (response.data.choices && response.data.choices[0]) {
                 generatedText = response.data.choices[0].message?.content || response.data.choices[0].text;
            } else {
                generatedText = JSON.stringify(response.data);
            }
            
            // Log raw LLM output
            console.log("\n" + "=".repeat(70));
            console.log("🤖 RAW LLM OUTPUT:");
            console.log("=".repeat(70));
            console.log(generatedText);
            console.log("=".repeat(70));
            console.log(`📏 Length: ${generatedText.length} characters\n`);

            return generatedText;
        } catch (error: any) {
            console.error("\n" + "=".repeat(70));
            console.error(`❌ LLM Generation Error [${new Date().toISOString()}]`);
            console.error("Message:", error.message);
            console.error("Code:", error.code);
            
            if (error.response) {
                console.error("Server Status:", error.response.status);
                console.error("Server Headers:", JSON.stringify(error.response.headers, null, 2));
                console.error("Server Data:", JSON.stringify(error.response.data, null, 2));
            } else if (error.request) {
                console.error("No response received from server.");
            }
            console.error("=".repeat(70) + "\n");
            
            // Instead of returning mock, throw error so agents can handle it properly
            throw new Error(`LLM service unavailable: ${error.message}.`);
        }
    }
}

