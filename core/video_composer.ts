import { spawn } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

export interface VideoSegment {
    path: string;
    startTime?: number; // Start time in source video (for trimming)
    duration?: number; // Duration to use from this segment
    loop?: boolean; // Loop this segment if shorter than needed
}

export interface SubtitleSegment {
    text: string;
    startTime: number; // Start time in seconds
    duration: number; // Duration in seconds
    style?: SubtitleStyle;
}

export interface SubtitleStyle {
    fontSize?: number;
    fontColor?: string;
    backgroundColor?: string;
    position?: 'top' | 'center' | 'bottom';
    fontFamily?: string;
    outlineColor?: string;
    outlineWidth?: number;
}

export interface VideoCompositionOptions {
    outputPath: string;
    videoSegments?: VideoSegment[];
    audioPath?: string;
    subtitles?: SubtitleSegment[];
    backgroundVideo?: string; // Background video to use if no segments
    width?: number;
    height?: number;
    fps?: number;
    audioVolume?: number; // 0.0 to 1.0
    videoCodec?: string;
    audioCodec?: string;
}

export class VideoComposer {
    /**
     * Compose a video from multiple sources: video clips, audio, and subtitles
     */
    async compose(options: VideoCompositionOptions): Promise<string> {
        const {
            outputPath,
            videoSegments = [],
            audioPath,
            subtitles = [],
            backgroundVideo,
            width = 1080,
            height = 1920,
            fps = 30,
            audioVolume = 1.0,
            videoCodec = 'libx264',
            audioCodec = 'aac'
        } = options;

        // Ensure output directory exists
        const outputDir = path.dirname(outputPath);
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
        }

        // Get audio duration if audio is provided
        let audioDuration = 0;
        if (audioPath && fs.existsSync(audioPath)) {
            audioDuration = await this.getAudioDuration(audioPath);
        }

        // If we have video segments, compose with segments
        if (videoSegments.length > 0) {
            return await this.composeWithSegments({
                outputPath,
                videoSegments,
                audioPath,
                audioDuration,
                subtitles,
                width,
                height,
                fps,
                audioVolume,
                videoCodec,
                audioCodec
            });
        }

        // Otherwise, use background video with audio and subtitles
        if (backgroundVideo && fs.existsSync(backgroundVideo)) {
            return await this.composeWithBackground({
                outputPath,
                backgroundVideo,
                audioPath,
                audioDuration,
                subtitles,
                width,
                height,
                fps,
                audioVolume,
                videoCodec,
                audioCodec
            });
        }

