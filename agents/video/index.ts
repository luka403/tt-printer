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
        const { videoId, script, niche, noSubtitles } = task.payload;
        this.log(`Starting video production for Video ${videoId} (Niche: ${niche})`);

        const outputDir = path.resolve(__dirname, `../../videos/processed`);
        const debugDir = path.join(outputDir, `${videoId}_debug`);
        const imagesDir = path.join(outputDir, `${videoId}_images`);
        const tempAudioPath = path.join(outputDir, `${videoId}_audio.mp3`);
        const finalVideoPath = path.join(outputDir, `${videoId}_final.mp4`);

        // Create all directories
        if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });
        if (!fs.existsSync(debugDir)) fs.mkdirSync(debugDir, { recursive: true });
        if (!fs.existsSync(imagesDir)) fs.mkdirSync(imagesDir, { recursive: true });

        // Save script to debug directory
        fs.writeFileSync(path.join(debugDir, 'script.txt'), script);
        this.log(`📝 Script saved to debug directory: ${debugDir}`);

        // 1. Generate Audio (Remote Kokoro TTS)
        let audioDuration: number;
        try {
            // For scary stories, use a deeper/creepier voice
            const voice = niche === 'scary_stories' ? 'af_alloy' : 'af_bella';
            this.log(`🎤 Generating audio with voice: ${voice}`);
            await this.tts.generateAudio(script, tempAudioPath, { voice, speed: 0.9 }); // Slightly slower for dramatic effect
            
            // Verify audio file exists
            if (!fs.existsSync(tempAudioPath)) {
                throw new Error(`Audio file was not created: ${tempAudioPath}`);
            }
            
            const audioSize = fs.statSync(tempAudioPath).size;
            this.log(`✅ Audio generated: ${(audioSize / 1024).toFixed(2)} KB`);
            
            // Copy audio to debug directory
            fs.copyFileSync(tempAudioPath, path.join(debugDir, 'audio.mp3'));
            
            // Get audio duration
            audioDuration = await this.getAudioDuration(tempAudioPath);
            this.log(`⏱️  Audio duration: ${audioDuration.toFixed(2)} seconds`);
            
            // Save audio info to debug
            fs.writeFileSync(path.join(debugDir, 'audio_info.txt'), 
                `Duration: ${audioDuration.toFixed(2)}s\nSize: ${(audioSize / 1024).toFixed(2)} KB\nVoice: ${voice}`);
        } catch (e: any) {
            this.log(`❌ Audio generation failed: ${e.message}`);
            fs.writeFileSync(path.join(debugDir, 'error_audio.txt'), `Error: ${e.message}\n${e.stack}`);
            return { status: 'failed', error: `Audio generation failed: ${e.message}` };
        }

        // 2. Check if we should use Drive videos (skip image generation)
        const useDriveVideos = task.payload.useDriveVideos === true;
        
        if (useDriveVideos) {
            this.log('🎬 Using Drive videos - skipping image generation...');
            try {
                await this.renderWithDriveVideos(videoId, tempAudioPath, finalVideoPath, script, audioDuration, niche, debugDir, task.payload.hook || '', noSubtitles);
                
                // Verify video was created
                if (!fs.existsSync(finalVideoPath)) {
                    throw new Error(`Video file was not created: ${finalVideoPath}`);
                }
                
                const videoSize = fs.statSync(finalVideoPath).size;
                this.log(`✅ Video created successfully: ${(videoSize / 1024 / 1024).toFixed(2)} MB`);
                
                // Copy final video to debug directory
                fs.copyFileSync(finalVideoPath, path.join(debugDir, 'final_video.mp4'));
                
            } catch (e: any) {
                this.log(`❌ Video rendering failed: ${e.message}`);
                fs.writeFileSync(path.join(debugDir, 'error_video.txt'), `Error: ${e.message}\n${e.stack}`);
                return { status: 'failed', error: `Video rendering failed: ${e.message}` };
            }
        } else {
            // 3. Generate Story Images
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

        // Verify final video exists
        if (!fs.existsSync(finalVideoPath)) {
            const errorMsg = `Final video file does not exist: ${finalVideoPath}`;
            this.log(`❌ ${errorMsg}`);
            fs.writeFileSync(path.join(debugDir, 'error_final.txt'), errorMsg);
            return { status: 'failed', error: errorMsg };
        }

        const videoSize = fs.statSync(finalVideoPath).size;
        this.log(`✅ Final video ready: ${finalVideoPath} (${(videoSize / 1024 / 1024).toFixed(2)} MB)`);
        
        // Save final info to debug
        fs.writeFileSync(path.join(debugDir, 'final_info.txt'), 
            `Video ID: ${videoId}\nNiche: ${niche}\nPath: ${finalVideoPath}\nSize: ${(videoSize / 1024 / 1024).toFixed(2)} MB\nAudio Duration: ${audioDuration.toFixed(2)}s`);

        // Update DB
        db.run(`UPDATE videos SET status = ?, file_path = ? WHERE id = ?`, 
            ['ready', finalVideoPath, videoId]);

        this.log(`📁 Debug files saved to: ${debugDir}`);
        return { videoId, filePath: finalVideoPath, status: 'completed', debugDir };
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

    private async transcribeWithWhisper(audioPath: string, jsonPath: string): Promise<boolean> {
        return new Promise((resolve) => {
            // Define User Paths
            const homeDir = process.env.HOME || '/root';
            const saputacDir = path.join(homeDir, 'saputac');
            const scriptName = 'transcribe.py'; // Or 'transcribe' if executable
            let scriptPath = path.join(saputacDir, scriptName);
            
            // Check variations
            if (!fs.existsSync(scriptPath)) {
                if (fs.existsSync(path.join(saputacDir, 'transcribe'))) {
                    scriptPath = path.join(saputacDir, 'transcribe'); // Executable/No extension
                } else if (fs.existsSync(path.join(saputacDir, 'trancribe.py'))) {
                    scriptPath = path.join(saputacDir, 'trancribe.py'); // Typo
                } else {
                    // Final fallback: local project script
                    scriptPath = path.resolve(__dirname, '../../core/python/transcribe_timestamp.py');
                    this.log('⚠️ User script not found in ~/saputac. Falling back to local core script.');
                }
            }

            this.log(`🎤 Running Transcription Script: ${scriptPath}`);
            
            // Logic for saputac script: It saves to ~/saputac/{output_filename}
            // We need to pass just the filename for output
            const outputFileName = `words_${Date.now()}.json`;
            const expectedOutputPath = path.join(saputacDir, outputFileName);
            
            // Call arguments
            // If it's the core script, it expects full path.
            // If it's the user script (saputac), it might behave differently.
            // USER SAID: "on cuva output u ~/saputac/{output} tako da u imenu mu dajes tipa words.json"
            
            let args: string[] = [];
            let isUserScript = scriptPath.includes('saputac');

            if (isUserScript) {
                // User Script: python ~/saputac/transcribe.py <audio_path> <output_filename>
                args = [scriptPath, audioPath, outputFileName];
            } else {
                // Internal Script: python script.py <audio_path> <full_output_path>
                args = [scriptPath, audioPath, jsonPath];
            }

            const pythonCmd = 'python3'; 
            this.log(`   Command: ${pythonCmd} ${args.join(' ')}`);

            const pythonProcess = spawn(pythonCmd, args);

            pythonProcess.stdout.on('data', (data) => {
                const msg = data.toString().trim();
                if (msg) this.log(`[Whisper] ${msg}`);
            });
            
            pythonProcess.stderr.on('data', (data) => {
                // this.log(`[Whisper Stderr] ${data.toString()}`);
            });

            pythonProcess.on('close', (code) => {
                // Handle success
                if (code === 0) {
                    if (isUserScript) {
                        // Move file from ~/saputac/words.json to our jsonPath
                        if (fs.existsSync(expectedOutputPath)) {
                            this.log(`✅ Found output at ${expectedOutputPath}, moving to destination...`);
                            fs.renameSync(expectedOutputPath, jsonPath);
                            resolve(true);
                        } else {
                            this.log(`❌ Script finished but output file missing at: ${expectedOutputPath}`);
                            resolve(false);
                        }
                    } else {
                        // Internal script writes directly to jsonPath
                        if (fs.existsSync(jsonPath)) {
                            this.log('✅ Transcription JSON generated successfully');
                            resolve(true);
                        } else {
                            this.log('❌ Transcription failed (No output).');
                            resolve(false);
                        }
                    }
                } else {
                    this.log('❌ Transcription failed. Code: ' + code);
                    resolve(false);
                }
            });
            
            pythonProcess.on('error', (err) => {
                this.log('❌ Failed to spawn python process: ' + err.message);
                resolve(false);
            });
        });
    }

    private async generateKaraokePython(audioPath: string, outputAssPath: string): Promise<boolean> {
        return new Promise((resolve) => {
            // Check if python script exists
            const scriptPath = path.resolve(__dirname, '../../core/python/generate_karaoke.py');
            if (!fs.existsSync(scriptPath)) {
                this.log('❌ Python script not found: ' + scriptPath);
                resolve(false);
                return;
            }

            this.log('🎤 Running WhisperX for Viral Karaoke...');
            // Try python3 first, then python
            const pythonCmd = 'python3'; 
            const pythonProcess = spawn(pythonCmd, [scriptPath, audioPath, outputAssPath]);

            let output = '';
            pythonProcess.stdout.on('data', (data) => {
                output += data.toString();
                // Only show relevant output lines to keep logs clean
                if (data.toString().includes('Processing') || data.toString().includes('Generated')) {
                    this.log(`[Python] ${data.toString().trim()}`);
                }
            });
            
            pythonProcess.stderr.on('data', (data) => {
                // WhisperX prints a lot of info to stderr
                // this.log(`[Python Error] ${data.toString()}`);
            });

            pythonProcess.on('close', (code) => {
                if (code === 0 && fs.existsSync(outputAssPath)) {
                    this.log('✅ Karaoke ASS generated successfully via Python');
                    resolve(true);
                } else {
                    this.log('❌ Karaoke generation failed (fallback to estimator). Code: ' + code);
                    resolve(false);
                }
            });
            
            pythonProcess.on('error', (err) => {
                this.log('❌ Failed to spawn python process: ' + err.message);
                resolve(false);
            });
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

    private async getVideoDuration(videoPath: string): Promise<number> {
        return new Promise((resolve, reject) => {
            const ffprobe = spawn('ffprobe', [
                '-i', videoPath,
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
                    reject(new Error(`Could not get video duration for ${videoPath}`));
                }
            });

            ffprobe.on('error', (error) => {
                reject(error);
            });
        });
    }

    /**
     * Render video using local video clips from assets/drive_videos
     */
    private async renderWithDriveVideos(
        videoId: number,
        audioPath: string,
        outputPath: string,
        script: string,
        audioDuration: number,
        niche: string,
        debugDir: string,
        hookText: string = '',
        noSubtitles: boolean = false
    ): Promise<void> {
        try {
            // Check ENV for specific drive path or target video file
            const envDrivePath = process.env.DRIVE_VIDEOS_PATH;
            const envTargetVideo = process.env.TARGET_VIDEO_FILE;
            
            // Use env path if available, otherwise default
            const driveVideosPath = envDrivePath 
                ? path.resolve(envDrivePath)
                : path.resolve(__dirname, `../../assets/drive_videos`);
            
            if (!fs.existsSync(driveVideosPath)) {
                // If using default, error. If using custom env, maybe we need to create it?
                // Let's assume user configured it correctly.
                const errorMsg = `Drive videos directory does not exist: ${driveVideosPath}`;
                this.log(`❌ ${errorMsg}`);
                fs.writeFileSync(path.join(debugDir, 'error_drive_videos.txt'), errorMsg);
                throw new Error(errorMsg);
            }

            let backgroundVideo = '';

            // If a specific target file is set in ENV, use it
            if (envTargetVideo) {
                const targetPath = path.join(driveVideosPath, envTargetVideo);
                if (fs.existsSync(targetPath)) {
                    backgroundVideo = targetPath;
                    this.log(`🎥 Using specific ENV target video: ${envTargetVideo}`);
                } else {
                    this.log(`⚠️ ENV target video not found: ${envTargetVideo}. Falling back to random selection.`);
                }
            }

            // If no background video selected yet, pick random
            if (!backgroundVideo) {
                // List all available video files
                const localVideoFiles = fs.readdirSync(driveVideosPath)
                    .filter(f => /\.(mp4|mov|avi|mkv)$/i.test(f))
                    .map(f => path.join(driveVideosPath, f))
                    .filter(f => fs.existsSync(f));

                if (localVideoFiles.length === 0) {
                    const errorMsg = `No video files found in ${driveVideosPath}`;
                    this.log(`❌ ${errorMsg}`);
                    fs.writeFileSync(path.join(debugDir, 'error_drive_videos.txt'), errorMsg);
                    throw new Error(errorMsg);
                }

                this.log(`✅ Found ${localVideoFiles.length} video file(s) in ${driveVideosPath}`);
                
                // Save video list to debug
                fs.writeFileSync(path.join(debugDir, 'drive_videos_list.txt'), 
                    localVideoFiles.map(f => `${f}\n`).join(''));

                // Pick ONE video at random
                backgroundVideo = localVideoFiles[Math.floor(Math.random() * localVideoFiles.length)];
                this.log(`🎥 Selected random background video: ${path.basename(backgroundVideo)}`);
            }
            
            // Verify background video exists and get info
            if (!fs.existsSync(backgroundVideo)) {
                throw new Error(`Background video does not exist: ${backgroundVideo}`);
            }
            
            const bgVideoSize = fs.statSync(backgroundVideo).size;
            this.log(`   Size: ${(bgVideoSize / 1024 / 1024).toFixed(2)} MB`);

            // Get video duration
            const videoDuration = await this.getVideoDuration(backgroundVideo);
            this.log(`   Video Duration: ${videoDuration.toFixed(2)}s`);
            this.log(`   Audio Duration: ${audioDuration.toFixed(2)}s`);

            // Logic: Calculate start time and loop setting
            let startTime = 0;
            let loopBackground = false;

            if (videoDuration > audioDuration) {
                // Case 1: Video > Audio
                // Pick random start_time between 0 and (video_duration - audio_duration)
                const maxStartTime = videoDuration - audioDuration;
                startTime = Math.random() * maxStartTime;
                loopBackground = false;
                this.log(`   Condition: Video > Audio. Cutting segment from ${startTime.toFixed(2)}s to ${(startTime + audioDuration).toFixed(2)}s`);
            } else {
                // Case 2: Video <= Audio
                // Loop video seamlessly until it covers full audio duration
                startTime = 0;
                loopBackground = true;
                this.log(`   Condition: Video <= Audio. Looping background video.`);
            }

            // Create subtitles
            let subtitles: SubtitleSegment[] = [];
            let assFilePath: string | undefined = undefined;

            if (!noSubtitles) {
                // Strategy: Try Faster-Whisper -> JSON -> Typewriter ASS
                const whisperJsonPath = path.join(debugDir, 'transcription.json');
                const assPath = path.join(debugDir, 'subtitles.ass');
                
                this.log(`📝 Attempting Faster-Whisper Alignment...`);
                const whisperSuccess = await this.transcribeWithWhisper(audioPath, whisperJsonPath);
                
                if (whisperSuccess) {
                    this.log(`✅ Whisper succeeded! Generating Typewriter ASS...`);
                    // Load JSON
                    const whisperData = JSON.parse(fs.readFileSync(whisperJsonPath, 'utf-8'));
                    
                    // Generate ASS with Typewriter effect via VideoComposer static method (we will add this)
                    VideoComposer.generateTypewriterASS(whisperData, assPath, hookText);
                    
                    assFilePath = assPath;
                } 
                // Fallback to internal estimator if Whisper fails
                else {
                    this.log(`⚠️ Whisper unavailable/failed. Falling back to internal estimator.`);
                    
                    this.log(`📝 Generating Kinetic Subtitles with Hook: "${hookText.substring(0, 20)}..."`);
                    subtitles = VideoComposer.createKineticSubtitles(script, audioDuration, hookText);
                    this.log(`📝 Generated ${subtitles.length} kinetic subtitle segments`);
                    
                    // Save subtitles to debug
                    const srtPath = path.join(debugDir, 'subtitles.srt');
                    this.generateSRT(subtitles, srtPath);
                    this.log(`   Saved SRT to: ${srtPath}`);
                }
            } else {
                this.log('🚫 Subtitles disabled by configuration');
            }
            
            if (subtitles.length > 0) {
                 // Save subtitle info for fallback
                 fs.writeFileSync(path.join(debugDir, 'subtitles_info.txt'), 
                    `Total segments: ${subtitles.length}\nTotal duration: ${audioDuration.toFixed(2)}s\n` +
                    subtitles.map((s, i) => `${i + 1}. ${s.startTime.toFixed(2)}s - ${(s.startTime + s.duration).toFixed(2)}s: ${s.text.substring(0, 50)}...`).join('\n'));
            }

            // Compose video with background video + audio + subtitles
            this.log(`🎬 Composing video...`);
            this.log(`   Output: ${outputPath}`);
            this.log(`   Background: ${backgroundVideo}`);
            this.log(`   Audio: ${audioPath}`);
            this.log(`   Duration: ${audioDuration.toFixed(2)}s`);
            
            await this.videoComposer.compose({
                outputPath,
                backgroundVideo,
                audioPath,
                subtitles,
                width: 1080,
                height: 1920,
                fps: 30,
                backgroundStartTime: startTime,
                loopBackground: loopBackground,
                assFilePath // Pass pre-generated ASS if available
            });

            // Verify output exists
            if (!fs.existsSync(outputPath)) {
                throw new Error(`Composed video was not created: ${outputPath}`);
            }
            
            this.log(`✅ Video composed successfully with Drive video as background`);
        } catch (error: any) {
            this.log(`❌ Failed to use Drive videos: ${error.message}`);
            fs.writeFileSync(path.join(debugDir, 'error_render.txt'), 
                `Error: ${error.message}\nStack: ${error.stack}`);
            throw error; // Re-throw to be caught by caller
        }
    }
    
    private generateSRT(subtitles: SubtitleSegment[], outputPath: string) {
        let srtContent = '';
        subtitles.forEach((sub, index) => {
            const startTime = this.formatTime(sub.startTime);
            const endTime = this.formatTime(sub.startTime + sub.duration);
            srtContent += `${index + 1}\n${startTime} --> ${endTime}\n${sub.text}\n\n`;
        });
        fs.writeFileSync(outputPath, srtContent);
    }

    private formatTime(seconds: number): string {
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const secs = Math.floor(seconds % 60);
        const ms = Math.floor((seconds % 1) * 1000);
        return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')},${ms.toString().padStart(3, '0')}`;
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
        const subtitles = VideoComposer.createKineticSubtitles(script, audioDuration);

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
        const subtitles = VideoComposer.createKineticSubtitles(scriptText, audioDuration);

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
