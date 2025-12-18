import { BaseAgent, AgentTask } from '../../core/agent';
import { db } from '../../core/db';
import { RemoteKokoroTTS } from '../../core/tts';
import { SceneAnalyzer, Scene } from '../../core/scene_analyzer';
import { RemoteImageGenerator } from '../../core/image_generator';
import { VideoComposer, VideoSegment, SubtitleSegment } from '../../core/video_composer';
import { GoogleDriveService } from '../../core/drive';
import path from 'path';
import fs from 'fs';
import { spawn } from 'child_process';

export class VideoAgent extends BaseAgent {
    private tts: RemoteKokoroTTS;
    private sceneAnalyzer: SceneAnalyzer;
    private imageGenerator: RemoteImageGenerator;
    private videoComposer: VideoComposer;
    private driveService?: GoogleDriveService;

    constructor() {
        super({ name: 'VideoAgent', type: 'video' });
        this.tts = new RemoteKokoroTTS();
        this.sceneAnalyzer = new SceneAnalyzer();
        this.imageGenerator = new RemoteImageGenerator();
        this.videoComposer = new VideoComposer();
        
        // Initialize Drive service if folder ID is provided
        if (process.env.GOOGLE_DRIVE_FOLDER_ID) {
            this.driveService = new GoogleDriveService(process.env.GOOGLE_DRIVE_FOLDER_ID);
        }
    }

