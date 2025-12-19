import { spawn } from 'child_process';
import path from 'path';
import axios from 'axios';
import https from 'https';
import fs from 'fs';
import dotenv from 'dotenv';

dotenv.config();

export interface TTSService {
    generateAudio(text: string, outputPath: string, options?: { voice?: string; speed?: number }): Promise<void>;
}

export class RemoteKokoroTTS implements TTSService {
    private apiBase: string;
    private httpsAgent: https.Agent;

    constructor() {
        this.apiBase = 'http://54.84.200.147:8880';
        this.httpsAgent = new https.Agent({ rejectUnauthorized: false });
    }

    async generateAudio(text: string, outputPath: string, options?: { voice?: string; speed?: number }): Promise<void> {
        const voice = options?.voice || 'af_alloy'; // Default voice from your example
        const speed = options?.speed || 1.0;

        // TTS API seems to have a limit around 100-120 characters
        // Split text into sentences and generate audio for each, then combine
        const MAX_CHARS_PER_CHUNK = 100;
        
        if (text.length <= MAX_CHARS_PER_CHUNK) {
            // Short text, generate directly
            await this.generateAudioChunk(text, outputPath, voice, speed);
        } else {
            // Long text, split and combine
            console.log(`[RemoteKokoroTTS] Text is long (${text.length} chars), splitting into chunks...`);
            await this.generateAudioChunked(text, outputPath, voice, speed, MAX_CHARS_PER_CHUNK);
        }
    }

