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
    backgroundStartTime?: number; // Start time for background video
    loopBackground?: boolean; // Whether to loop background video
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
            audioCodec = 'aac',
            backgroundStartTime = 0,
            loopBackground = false
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
                audioCodec,
                startTime: backgroundStartTime,
                loop: loopBackground
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
            let subtitlesFilterPath = '';
            
            if (subtitles.length > 0) {
                // Generate SRT file
                const srtPath = outputPath.replace('.mp4', '.srt');
                this.generateSRT(subtitles, srtPath);
                subtitlesFilterPath = srtPath.replace(/\\/g, '/').replace(/:/g, '\\:');
            }

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

                segmentFilter += `setpts=PTS-STARTPTS`;
                
                // Apply subtitles to segments if needed (though usually better on concatenated output)
                // For segments composition, we'll apply subtitles after concat
                
                segmentFilter += `[v${index}]`;
                filterParts.push(segmentFilter);
                segmentOutputs.push(`[v${index}]`);
                videoInputIndex++;
            });

            // Concatenate all video segments
            let concatOutput = '[outv]';
            if (segmentOutputs.length > 0) {
                if (subtitlesFilterPath) {
                    filterParts.push(`${segmentOutputs.join('')}concat=n=${segmentOutputs.length}:v=1:a=0[pre_sub]`);
                    // Apply subtitles to the concatenated video with improved style
                    filterParts.push(`[pre_sub]subtitles=${subtitlesFilterPath}:force_style='Fontname=Arial,Fontsize=24,PrimaryColour=&H00FFFFFF,OutlineColour=&H00000000,BackColour=&H00000000,BorderStyle=1,Outline=2,Shadow=1,Alignment=10,MarginL=40,MarginR=40,MarginV=50'[outv]`);
                } else {
                    filterParts.push(`${segmentOutputs.join('')}concat=n=${segmentOutputs.length}:v=1:a=0[outv]`);
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
        startTime?: number;
        loop?: boolean;
    }): Promise<string> {
        const { outputPath, backgroundVideo, audioPath, audioDuration, subtitles, width, height, fps, audioVolume, videoCodec, audioCodec, startTime = 0, loop = false } = options;

        return new Promise((resolve, reject) => {
            const args: string[] = [];
            const filterParts: string[] = [];

            // Add background video options
            if (loop) {
                args.push('-stream_loop', '-1');
            }
            
            if (startTime > 0) {
                args.push('-ss', startTime.toString());
            }

            args.push('-i', backgroundVideo);

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
                const escapedSrtPath = srtPath.replace(/\\/g, '/').replace(/:/g, '\\:');
                
                filterParts.push(`${videoOutput}subtitles=${escapedSrtPath}:force_style='Fontname=Arial,Fontsize=24,PrimaryColour=&H00FFFFFF,OutlineColour=&H00000000,BackColour=&H00000000,BorderStyle=1,Outline=2,Shadow=1,Alignment=10,MarginL=40,MarginR=40,MarginV=50'[outv]`);
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
                if (code === 0) {
                    console.log('\n[VideoComposer] Composition complete');
                    resolve(outputPath);
                } else {
                    console.error('\n[VideoComposer] Error:', errorOutput.substring(errorOutput.length - 1000));
                    reject(new Error(`FFmpeg exited with code ${code}. Check SRT file at: ${srtPath || 'N/A'}`));
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
        hookText: string = ''
    ): SubtitleSegment[] {
        // Clean and split words
        const cleanText = (t: string) => t.replace(/\n/g, ' ').replace(/\s+/g, ' ').trim();
        const allWords = cleanText(text).split(' ');
        
        // Identify hook words
        let hookWords: string[] = [];
        if (hookText) {
            const cleanHook = cleanText(hookText);
            const hookWordsTemp = cleanHook.split(' ');
            
            // Try to match hook at the beginning
            let matchCount = 0;
            for(let i=0; i<hookWordsTemp.length; i++) {
                if (allWords[i] && allWords[i].toLowerCase().includes(hookWordsTemp[i].toLowerCase().replace(/[^\w]/g,''))) {
                    matchCount++;
                }
            }
            if (matchCount > hookWordsTemp.length * 0.5) {
                hookWords = allWords.slice(0, hookWordsTemp.length);
            }
        }

        const segments: SubtitleSegment[] = [];
        let currentTime = 0;
        
        // Settings requested by user
        // WORDS_PER_SUBTITLE = 3 (Range 2-4)
        const targetWordsPerSegment = 3; 
        // SUBTITLE_DELAY_MS = 150 (+150ms delay)
        // If this means "start 150ms later", then offset = 0.15
        const offset = 0.15; 

        // Grouping logic
        const groups: { text: string, isHook: boolean, wordCount: number }[] = [];
        let currentGroup: string[] = [];
        let isCurrentGroupHook: boolean = false;

        const isHookWord = (index: number) => index < hookWords.length;

        for (let i = 0; i < allWords.length; i++) {
            const word = allWords[i];
            const isHook = isHookWord(i);

            if (currentGroup.length === 0) {
                currentGroup.push(word);
                isCurrentGroupHook = isHook;
            } else {
                // Check if we should split
                const currentIsHook: boolean = isCurrentGroupHook;

                // 1. Transition Hook <-> Body -> ALWAYS SPLIT
                if (currentIsHook !== isHook) {
                    groups.push({
                        text: currentGroup.join(' '),
                        isHook: currentIsHook,
                        wordCount: currentGroup.length
                    });
                    currentGroup = [word];
                    isCurrentGroupHook = isHook;
                }
                // 2. Hook Mode: Keep full hook together? Or split?
                // User said: "HOOK u CAPS" and "Primer: THIS FOOD NEVER GOES BAD"
                // The example shows the whole hook on one line (5 words).
                // So if it's hook, we try to keep it together unless it's too long.
                else if (isHook) {
                    // If hook is very long (> 7 words), maybe split. 
                    // But user example has 5 words on one line.
                    // Let's stick to max 6 words for hook to be safe for mobile width.
                    if (currentGroup.length >= 6) {
                         groups.push({
                            text: currentGroup.join(' '),
                            isHook: true,
                            wordCount: currentGroup.length
                        });
                        currentGroup = [word];
                    } else {
                        currentGroup.push(word);
                    }
                }
                // 3. Body Mode: 2-4 words per line (Target 3)
                else {
                    if (currentGroup.length >= targetWordsPerSegment) {
                        groups.push({
                            text: currentGroup.join(' '),
                            isHook: false,
                            wordCount: currentGroup.length
                        });
                        currentGroup = [word];
                    } else {
                        currentGroup.push(word);
                    }
                }
            }
        }
        
        // Push last group
        if (currentGroup.length > 0) {
            groups.push({
                text: currentGroup.join(' '),
                isHook: isCurrentGroupHook,
                wordCount: currentGroup.length
            });
        }

        // Timing Distribution (Proportional to word count)
        const totalWords = allWords.length;
        
        groups.forEach(group => {
            // Calculate duration proportional to word count
            const groupDuration = (group.wordCount / totalWords) * totalDuration;
            
            // Apply Uppercase for Hook
            const finalText = group.isHook ? group.text.toUpperCase() : group.text;
            
            // Style override for Hook? 
            // VideoComposer usually handles style in filter_complex via ForceStyle or ASS.
            // Since we are using SRT with ForceStyle globally, we can't easily change style per line without ASS.
            // BUT, user asked for "HOOK u CAPS". That is handled here.
            // If we want different color/font for Hook, we need ASS or multiple SRT tracks.
            // For now, CAPS is what I can do easily in text.
            // To make it distinct, maybe add color tag if SRT supports it (some players do, ffmpeg burn-in might).
            // FFmpeg subtitles filter supports basic HTML-like tags: <font color="yellow">...</font>
            // Let's try that for Hook!
            
            const styledText = group.isHook 
                ? `<font color="yellow"><b>${finalText}</b></font>` // Yellow + Bold for Hook
                : finalText;

            if (groupDuration > 0) {
                segments.push({
                    text: styledText,
                    startTime: Math.max(0, currentTime + offset),
                    duration: groupDuration
                });
                currentTime += groupDuration;
            }
        });
        
        return segments;
    }
}