    async processTask(task: AgentTask): Promise<any> {
        const { videoId, script, niche } = task.payload;
        this.log(`Starting video production for Video ${videoId} (Niche: ${niche})`);

        const outputDir = path.resolve(__dirname, `../../videos/processed`);
        const imagesDir = path.join(outputDir, `${videoId}_images`);
        const tempAudioPath = path.join(outputDir, `${videoId}_audio.mp3`);
        const finalVideoPath = path.join(outputDir, `${videoId}_final.mp4`);

        if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });
        if (!fs.existsSync(imagesDir)) fs.mkdirSync(imagesDir, { recursive: true });

        // 1. Generate Audio (Remote Kokoro TTS)
        let audioDuration: number;
        try {
            // For scary stories, use a deeper/creepier voice
            const voice = niche === 'scary_stories' ? 'af_alloy' : 'af_bella';
            await this.tts.generateAudio(script, tempAudioPath, { voice, speed: 0.9 }); // Slightly slower for dramatic effect
            this.log('Audio generated');
            
            // Get audio duration
            audioDuration = await this.getAudioDuration(tempAudioPath);
            this.log(`Audio duration: ${audioDuration.toFixed(2)} seconds`);
        } catch (e) {
            this.log(`Audio generation failed: ${e}`);
            return { status: 'failed' };
        }

        // 2. Generate Story Images
        let scenes: Scene[] = [];
        try {
            this.log('Analyzing story and extracting scenes...');
            scenes = await this.sceneAnalyzer.analyzeStory(script, audioDuration, niche);
            this.log(`Extracted ${scenes.length} scenes`);

            // Generate images for each scene
            this.log('Generating images for scenes...');
            for (let i = 0; i < scenes.length; i++) {
                const scene = scenes[i];
                const imagePath = path.join(imagesDir, `scene_${i}.png`);
                
                this.log(`Generating image ${i + 1}/${scenes.length}: ${scene.description.substring(0, 50)}...`);
                
                try {
                    await this.imageGenerator.generateImage(scene.imagePrompt, imagePath, {
                        style: niche === 'scary_stories' ? 'simple_cartoon' : 'simple_cartoon',
                        width: 512,
                        height: 512,
                        numInferenceSteps: 30, // Increased for better quality
                        negativePrompt: 'blurry, low quality, distorted, ugly, bad anatomy, watermark, incomplete, unfinished, pixelated, low resolution, corrupted, glitch, artifacts, noise, grainy, out of focus'
                    });
                    
                    scene.imagePath = imagePath;
                    
                    // Save scene to database
                    db.run(
                        `INSERT INTO video_scenes (video_id, scene_index, timestamp, duration, description, image_prompt, image_path) 
                         VALUES (?, ?, ?, ?, ?, ?, ?)`,
                        [videoId, i, scene.timestamp, scene.duration, scene.description, scene.imagePrompt, imagePath]
                    );
                    
                    this.log(`✓ Image ${i + 1} generated: ${imagePath}`);
                } catch (error: any) {
                    this.log(`✗ Failed to generate image ${i + 1}: ${error.message}`);
                    // Continue with other images even if one fails
                }
            }
        } catch (e) {
            this.log(`Image generation failed: ${e}`);
            // Fallback to background video if image generation fails
            return await this.fallbackToBackgroundVideo(videoId, tempAudioPath, finalVideoPath, niche, script);
        }

        // 3. Check if we should use Drive videos or generated images
        const useDriveVideos = task.payload.useDriveVideos === true && this.driveService;
        
        if (useDriveVideos) {
            this.log('Using Google Drive videos...');
            await this.renderWithDriveVideos(videoId, tempAudioPath, finalVideoPath, script, audioDuration, niche);
        } else {
            // 4. Render Video with Generated Images
            const scenesWithImages = scenes.filter((s): s is Scene & { imagePath: string } => !!s.imagePath);
            if (scenesWithImages.length > 0) {
                this.log(`Rendering video with ${scenesWithImages.length} generated images...`);
                await this.renderVideoWithImages(scenesWithImages, tempAudioPath, finalVideoPath, audioDuration, script);
            } else {
                this.log('No images generated, falling back to background video');
                return await this.fallbackToBackgroundVideo(videoId, tempAudioPath, finalVideoPath, niche, script);
            }
        }

        // Update DB
        db.run(`UPDATE videos SET status = ?, file_path = ? WHERE id = ?`, 
            ['ready', finalVideoPath, videoId]);

        return { videoId, filePath: finalVideoPath, status: 'completed' };
    }

    private async fallbackToBackgroundVideo(
        videoId: number,
        audioPath: string,
        outputPath: string,
        niche: string,
        script: string
    ): Promise<any> {
        // Fallback to original background video method
        let bgPath = path.resolve(__dirname, `../../assets/broll/scary_loop.mp4`);
        if (!fs.existsSync(bgPath)) {
            bgPath = path.resolve(__dirname, `../../assets/broll/default_${niche}.mp4`);
            if (!fs.existsSync(bgPath)) {
                bgPath = path.resolve(__dirname, `../../assets/broll/default_motivation.mp4`);
            }
        }

        // If background video still doesn't exist (or was empty/deleted), generate a placeholder
        if (!fs.existsSync(bgPath)) {
            this.log(`Background video not found. Generating placeholder at ${bgPath}...`);
            try {
                // Ensure directory exists
                const brollDir = path.dirname(bgPath);
                if (!fs.existsSync(brollDir)) fs.mkdirSync(brollDir, { recursive: true });
                
                await this.generatePlaceholderVideo(bgPath, 10);
                this.log('Placeholder background generated.');
            } catch (e: any) {
                this.log(`Failed to generate placeholder: ${e.message}`);
                return { status: 'failed', error: 'No background video and failed to generate placeholder' };
            }
        }

        this.log(`Rendering video using background: ${bgPath}`);
        try {
            await this.renderVideo(bgPath, audioPath, outputPath, script);
            
            db.run(`UPDATE videos SET status = ?, file_path = ? WHERE id = ?`, 
                ['ready', outputPath, videoId]);

            return { videoId, filePath: outputPath, status: 'completed' };
        } catch (e: any) {
            this.log(`Video rendering failed: ${e.message}`);
            return { status: 'failed', error: e.message };
        }
    }

    private async generatePlaceholderVideo(outputPath: string, duration: number): Promise<void> {
        return new Promise((resolve, reject) => {
            const spawn = require('child_process').spawn;
            const ffmpeg = spawn('ffmpeg', [
                '-f', 'lavfi',
                '-i', `color=c=black:s=1080x1920:d=${duration}`,
                '-c:v', 'libx264',
                '-t', duration.toString(),
                '-pix_fmt', 'yuv420p',
                '-y',
                outputPath
            ]);
            
            ffmpeg.on('close', (code: number) => {
                if (code === 0) resolve();
                else reject(new Error(`Failed to generate placeholder video (code ${code})`));
            });
            
            ffmpeg.on('error', (err: Error) => reject(err));
        });
    }

    private async getAudioDuration(audioPath: string): Promise<number> {
        return new Promise((resolve, reject) => {
            const ffprobe = spawn('ffprobe', [
                '-i', audioPath,
                '-show_entries', 'format=duration',
                '-v', 'quiet',
                '-of', 'csv=p=0'
            ]);

            let duration = '';
            ffprobe.stdout.on('data', (data: Buffer) => {
                duration += data.toString();
            });

            ffprobe.on('close', (code) => {
                if (code === 0 && duration) {
                    const seconds = parseFloat(duration.trim());
                    resolve(seconds);
                } else {
                    // Fallback: estimate based on word count
                    reject(new Error('Could not get audio duration'));
                }
            });

            ffprobe.on('error', (error) => {
                reject(error);
            });
        });
    }

    /**
     * Render video using Google Drive video clips
     */
    private async renderWithDriveVideos(
        videoId: number,
        audioPath: string,
        outputPath: string,
        script: string,
        audioDuration: number,
        niche: string
    ): Promise<void> {
        if (!this.driveService) {
            console.warn('[VideoAgent] Google Drive service not initialized (missing FOLDER_ID?). Falling back to background video.');
            return await this.fallbackToBackgroundVideo(videoId, audioPath, outputPath, niche, script);
        }

        try {
            // Sync videos from Drive
            const driveVideosPath = path.resolve(__dirname, `../../assets/drive_videos`);
            const downloadedPaths = await this.driveService.syncVideos(driveVideosPath);
            this.log(`Synced ${downloadedPaths.length} new videos from Drive`);

            // List all available videos
            const allVideos = await this.driveService.listVideos();
            const localVideoFiles = fs.readdirSync(driveVideosPath)
                .filter(f => /\.(mp4|mov|avi)$/i.test(f))
                .map(f => path.join(driveVideosPath, f));

            if (localVideoFiles.length === 0) {
                this.log('No Drive videos available, falling back to background video');
                return await this.fallbackToBackgroundVideo(videoId, audioPath, outputPath, niche, script);
            }

            // Create video segments from Drive videos
            const videoSegments: VideoSegment[] = [];
            let currentTime = 0;
            const segmentDuration = audioDuration / Math.min(localVideoFiles.length, 5); // Use up to 5 clips

            for (let i = 0; i < Math.min(localVideoFiles.length, 5) && currentTime < audioDuration; i++) {
                const videoPath = localVideoFiles[i % localVideoFiles.length];
                const duration = Math.min(segmentDuration, audioDuration - currentTime);
                
                videoSegments.push({
                    path: videoPath,
                    duration: duration,
                    loop: true // Loop if video is shorter than needed
                });
                
                currentTime += duration;
            }

            // Create subtitles from script
            const subtitles = VideoComposer.createSubtitlesFromText(script, audioDuration);

            // Compose video
            await this.videoComposer.compose({
                outputPath,
                videoSegments,
                audioPath,
                subtitles,
                width: 1080,
                height: 1920,
                fps: 30
            });

            this.log('Video composed with Drive clips');
        } catch (error: any) {
            this.log(`Failed to use Drive videos: ${error.message}, falling back...`);
            return await this.fallbackToBackgroundVideo(videoId, audioPath, outputPath, niche, script);
        }
    }

    private async renderVideoWithImages(
        scenes: Array<Scene & { imagePath: string }>,
        audioPath: string,
        outputPath: string,
        audioDuration: number,
        script: string
    ): Promise<void> {
        // Convert scenes to video segments (images with duration)
        const videoSegments: VideoSegment[] = scenes.map(scene => ({
            path: scene.imagePath,
            duration: scene.duration,
            loop: true // Loop image for the duration
        }));

        // Create subtitles from script
        const subtitles = VideoComposer.createSubtitlesFromText(script, audioDuration);

        // Use VideoComposer to render
        await this.videoComposer.compose({
            outputPath,
            videoSegments,
            audioPath,
            subtitles,
            width: 1080,
            height: 1920,
            fps: 30
        });
    }

    private async renderVideo(bgPath: string, audioPath: string, outputPath: string, scriptText: string): Promise<void> {
        // Get audio duration
        const audioDuration = await this.getAudioDuration(audioPath);
        
        // Create subtitles from script
        const subtitles = VideoComposer.createSubtitlesFromText(scriptText, audioDuration);

        // Use VideoComposer to render with background video
        await this.videoComposer.compose({
            outputPath,
            backgroundVideo: bgPath,
            audioPath,
            subtitles,
            width: 1080,
            height: 1920,
            fps: 30
        });
    }
}