        throw new Error('No video source provided (videoSegments or backgroundVideo required)');
    }

    /**
     * Compose video from multiple video segments
     */
    private async composeWithSegments(options: {
        outputPath: string;
        videoSegments: VideoSegment[];
        audioPath?: string;
        audioDuration: number;
        subtitles: SubtitleSegment[];
        width: number;
        height: number;
        fps: number;
        audioVolume: number;
        videoCodec: string;
        audioCodec: string;
    }): Promise<string> {
        const { outputPath, videoSegments, audioPath, audioDuration, subtitles, width, height, fps, audioVolume, videoCodec, audioCodec } = options;

        return new Promise((resolve, reject) => {
            const args: string[] = [];
            const filterParts: string[] = [];
            let videoInputIndex = 0;
            let audioInputIndex = -1;

            // Add audio input if provided
            if (audioPath && fs.existsSync(audioPath)) {
                audioInputIndex = videoInputIndex;
                args.push('-i', audioPath);
                videoInputIndex++;
            }

            // Process each video segment
            const segmentOutputs: string[] = [];
            videoSegments.forEach((segment, index) => {
                const inputIndex = videoInputIndex;
                args.push('-i', segment.path);

                // Calculate duration - use provided duration or audio duration or segment duration
                let segmentDuration = segment.duration;
                if (!segmentDuration) {
                    if (audioDuration > 0 && index === videoSegments.length - 1) {
                        // Last segment should match remaining audio
                        const previousDuration = videoSegments.slice(0, index).reduce((sum, s) => sum + (s.duration || 0), 0);
                        segmentDuration = Math.max(0, audioDuration - previousDuration);
                    }
                }

                // Build filter for this segment
                let segmentFilter = `[${inputIndex}:v]`;
                
                // Scale and pad to target dimensions
                segmentFilter += `scale=${width}:${height}:force_original_aspect_ratio=decrease,`;
                segmentFilter += `pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2,`;
                
                // Set duration if specified
                if (segmentDuration) {
                    segmentFilter += `setpts=PTS-STARTPTS,`;
                    segmentFilter += `trim=duration=${segmentDuration},`;
                }
                
                // Loop if needed
                if (segment.loop && segmentDuration) {
                    const loopCount = Math.ceil(segmentDuration / (segment.duration || 1));
                    segmentFilter += `loop=loop=${loopCount}:size=1:start=0,`;
                }

                segmentFilter += `setpts=PTS-STARTPTS[v${index}]`;
                filterParts.push(segmentFilter);
                segmentOutputs.push(`[v${index}]`);
                videoInputIndex++;
            });

            // Concatenate all video segments
            if (segmentOutputs.length > 0) {
                filterParts.push(`${segmentOutputs.join('')}concat=n=${segmentOutputs.length}:v=1:a=0[outv]`);
            }

            // Add subtitles if provided
            let finalVideoOutput = '[outv]';
            if (subtitles.length > 0) {
                const subtitleFilter = this.buildSubtitleFilter(subtitles, width, height, finalVideoOutput);
                if (subtitleFilter) {
                    filterParts.push(subtitleFilter);
                    finalVideoOutput = '[outv]';
                }
            }

            // Build complete filter
            const filterComplex = filterParts.join(';');

            // Build FFmpeg command
            const finalArgs = [
                ...args,
                '-filter_complex', filterComplex,
                '-map', '[outv]',
            ];

            // Add audio if provided
            if (audioInputIndex >= 0) {
                finalArgs.push('-map', `${audioInputIndex}:a`);
                
                // Apply volume if not 1.0
                if (audioVolume !== 1.0) {
                    finalArgs.push('-filter:a', `volume=${audioVolume}`);
                }
            }

            finalArgs.push(
                '-c:v', videoCodec,
                '-preset', 'medium',
                '-crf', '23',
                '-r', fps.toString(),
                '-c:a', audioCodec,
                '-b:a', '128k',
                '-shortest',
                '-pix_fmt', 'yuv420p',
                '-y',
                outputPath
            );

            console.log(`[VideoComposer] Composing video with ${videoSegments.length} segments...`);
            const ffmpeg = spawn('ffmpeg', finalArgs);

            let errorOutput = '';
            ffmpeg.stderr.on('data', (d: Buffer) => {
                const data = d.toString();
                errorOutput += data;
                if (data.includes('time=')) {
                    const match = data.match(/time=(\d+:\d+:\d+\.\d+)/);
                    if (match) {
                        process.stdout.write(`\r[VideoComposer] ${match[1]}`);
                    }
                }
            });

            ffmpeg.on('close', (code) => {
                if (code === 0) {
                    console.log('\n[VideoComposer] Composition complete');
                    resolve(outputPath);
                } else {
                    console.error('\n[VideoComposer] Error:', errorOutput.substring(errorOutput.length - 1000));
                    reject(new Error(`FFmpeg exited with code ${code}`));
                }
            });

            ffmpeg.on('error', (error) => {
                reject(error);
            });
        });
    }

    /**
     * Compose video with background video, audio, and subtitles
     */
    private async composeWithBackground(options: {
        outputPath: string;
        backgroundVideo: string;
        audioPath?: string;
        audioDuration: number;
        subtitles: SubtitleSegment[];
        width: number;
        height: number;
        fps: number;
        audioVolume: number;
        videoCodec: string;
        audioCodec: string;
    }): Promise<string> {
        const { outputPath, backgroundVideo, audioPath, audioDuration, subtitles, width, height, fps, audioVolume, videoCodec, audioCodec } = options;

        return new Promise((resolve, reject) => {
            const args: string[] = [];
            const filterParts: string[] = [];

            // Add background video (loop if needed)
            args.push('-stream_loop', '-1', '-i', backgroundVideo);

            // Add audio if provided
            if (audioPath && fs.existsSync(audioPath)) {
                args.push('-i', audioPath);
            }

            // Scale background video
            filterParts.push(`[0:v]scale=${width}:${height}:force_original_aspect_ratio=increase,crop=${width}:${height}[bg]`);

            // Add subtitles using SRT file
            let videoOutput = '[bg]';
            let srtPath: string | null = null;
            
            if (subtitles.length > 0) {
                // Generate SRT file
                srtPath = outputPath.replace('.mp4', '.srt');
                this.generateSRT(subtitles, srtPath);
                
                // Use subtitles filter (requires libass)
                // Escape path for filter
                const escapedSrtPath = srtPath.replace(/\\/g, '/').replace(/:/g, '\\:');
                
                // Note: subtitles filter takes filename, and applies to the input video stream.
                // We need to chain it after scaling.
                filterParts.push(`${videoOutput}subtitles=${escapedSrtPath}:force_style='Fontsize=24,PrimaryColour=&H00FFFFFF,BackColour=&H80000000,BorderStyle=3,Outline=1,Shadow=0,MarginV=20'[outv]`);
                videoOutput = '[outv]';
            } else {
                filterParts.push(`${videoOutput}copy[outv]`);
            }

            const filterComplex = filterParts.join(';');

            const finalArgs = [
                ...args,
                '-filter_complex', filterComplex,
                '-map', '[outv]',
            ];

            // Add audio if provided
            if (audioPath && fs.existsSync(audioPath)) {
                finalArgs.push('-map', '1:a');
                
                if (audioVolume !== 1.0) {
                    finalArgs.push('-filter:a', `volume=${audioVolume}`);
                }
            }

            finalArgs.push(
                '-c:v', videoCodec,
                '-preset', 'medium',
                '-crf', '23',
                '-r', fps.toString(),
                '-c:a', audioCodec,
                '-b:a', '128k',
                '-shortest',
                '-pix_fmt', 'yuv420p',
                '-y',
                outputPath
            );

            console.log(`[VideoComposer] Composing video with background...`);
            const ffmpeg = spawn('ffmpeg', finalArgs);

            let errorOutput = '';
            ffmpeg.stderr.on('data', (d: Buffer) => {
                const data = d.toString();
                errorOutput += data;
                if (data.includes('time=')) {
                    const match = data.match(/time=(\d+:\d+:\d+\.\d+)/);
                    if (match) {
                        process.stdout.write(`\r[VideoComposer] ${match[1]}`);
                    }
                }
            });

            ffmpeg.on('close', (code) => {
                // Cleanup SRT
                if (srtPath && fs.existsSync(srtPath)) {
                    fs.unlinkSync(srtPath);
                }

                if (code === 0) {
                    console.log('\n[VideoComposer] Composition complete');
                    resolve(outputPath);
                } else {
                    console.error('\n[VideoComposer] Error:', errorOutput.substring(errorOutput.length - 1000));
                    reject(new Error(`FFmpeg exited with code ${code}`));
                }
            });

            ffmpeg.on('error', (error) => {
                reject(error);
            });
        });
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
        const date = new Date(0);
        date.setMilliseconds(seconds * 1000);
        return date.toISOString().substr(11, 12).replace('.', ',');
    }

    /**
     * Build subtitle filter for FFmpeg
     */
    private buildSubtitleFilter(subtitles: SubtitleSegment[], width: number, height: number, videoInput: string): string {
        if (subtitles.length === 0) return '';

        // Chain multiple drawtext filters for each subtitle segment
        const drawtextFilters: string[] = [];

        subtitles.forEach((subtitle, index) => {
            const style = subtitle.style || {};
            const fontSize = style.fontSize || 60;
            const fontColor = style.fontColor || 'white';
            const backgroundColor = style.backgroundColor || 'black@0.5';
            const position = style.position || 'bottom';

            // Calculate Y position
            let yPos = height - 200; // Default bottom
            if (position === 'top') yPos = 100;
            else if (position === 'center') yPos = height / 2;

            // Escape text for FFmpeg
            const escapedText = subtitle.text
                .replace(/\\/g, '\\\\')
                .replace(/:/g, '\\:')
                .replace(/'/g, "\\'")
                .replace(/\[/g, '\\[')
                .replace(/\]/g, '\\]')
                .replace(/\n/g, ' ');

            // Build drawtext filter - chain them together
            // First one takes video input, subsequent ones take previous subtitle output
            const inputLabel = index === 0 ? videoInput : `[sub${index - 1}]`;
            const outputLabel = index === subtitles.length - 1 ? '[outv]' : `[sub${index}]`;
            
            const drawtext = `${inputLabel}drawtext=text='${escapedText}':fontsize=${fontSize}:fontcolor=${fontColor}:box=1:boxcolor=${backgroundColor}:boxborderw=10:x=(w-text_w)/2:y=${yPos}:enable='between(t,${subtitle.startTime},${subtitle.startTime + subtitle.duration})'${outputLabel}`;
            
            drawtextFilters.push(drawtext);
        });

        return drawtextFilters.join(';');
    }

    /**
     * Get audio duration in seconds
     */
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
                    reject(new Error('Could not get audio duration'));
                }
            });

            ffprobe.on('error', (error) => {
                reject(error);
            });
        });
    }

    /**
     * Split text into subtitle segments based on timing
     * Helper method to automatically create subtitles from text and audio duration
     */
    static createSubtitlesFromText(
        text: string,
        totalDuration: number,
        wordsPerSecond: number = 2.5
    ): SubtitleSegment[] {
        const words = text.split(' ');
        const wordCount = words.length;
        const estimatedDuration = wordCount / wordsPerSecond;
        
        // If estimated duration is close to total, use it
        const actualDuration = Math.min(estimatedDuration, totalDuration);
        const wordsPerSegment = Math.ceil(wordCount / Math.ceil(actualDuration / 3)); // 3 second segments
        
        const segments: SubtitleSegment[] = [];
        let currentTime = 0;
        
        for (let i = 0; i < words.length; i += wordsPerSegment) {
            const segmentWords = words.slice(i, i + wordsPerSegment);
            const segmentText = segmentWords.join(' ');
            const segmentDuration = Math.min(3, totalDuration - currentTime);
            
            if (segmentDuration > 0 && segmentText.trim()) {
                segments.push({
                    text: segmentText,
                    startTime: currentTime,
                    duration: segmentDuration
                });
                currentTime += segmentDuration;
            }
        }
        
        return segments;
    }
}

