import axios from 'axios';
import https from 'https';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config();

export interface ImageGenerationOptions {
    style?: string;
    negativePrompt?: string;
    numInferenceSteps?: number;
    width?: number;
    height?: number;
    seed?: number;
}

export interface ImageService {
    generateImage(prompt: string, outputPath: string, options?: ImageGenerationOptions): Promise<string>;
}

export class RemoteImageGenerator implements ImageService {
    private apiBase: string;
    private apiKey: string;
    private httpsAgent: https.Agent;

    constructor() {
        this.apiBase = process.env.IMAGE_API_URL || 'http://localhost:8001';
        this.apiKey = process.env.IMAGE_API_KEY || process.env.API_KEY || 'tt-printer-secret-key-2025';
        this.httpsAgent = new https.Agent({ rejectUnauthorized: false });
    }

    async generateImage(
        prompt: string,
        outputPath: string,
        options: ImageGenerationOptions = {}
    ): Promise<string> {
        const {
            style = 'simple_cartoon',
            negativePrompt,
            numInferenceSteps = 20,
            width = 512,
            height = 512,
            seed
        } = options;

        const payload = {
            prompt,
            style,
            negative_prompt: negativePrompt,
            num_inference_steps: numInferenceSteps,
            width,
            height,
            seed
        };

        try {
            console.log(`[RemoteImageGenerator] Generating image:`);
            console.log(`  Prompt: "${prompt}"`);
            console.log(`  Style: ${style}`);
            console.log(`  Steps: ${numInferenceSteps}`);
            console.log(`  Size: ${width}x${height}`);
            console.log(`  Negative Prompt: ${negativePrompt || 'default'}`);

            const isHttps = this.apiBase.startsWith('https://');
            const axiosConfig: any = {
                headers: {
                    'Content-Type': 'application/json',
                    'X-API-Key': this.apiKey
                },
                timeout: 900000 // 15 minutes timeout for image generation (CPU can be very slow)
            };

            if (isHttps) {
                axiosConfig.httpsAgent = this.httpsAgent;
            }

            const response = await axios.post(
                `${this.apiBase}/generate-image`,
                payload,
                axiosConfig
            );

            const imageUrl = response.data.image_url;
            const fullImageUrl = imageUrl.startsWith('http')
                ? imageUrl
                : `${this.apiBase}${imageUrl}`;

            // Download the image
            console.log(`[RemoteImageGenerator] Downloading image from: ${fullImageUrl}`);
            const imageResponse = await axios.get(fullImageUrl, {
                responseType: 'arraybuffer',
                httpsAgent: isHttps ? this.httpsAgent : undefined,
                timeout: 60000
            });

            // Ensure output directory exists
            const dir = path.dirname(outputPath);
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }

            // Write image file
            fs.writeFileSync(outputPath, Buffer.from(imageResponse.data));
            
            const stats = fs.statSync(outputPath);
            console.log(`[RemoteImageGenerator] Image saved to: ${outputPath} (${(stats.size / 1024).toFixed(2)} KB)`);
            console.log(`[RemoteImageGenerator] Seed used: ${response.data.seed}`);

            return outputPath;
        } catch (error: any) {
            console.error(`[RemoteImageGenerator] Error generating image:`, error.message);
            if (error.response) {
                console.error(`[RemoteImageGenerator] Status:`, error.response.status);
                console.error(`[RemoteImageGenerator] Response:`, error.response.data);
            }
            throw error;
        }
    }
}

