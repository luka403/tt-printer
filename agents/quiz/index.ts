import { BaseAgent, AgentTask } from '../../core/agent';
import { LLMService } from '../../core/llm';
import { RemoteImageGenerator } from '../../core/image_generator';
import { QuizVideoRenderer } from './video_renderer';
import { db } from '../../core/db';
import path from 'path';
import fs from 'fs';
import ffmpeg from 'fluent-ffmpeg';
import ffmpegPath from 'ffmpeg-static';

if (ffmpegPath) {
    ffmpeg.setFfmpegPath(ffmpegPath);
}

export interface QuizData {
    title: string;
    hook: string;
    options: string[];
    reveals: string[];
    outro: string;
}

export class QuizAgent extends BaseAgent {
    private llm: LLMService;
    private imageGen: RemoteImageGenerator;
    private videoRenderer: QuizVideoRenderer;
    private quizThemes = [
        "emotional style",
        "personality traits",
        "mindset",
        "intuition tests",
        "abstract shape choices"
    ];

    constructor() {
        super({ name: 'QuizAgent', type: 'content', niche: 'psychology_quiz' });
        this.llm = new LLMService();
        this.imageGen = new RemoteImageGenerator();
        this.videoRenderer = new QuizVideoRenderer();
    }

    async processTask(task: AgentTask): Promise<any> {
        this.log(`Processing task: ${task.type}`);

        if (task.type === 'generate_daily_quiz') {
            return this.generateDailyQuiz();
        }
        
        throw new Error(`Unknown task type: ${task.type}`);
    }

    async generateDailyQuiz() {
        // 1. Generate Quiz Content (JSON)
        const theme = this.quizThemes[Math.floor(Math.random() * this.quizThemes.length)];
        this.log(`Generating quiz for theme: ${theme}`);
        const quizData = await this.generateQuizContent(theme);
        
        this.log(`Quiz generated: ${quizData.title}`);

        // 2. Generate Visuals
        const visuals = await this.generateVisuals(quizData);
        
        // 3. Render Video
        const videoPath = path.join(visuals.baseDir, 'final_quiz_video.mp4');
        const finalVideo = await this.videoRenderer.renderVideo(quizData, visuals, videoPath);

        return {
            quiz: quizData,
            visuals: visuals,
            videoPath: finalVideo
        };
    }

    private async generateQuizContent(theme: string): Promise<QuizData> {
        const systemPrompt = `You are a creative content generator for a viral TikTok Psychology Quiz channel.
        Your goal is to create short, engaging personality or intuition tests.
        
        Output MUST be valid JSON in this exact format:
        {
            "title": "Short catchy title",
            "hook": "Question to hook the viewer (e.g. 'Pick a shape to reveal your hidden power')",
            "options": ["Description of Option A", "Description of Option B", "Description of Option C"],
            "reveals": ["Meaning of Option A", "Meaning of Option B", "Meaning of Option C"],
            "outro": "Follow for more daily tests"
        }
        
        Keep text concise. The whole video is 15-20 seconds.
        Reveals should be positive/mystical/insightful.
        Option descriptions should be abstract visual descriptions (e.g. "Glowing blue triangle", "Swirling purple mist").`;

        const userPrompt = `Create a psychology quiz about: ${theme}. 
        Make it mysterious and engaging. 
        For the options, describe 3 distinct abstract shapes/colors.`;

        const response = await this.llm.generate(userPrompt, systemPrompt, { max_tokens: 500, temperature: 0.9 });
        
        try {
            // Clean up code blocks if present
            const cleanJson = response.replace(/```json/g, '').replace(/```/g, '').trim();
            return JSON.parse(cleanJson);
        } catch (e) {
            this.log(`Error parsing JSON: ${response}`);
            throw new Error("Failed to parse LLM response as JSON");
        }
    }

    private async generateVisuals(quiz: QuizData) {
        this.log("Generating visuals...");
        const timestamp = Date.now();
        const baseDir = path.resolve(process.cwd(), 'assets', 'quiz', `${timestamp}`);
        
        // Ensure directory exists
        if (!fs.existsSync(baseDir)) {
            fs.mkdirSync(baseDir, { recursive: true });
        }

        const optionColors = ['#FF0000', '#00FF00', '#0000FF'];
        const revealColors = ['#880000', '#008800', '#000088'];
        
        // Generate Option Images
        const optionImages = [];
        for (let i = 0; i < quiz.options.length; i++) {
            const outputPath = path.join(baseDir, `option_${i}.png`);
            try {
                const prompt = `minimalistic neon abstract art, ${quiz.options[i]}, black background, glowing, 8k, spiritual, tarot style, mystical`;
                await this.imageGen.generateImage(prompt, outputPath, {
                    width: 720,
                    height: 1280, 
                    style: 'neon_abstract'
                });
            } catch (error) {
                this.log(`Image generation failed for option ${i}, using fallback.`);
                await this.generateFallbackImage(optionColors[i], outputPath);
            }
            optionImages.push(outputPath);
        }

        // Generate Reveal Images
        const revealImages = [];
        for (let i = 0; i < quiz.reveals.length; i++) {
            const outputPath = path.join(baseDir, `reveal_${i}.png`);
            try {
                const prompt = `minimalistic neon abstract art, ${quiz.options[i]}, intense glow, magical aura, revelation, 8k, spiritual`;
                await this.imageGen.generateImage(prompt, outputPath, {
                    width: 720,
                    height: 1280,
                    style: 'neon_abstract'
                });
            } catch (error) {
                this.log(`Image generation failed for reveal ${i}, using fallback.`);
                await this.generateFallbackImage(revealColors[i], outputPath);
            }
            revealImages.push(outputPath);
        }

        return {
            baseDir,
            optionImages,
            revealImages
        };
    }

    private async generateFallbackImage(color: string, outputPath: string): Promise<void> {
        return new Promise((resolve, reject) => {
            ffmpeg()
                .input(`color=c=${color}:s=720x1280`)
                .inputFormat('lavfi')
                .frames(1)
                .save(outputPath)
                .on('end', () => resolve())
                .on('error', (err) => reject(err));
        });
    }
}