    private async generateAudioChunk(text: string, outputPath: string, voice: string, speed: number): Promise<void> {

        const payload = {
            model: "kokoro",
            input: text,
            voice: voice,
            format: "mp3",
            speed: speed
        };

        try {
            console.log(`[RemoteKokoroTTS] Generating audio: "${text.substring(0, 30)}..." with voice ${voice}`);
            console.log(`[RemoteKokoroTTS] Text length: ${text.length} characters`);
            console.log(`[RemoteKokoroTTS] Full text being sent to TTS API:`);
            console.log("─".repeat(70));
            console.log(text);
            console.log("─".repeat(70));
            
            const response = await axios.post(`${this.apiBase}/v1/audio/speech`, payload, {
                responseType: 'arraybuffer',
                httpsAgent: this.httpsAgent,
                headers: {
                    'Content-Type': 'application/json',
                    'Origin': this.apiBase,
                    'Referer': `${this.apiBase}/web/`,
                    'User-Agent': 'Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36'
                },
                timeout: 300000, // Increased timeout to 5 minutes
                maxContentLength: Infinity,
                maxBodyLength: Infinity
            });

            // Check if we got data
            if (!response.data || response.data.byteLength === 0) {
                throw new Error('Empty response from TTS API');
            }

            const audioSize = response.data.byteLength;
            console.log(`[RemoteKokoroTTS] Received audio: ${(audioSize / 1024).toFixed(2)} KB`);

            // Ensure directory exists
            const dir = path.dirname(outputPath);
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }

            // Write audio file
            fs.writeFileSync(outputPath, Buffer.from(response.data));
            console.log(`[RemoteKokoroTTS] Audio saved to: ${outputPath} (${(audioSize / 1024).toFixed(2)} KB)`);
            
            // Verify file was written correctly
            const stats = fs.statSync(outputPath);
            if (stats.size !== audioSize) {
                throw new Error(`File size mismatch: expected ${audioSize}, got ${stats.size}`);
            }
            
            // Try to get audio duration if ffprobe is available
            const { spawn } = require('child_process');
            const ffprobe = spawn('ffprobe', ['-i', outputPath, '-show_entries', 'format=duration', '-v', 'quiet', '-of', 'csv=p=0'], { stdio: 'pipe' });
            
            let duration = '';
            ffprobe.stdout.on('data', (data: Buffer) => {
                duration += data.toString();
            });
            
            ffprobe.on('close', () => {
                if (duration) {
                    const seconds = parseFloat(duration.trim());
                    console.log(`[RemoteKokoroTTS] Audio duration: ${seconds.toFixed(2)} seconds`);
                    const expectedDuration = (text.split(' ').length * 0.5); // Rough estimate: 0.5s per word
                    if (seconds < expectedDuration * 0.7) {
                        console.warn(`[RemoteKokoroTTS] ⚠️  WARNING: Audio seems shorter than expected!`);
                        console.warn(`[RemoteKokoroTTS]    Expected: ~${expectedDuration.toFixed(1)}s, Got: ${seconds.toFixed(2)}s`);
                    }
                }
            });

        } catch (error: any) {
            console.error(`[RemoteKokoroTTS] Error:`, error.message);
            if (error.response) {
                console.error(`[RemoteKokoroTTS] Response data:`, error.response.data.toString());
            }
            throw error;
        }
    }

    private async generateAudioChunked(text: string, outputPath: string, voice: string, speed: number, maxChars: number): Promise<void> {
        // Split text by sentences (period, exclamation, question mark)
        const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
        
        const chunks: string[] = [];
        let currentChunk = '';
        
        for (const sentence of sentences) {
            if ((currentChunk + sentence).length <= maxChars) {
                currentChunk += sentence + ' ';
            } else {
                if (currentChunk) chunks.push(currentChunk.trim());
                currentChunk = sentence + ' ';
            }
        }
        if (currentChunk) chunks.push(currentChunk.trim());
        
        console.log(`[RemoteKokoroTTS] Split into ${chunks.length} chunks`);
        
        // Generate audio for each chunk
        const tempFiles: string[] = [];
        const dir = path.dirname(outputPath);
        const baseName = path.basename(outputPath, '.mp3');
        
        for (let i = 0; i < chunks.length; i++) {
            const tempPath = path.join(dir, `${baseName}_chunk_${i}.mp3`);
            console.log(`[RemoteKokoroTTS] Generating chunk ${i + 1}/${chunks.length} (${chunks[i].length} chars)...`);
            await this.generateAudioChunk(chunks[i], tempPath, voice, speed);
            tempFiles.push(tempPath);
        }
        
        // Combine all chunks using FFmpeg
        console.log(`[RemoteKokoroTTS] Combining ${chunks.length} audio chunks...`);
        await this.combineAudioFiles(tempFiles, outputPath);
        
        // Clean up temp files
        tempFiles.forEach(file => {
            try {
                fs.unlinkSync(file);
            } catch (e) {
                // Ignore cleanup errors
            }
        });
        
        console.log(`[RemoteKokoroTTS] ✅ Complete audio saved to: ${outputPath}`);
    }

    private async combineAudioFiles(inputFiles: string[], outputPath: string): Promise<void> {
        return new Promise((resolve, reject) => {
            const { spawn } = require('child_process');
            
            // Create FFmpeg concat file
            const concatFile = outputPath.replace('.mp3', '_concat.txt');
            const concatContent = inputFiles.map(f => `file '${f}'`).join('\n');
            fs.writeFileSync(concatFile, concatContent);
            
            // Use FFmpeg to concatenate
            const ffmpeg = spawn('ffmpeg', [
                '-f', 'concat',
                '-safe', '0',
                '-i', concatFile,
                '-c', 'copy',
                '-y',
                outputPath
            ]);
            
            ffmpeg.stderr.on('data', () => {
                // Ignore FFmpeg verbose output
            });
            
            ffmpeg.on('close', (code: number) => {
                // Clean up concat file
                try {
                    fs.unlinkSync(concatFile);
                } catch (e) {
                    // Ignore
                }
                
                if (code === 0) {
                    resolve();
                } else {
                    reject(new Error(`FFmpeg concat failed with code ${code}`));
                }
            });
        });
    }
}

export class LocalTTS implements TTSService {
    async generateAudio(text: string, outputPath: string, options?: { voice?: string; speed?: number }): Promise<void> {
        return new Promise((resolve, reject) => {
            const pythonScript = path.resolve(__dirname, 'python/tts_wrapper.py');
            
            // Spawn python process
            const pythonProcess = spawn('python3', [pythonScript, text, outputPath]);

            pythonProcess.stdout.on('data', (data) => {
                console.log(`[Python TTS]: ${data.toString().trim()}`);
            });

            pythonProcess.stderr.on('data', (data) => {
                console.error(`[Python TTS Error]: ${data.toString().trim()}`);
            });

            pythonProcess.on('close', (code) => {
                if (code === 0) {
                    resolve();
                } else {
                    reject(new Error(`TTS process exited with code ${code}`));
                }
            });
        });
    }
}
