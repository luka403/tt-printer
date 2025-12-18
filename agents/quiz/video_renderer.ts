import ffmpeg from 'fluent-ffmpeg';
import ffmpegPath from 'ffmpeg-static';
import path from 'path';
import fs from 'fs';
import { QuizData } from './index';

// Set ffmpeg path
if (ffmpegPath) {
    ffmpeg.setFfmpegPath(ffmpegPath);
}

export class QuizVideoRenderer {
    private fontPath: string;

    constructor() {
        // Try to find a font, fallback to system font on macOS
        this.fontPath = '/System/Library/Fonts/Helvetica.ttc'; 
        if (!fs.existsSync(this.fontPath)) {
             // Fallback for Linux/Windows or if not found
             this.fontPath = 'Arial'; // Hope ffmpeg finds it
        }
    }

    async renderVideo(
        quiz: QuizData, 
        visuals: { optionImages: string[], revealImages: string[] }, 
        outputFile: string
    ): Promise<string> {
        console.log(`[QuizVideoRenderer] Rendering video to ${outputFile}...`);
        
        const tempDir = path.dirname(outputFile);
        const segments: string[] = [];

        try {
            // 1. Hook Segment (2s) - Use Option A image blurred or just as is
            const hookPath = path.join(tempDir, 'segment_hook.mp4');
            await this.createSlide(
                visuals.optionImages[0], 
                quiz.hook, 
                2, 
                hookPath, 
                { blur: true, title: "QUIZ TIME" }
            );
            segments.push(hookPath);

            // 2. Options Segments (2s each)
            const optionsLabels = ['A', 'B', 'C'];
            for (let i = 0; i < 3; i++) {
                const optionPath = path.join(tempDir, `segment_option_${i}.mp4`);
                await this.createSlide(
                    visuals.optionImages[i], 
                    `Option ${optionsLabels[i]}`, 
                    2, 
                    optionPath,
                    { subtitle: quiz.options[i] } // Show short description?
                );
                segments.push(optionPath);
            }

            // 3. Reveal Segments (3s each)
            for (let i = 0; i < 3; i++) {
                const revealPath = path.join(tempDir, `segment_reveal_${i}.mp4`);
                await this.createSlide(
                    visuals.revealImages[i], 
                    quiz.reveals[i], 
                    3, 
                    revealPath,
                    { title: `Meaning of ${optionsLabels[i]}` }
                );
                segments.push(revealPath);
            }

            // 4. Outro Segment (2s)
            const outroPath = path.join(tempDir, 'segment_outro.mp4');
            await this.createSlide(
                visuals.revealImages[2], // Use last image
                quiz.outro, 
                2, 
                outroPath,
                { blur: true }
            );
            segments.push(outroPath);

            // 5. Concatenate all segments
            await this.concatSegments(segments, outputFile);

            // Cleanup temp files
            segments.forEach(seg => {
                if (fs.existsSync(seg)) fs.unlinkSync(seg);
            });

            console.log(`[QuizVideoRenderer] Video rendered successfully: ${outputFile}`);
            return outputFile;

        } catch (error) {
            console.error("[QuizVideoRenderer] Error rendering video:", error);
            throw error;
        }
    }

    private async createSlide(
        imagePath: string, 
        text: string, 
        duration: number, 
        outputPath: string,
        options: { blur?: boolean, title?: string, subtitle?: string } = {}
    ): Promise<void> {
        return new Promise((resolve, reject) => {
            let command = ffmpeg(imagePath);

            // Input options
            command.loop(duration);

            // Video filters
            const filters: string[] = [
                // Scale to vertical HD
                'scale=1080:1920:force_original_aspect_ratio=increase',
                'crop=1080:1920'
            ];

            if (options.blur) {
                filters.push('boxblur=20:2');
            }

            // Text processing - escape single quotes
            const cleanText = text.replace(/'/g, '').replace(/:/g, '\\:');
            const cleanTitle = options.title ? options.title.replace(/'/g, '').replace(/:/g, '\\:') : '';
            
            // Draw Main Text (Center)
            // Note: fontfile needs absolute path usually.
            const fontPart = fs.existsSync(this.fontPath) ? `fontfile='${this.fontPath}':` : '';
            
            filters.push(
                `drawtext=${fontPart}text='${cleanText}':fontcolor=white:fontsize=60:x=(w-text_w)/2:y=(h-text_h)/2:box=1:boxcolor=black@0.5:boxborderw=10`
            );

            if (options.title) {
                filters.push(
                    `drawtext=${fontPart}text='${cleanTitle}':fontcolor=yellow:fontsize=80:x=(w-text_w)/2:y=150:box=1:boxcolor=black@0.5:boxborderw=10`
                );
            }

            command.videoFilters(filters)
                .outputOptions([
                    '-c:v libx264',
                    '-pix_fmt yuv420p',
                    '-t', duration.toString(),
                    '-r 30'
                ])
                .save(outputPath)
                .on('end', () => resolve())
                .on('error', (err) => {
                    console.error(`Error creating slide ${outputPath}:`, err);
                    reject(err);
                });
        });
    }

    private async concatSegments(segments: string[], outputPath: string): Promise<void> {
        return new Promise((resolve, reject) => {
            const command = ffmpeg();
            
            segments.forEach(seg => {
                command.input(seg);
            });

            command.on('error', (err) => reject(err))
                .on('end', () => resolve())
                .mergeToFile(outputPath, path.dirname(outputPath)); // fluent-ffmpeg merge needs temp dir usually
        });
    }
}

