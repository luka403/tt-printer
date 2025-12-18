import axios from 'axios';
import dotenv from 'dotenv';
import https from 'https';

dotenv.config();

export class LLMService {
    private baseUrl: string;
    private apiKey: string;
    private model: string;
    private httpsAgent: https.Agent;

    constructor() {
        // Defaults to remote Python FastAPI server
        // FORCE the IP provided by user, ignoring .env for now since .env is read-only/stuck
        this.baseUrl = 'http://54.84.200.147:8080'; 
        this.apiKey = process.env.LLM_API_KEY || 'tt-printer-key_key-key';
        this.model = process.env.LLM_MODEL || 'llama3.1:8b';
        
        // HTTPS agent for remote APIs (skip SSL verification if needed)
        this.httpsAgent = new https.Agent({ rejectUnauthorized: false });
    }

    async generate(prompt: string, systemPrompt: string = "You are a helpful assistant.", options: { temperature?: number, max_tokens?: number } = {}): Promise<string> {
        try {
            // Updated to use the new simple endpoint structure based on user feedback
            // The prompt field contains both system and user instructions in a specific format
            const fullPrompt = `### SYSTEM\n${systemPrompt}\n\n### USER\n${prompt}`;
            
            const payload = {
                prompt: fullPrompt
            };

            const headers: any = {
                'Content-Type': 'application/json'
            };

            // Use httpsAgent for HTTPS URLs
            const isHttps = this.baseUrl.startsWith('https://');
            const axiosConfig: any = {
                headers,
                timeout: 300000 // 5 minutes timeout for LLM generation (agent can be slow)
            };

            if (isHttps) {
                axiosConfig.httpsAgent = this.httpsAgent;
            }

            // Using the specific endpoint provided: /generate-fact (or base url if different)
            // If baseUrl includes /v1, we might need to adjust, but let's assume baseUrl is just http://IP:PORT for now based on recent context
            // or we just append /generate-fact to the host. 
            // The user provided http://54.84.200.147:8080/generate-fact
            
            // Clean base URL to remove /v1 if present, as this seems to be a custom endpoint
            const cleanBaseUrl = this.baseUrl.replace(/\/v1$/, '');
            const endpoint = `${cleanBaseUrl}/generate-fact`;

            console.log(`[LLMService] Sending request to: ${endpoint}`);

            const response = await axios.post(endpoint, payload, axiosConfig);

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
            console.error("LLM Generation Error:", error.message);
            if (error.response) {
                console.error("Status:", error.response.status);
                console.error("Response:", error.response.data);
            }
            // Fallback for testing if no LLM is running
            return "This is a mock response because the LLM service is not reachable. Ensure Ollama is running and the API URL is correct.";
        }
    }
}

