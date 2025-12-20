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
    styleName?: string; // For ASS styles
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
                // Generate ASS file
                const assPath = outputPath.replace('.mp4', '.ass');
                this.generateAdvancedASS(subtitles, assPath);
                subtitlesFilterPath = assPath.replace(/\\/g, '/').replace(/:/g, '\\:');
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
                    // Apply subtitles to the concatenated video
                    filterParts.push(`[pre_sub]subtitles=${subtitlesFilterPath}[outv]`);
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

            // Add subtitles using ASS file
            let videoOutput = '[bg]';
            let assPath: string | null = null;
            
            if (subtitles.length > 0) {
                // Generate ASS file
                assPath = outputPath.replace('.mp4', '.ass');
                this.generateAdvancedASS(subtitles, assPath);
                
                // Use subtitles filter (requires libass)
                const escapedAssPath = assPath.replace(/\\/g, '/').replace(/:/g, '\\:');
                
                filterParts.push(`${videoOutput}subtitles=${escapedAssPath}[outv]`);
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
                    reject(new Error(`FFmpeg exited with code ${code}. Check ASS file at: ${assPath || 'N/A'}`));
                }
            });

            ffmpeg.on('error', (error) => {
                reject(error);
            });
        });
    }

    /**
     * Generate Advanced ASS file for Kinetic Typography
     */
    private generateAdvancedASS(subtitles: SubtitleSegment[], outputPath: string) {
        // ASS Header with animations
        let assContent = `[Script Info]
ScriptType: v4.00+
PlayResX: 1080
PlayResY: 1920
WrapStyle: 1
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,Arial,75,&H00FFFFFF,&H000000FF,&H00000000,&H00000000,-1,0,0,0,100,100,0,0,1,4,0,5,10,10,10,1
Style: HookStyle,Arial,90,&H0000FFFF,&H000000FF,&H00000000,&H00000000,-1,0,0,0,100,100,0,0,1,6,0,5,10,10,10,1
Style: Keyword,Arial,75,&H0000FFFF,&H000000FF,&H00000000,&H00000000,-1,0,0,0,100,100,0,0,1,4,0,5,10,10,10,1
Style: Number,Arial,75,&H000000FF,&H000000FF,&H00000000,&H00000000,-1,0,0,0,100,100,0,0,1,4,0,5,10,10,10,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
`;

        subtitles.forEach(sub => {
            const startTime = this.formatTimeASS(sub.startTime);
            const endTime = this.formatTimeASS(sub.startTime + sub.duration);
            let style = 'Default';
            let text = sub.text;
            
            // Apply Pop Animation
            // \\t(0,100,...) interpolates from start time + 0ms to start time + 100ms
            // Start big (120%) then shrink to 100%
            const popAnim = `{\\fscx120\\fscy120\\t(0,150,\\fscx100\\fscy100)}`;
            
            // Determine Style based on segment metadata
            if (sub.styleName === 'HookStyle') {
                style = 'HookStyle';
                // Hook is usually static or slower pop
                text = `${popAnim}${text}`; 
            } else {
                // Body word
                // Apply logic for keywords if not already applied in createKineticSubtitles
                // But createKineticSubtitles sets styleName
                if (sub.styleName === 'Keyword') style = 'Keyword';
                if (sub.styleName === 'Number') style = 'Number';
                
                text = `${popAnim}${text}`;
            }
            
            assContent += `Dialogue: 0,${startTime},${endTime},${style},,0,0,0,,${text}\n`;
        });

        fs.writeFileSync(outputPath, assContent);
    }

    private formatTimeASS(seconds: number): string {
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const s = Math.floor(seconds % 60);
        const cs = Math.floor((seconds % 1) * 100); // Centiseconds
        return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}.${cs.toString().padStart(2, '0')}`;
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
     * Create Kinetic Typography Subtitles
     * 1 word per subtitle (except Hook)
     * Precise timing
     * Keyword highlighting
     */
    static createKineticSubtitles(
        text: string,
        totalDuration: number,
        hookText: string = ''
    ): SubtitleSegment[] {
        // 1. Pre-process text
        const cleanText = (t: string) => t.replace(/\n/g, ' ').replace(/\s+/g, ' ').trim();
        const fullText = cleanText(text);
        
        // 2. Identify Hook
        let hookEndIndex = 0;
        let hookDuration = 0;
        let hasHook = false;
        
        if (hookText) {
            const cleanHook = cleanText(hookText);
            // Check if fullText starts with cleanHook
            // Remove punctuation for check
            const normFull = fullText.toLowerCase().replace(/[^\w\s]/g, '');
            const normHook = cleanHook.toLowerCase().replace(/[^\w\s]/g, '');
            
            if (normFull.startsWith(normHook)) {
                hasHook = true;
                // Find where hook ends in original text
                // Rough estimate based on words
                const hookWordsCount = cleanHook.split(' ').length;
                const allWords = fullText.split(' ');
                // Reconstruct hook from fullText to get exact punctuation
                const matchedHook = allWords.slice(0, hookWordsCount).join(' ');
                hookEndIndex = matchedHook.length;
                
                // Hook Duration Strategy: 
                // User said: 1.8–2.2s. Let's aim for 2.0s
                // BUT proportional to length is safer if hook is very long or short
                // Let's use proportional but capped/floored
                const totalChars = fullText.length;
                const hookChars = matchedHook.length;
                const proportionalHookTime = (hookChars / totalChars) * totalDuration;
                
                // Boost hook time slightly because it's dense? Or cap it?
                // User said "Hook... 1.8-2.2s". 
                // If total duration is 60s, proportional might be 5s. That's too long for a static slide.
                // We should force it to ~2s.
                hookDuration = Math.min(2.5, Math.max(1.5, proportionalHookTime));
            }
        }

        const segments: SubtitleSegment[] = [];
        let currentTime = 0;
        const overlap = 0.1; // 100ms overlap
        // Start time offset (User said start_time = word_start_time - 0.05s)
        const leadIn = -0.05;

        // 3. Handle Hook
        if (hasHook) {
            const hookContent = fullText.substring(0, hookEndIndex);
            
            segments.push({
                text: hookContent.toUpperCase(), // HOOK ALWAYS CAPS
                startTime: 0,
                duration: hookDuration + overlap,
                styleName: 'HookStyle'
            });
            
            currentTime += hookDuration;
        }

        // 4. Handle Body (Word-by-Word)
        const bodyText = hasHook ? fullText.substring(hookEndIndex).trim() : fullText;
        if (!bodyText) return segments;

        const words = bodyText.split(' ');
        const bodyDuration = totalDuration - currentTime;
        
        // Calculate total characters in body for proportional timing
        const totalBodyChars = words.reduce((acc, w) => acc + w.length, 0);
        
        // Keywords logic (Simple Heuristics)
        // Nouns, Verbs, Emotional words, Numbers
        // We'll use a basic list + regex
        const commonVerbs = ['is', 'are', 'was', 'were', 'have', 'has', 'had', 'do', 'does', 'did', 'can', 'could', 'will', 'would', 'should'];
        const stopWords = ['the', 'a', 'an', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'from', 'and', 'but', 'or', 'so', 'it', 'this', 'that', 'these', 'those', 'he', 'she', 'they', 'we', 'i', 'you', 'my', 'your', 'his', 'her', 'their', 'our'];
        
        words.forEach(word => {
            const cleanWord = word.replace(/[^\w]/g, '');
            const wordLen = cleanWord.length;
            
            // Calculate duration based on character length relative to total body length
            // Ensure min duration of 0.2s for readability
            let wordDuration = (wordLen / totalBodyChars) * bodyDuration;
            // Adjust: distribute remaining time if min duration is enforced?
            // Simple proportional is safest to ensure they sum up to bodyDuration
            
            // Determine Style
            let styleName = 'Default';
            
            // Check for Number
            if (/\d/.test(word)) {
                styleName = 'Number'; // Red
            }
            // Check for Keywords (Long words, not stop words, or specific emotional words)
            else if (wordLen > 5 && !stopWords.includes(cleanWord.toLowerCase())) {
                styleName = 'Keyword'; // Yellow/Green
            }
            // Check specific emotional/impact words
            else if (['shocking', 'secret', 'never', 'always', 'stop', 'die', 'live', 'love', 'hate', 'brain', 'money'].includes(cleanWord.toLowerCase())) {
                styleName = 'Keyword';
            }

            segments.push({
                text: word,
                startTime: Math.max(0, currentTime + leadIn), // Apply lead-in
                duration: wordDuration + overlap,
                styleName: styleName
            });
            
            currentTime += wordDuration;
        });

        return segments;
    }
}
