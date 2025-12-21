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
    assFilePath?: string; // Pre-generated ASS file path
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
            loopBackground = false,
            assFilePath
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
                audioCodec,
                assFilePath
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
                loop: loopBackground,
                assFilePath
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
        assFilePath?: string;
    }): Promise<string> {
        const { outputPath, videoSegments, audioPath, audioDuration, subtitles, width, height, fps, audioVolume, videoCodec, audioCodec, assFilePath } = options;

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
            
            if (assFilePath && fs.existsSync(assFilePath)) {
                 subtitlesFilterPath = assFilePath.replace(/\\/g, '/').replace(/:/g, '\\:');
            } else if (subtitles.length > 0) {
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
        assFilePath?: string;
    }): Promise<string> {
        const { outputPath, backgroundVideo, audioPath, audioDuration, subtitles, width, height, fps, audioVolume, videoCodec, audioCodec, startTime = 0, loop = false, assFilePath } = options;

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
            let finalAssPath: string | null = null;
            
            if (assFilePath && fs.existsSync(assFilePath)) {
                 finalAssPath = assFilePath;
            } else if (subtitles.length > 0) {
                // Generate ASS file
                finalAssPath = outputPath.replace('.mp4', '.ass');
                this.generateAdvancedASS(subtitles, finalAssPath);
            }

            if (finalAssPath) {
                // Use subtitles filter (requires libass)
                const escapedAssPath = finalAssPath.replace(/\\/g, '/').replace(/:/g, '\\:');
                
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
                    reject(new Error(`FFmpeg exited with code ${code}. Check ASS file at: ${finalAssPath || 'N/A'}`));
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
        // ASS Header with animations - VIRAL WHITE STYLE
        let assContent = `[Script Info]
ScriptType: v4.00+
PlayResX: 1080
PlayResY: 1920
WrapStyle: 1
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,Arial,85,&H00FFFFFF,&H000000FF,&H00000000,&H00000000,-1,0,0,0,100,100,0,0,1,3,0,5,10,10,600,1
Style: HookStyle,Arial,100,&H00FFFFFF,&H000000FF,&H00000000,&H00000000,-1,0,0,0,100,100,0,0,1,5,0,5,10,10,600,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
`;

        subtitles.forEach(sub => {
            const startTime = this.formatTimeASS(sub.startTime);
            const endTime = this.formatTimeASS(sub.startTime + sub.duration);
            let style = 'Default';
            let text = sub.text;
            
            // Viral Pop Animation (Fast & Snappy)
            // Starts at 115% and snaps to 100% in 80ms
            const popAnim = `{\\fscx115\\fscy115\\t(0,80,\\fscx100\\fscy100)}`;
            
            if (sub.styleName === 'HookStyle') {
                style = 'HookStyle';
                text = `${popAnim}${text.toUpperCase()}`; 
            } else {
                // ALL CAPS FOR BODY TOO (Viral Standard)
                text = `${popAnim}${text.toUpperCase()}`;
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

    static generateTypewriterASS(words: { word: string, start: number, end: number }[], outputPath: string, hookText: string = '') {
        const leadIn = -0.10; // 100ms lead-in

        let assContent = `[Script Info]
ScriptType: v4.00+
PlayResX: 1080
PlayResY: 1920
WrapStyle: 1
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,Arial,85,&H00FFFFFF,&H000000FF,&H00000000,&H00000000,-1,0,0,0,100,100,0,0,1,3,0,5,10,10,600,1
Style: HookStyle,Arial,100,&H00FFFFFF,&H000000FF,&H00000000,&H00000000,-1,0,0,0,100,100,0,0,1,5,0,5,10,10,600,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
`;

        const toAssTime = (seconds: number) => {
            const h = Math.floor(seconds / 3600);
            const m = Math.floor((seconds % 3600) / 60);
            const s = Math.floor(seconds % 60);
            const cs = Math.floor((seconds % 1) * 100);
            return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}.${cs.toString().padStart(2, '0')}`;
        };

        // Determine Hook Range
        let hookWordsCount = 0;
        if (hookText) {
            const cleanHook = hookText.replace(/\n/g, ' ').replace(/\s+/g, ' ').trim();
            hookWordsCount = cleanHook.split(' ').length;
        }

        // Process Words
        let currentHookGroup: string[] = [];
        let hookStartTime = -1;
        let hookEndTime = -1;

        words.forEach((w, index) => {
            const isHook = index < hookWordsCount;
            const startTime = Math.max(0, w.start + leadIn);
            const endTime = w.end;
            const text = w.word.toUpperCase().replace(/[^\w]/g, ''); // Clean punctuation

            if (isHook) {
                // Group hook words into one big block if possible, or line by line
                // For Viral feel, hook usually static or 2-3 lines.
                // Let's print hook words individually but with HookStyle? 
                // OR group them? 
                // "Your brain processes images..." -> "YOUR BRAIN" (pop) "PROCESSES" (pop)...
                // Let's stick to word-by-word for now to be safe, but bigger font.
                
                const anim = `{\\fscx115\\fscy115\\t(0,80,\\fscx100\\fscy100)}`;
                assContent += `Dialogue: 0,${toAssTime(startTime)},${toAssTime(endTime)},HookStyle,,0,0,0,,${anim}${text}\n`;
            } else {
                // Body: Typewriter or Pop?
                // User asked for: "animacija je kao da se pise rec ne samo da se pojavljuje"
                // Typewriter effect per letter:
                // {\alpha&HFF&}\t(0, 50, \alpha&H00&)
                // We need to split word into letters and time them.
                
                const letters = text.split('');
                const duration = (endTime - startTime) * 1000; // ms
                const step = Math.min(50, duration / letters.length); // ms per letter
                
                let letterTags = '';
                letters.forEach((char, i) => {
                    // Start invisible (alpha FF), fade in (alpha 00) at specific time
                    // But standard Typewriter is usually accumulative text.
                    // Here we have ONE word on screen. 
                    // So we just reveal letters of THAT word.
                    
                    const delay = i * step;
                    // \alpha&HFF& = Invisible
                    // \t(delay, delay+1, \alpha&H00&) = Become visible
                    // We need to set initial alpha for the whole line to transparent? No, per character.
                    
                    letterTags += `{\\alpha&HFF&\\t(${delay.toFixed(0)},${(delay+1).toFixed(0)},\\alpha&H00&)}${char}`;
                });
                
                // Also add a slight scale pop for the whole word container?
                // Let's keep it simple: Just letters appearing.
                
                assContent += `Dialogue: 0,${toAssTime(startTime)},${toAssTime(endTime)},Default,,0,0,0,,${letterTags}\n`;
            }
        });

        fs.writeFileSync(outputPath, assContent);
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
            const normFull = fullText.toLowerCase().replace(/[^\w\s]/g, '');
            const normHook = cleanHook.toLowerCase().replace(/[^\w\s]/g, '');
            
            if (normFull.startsWith(normHook)) {
                hasHook = true;
                const hookWordsCount = cleanHook.split(' ').length;
                const allWords = fullText.split(' ');
                const matchedHook = allWords.slice(0, hookWordsCount).join(' ');
                hookEndIndex = matchedHook.length;
                
                const totalChars = fullText.length;
                const hookChars = matchedHook.length;
                const proportionalHookTime = (hookChars / totalChars) * totalDuration;
                hookDuration = Math.min(2.5, Math.max(1.5, proportionalHookTime));
            }
        }

        const segments: SubtitleSegment[] = [];
        let currentTime = 0;
        // Aggressive Lead-in for Snappy feel
        const leadIn = -0.15; // 150ms pre-display

        // 3. Handle Hook
        if (hasHook) {
            const hookContent = fullText.substring(0, hookEndIndex);
            
            segments.push({
                text: hookContent.toUpperCase(), 
                startTime: 0,
                duration: hookDuration, // No extra overlap for hook, it needs to clear for body
                styleName: 'HookStyle'
            });
            
            currentTime += hookDuration;
        }

        // 4. Handle Body (Smart Punctuation-Aware Estimation)
        const bodyText = hasHook ? fullText.substring(hookEndIndex).trim() : fullText;
        if (!bodyText) return segments;

        const words = bodyText.split(' ');
        const bodyDuration = totalDuration - currentTime;
        
        // Count punctuation to deduce "Silence Time"
        const commaCount = (bodyText.match(/,/g) || []).length;
        const periodCount = (bodyText.match(/[.!?]/g) || []).length;
        
        // Estimate silence duration: 0.3s for comma, 0.5s for period
        // But cap it so we don't eat up entire duration
        const estimatedSilence = Math.min(bodyDuration * 0.3, (commaCount * 0.3) + (periodCount * 0.5));
        
        // Active speech time is what remains
        const activeSpeechTime = bodyDuration - estimatedSilence;
        
        // Calculate characters ONLY in words (no spaces/punctuation for weight)
        const totalWordChars = words.reduce((acc, w) => acc + w.replace(/[^\w]/g, '').length, 0);
        
        words.forEach(word => {
            const cleanWord = word.replace(/[^\w]/g, '');
            const wordLen = cleanWord.length;
            
            // Check for pause after this word
            let pauseAfter = 0;
            if (word.includes(',')) pauseAfter = 0.3;
            if (word.match(/[.!?]/)) pauseAfter = 0.5;
            
            // Scale pause if we are running out of time
            if (estimatedSilence > 0) {
                 pauseAfter = pauseAfter * (estimatedSilence / ((commaCount * 0.3) + (periodCount * 0.5)));
            }

            // Word duration is proportional to its length in active time
            const wordDuration = (wordLen / totalWordChars) * activeSpeechTime;
            
            // Minimum duration safety (0.15s) - steal from pause if needed
            let finalDuration = Math.max(0.15, wordDuration);
            
            segments.push({
                text: cleanWord, // Strip punctuation from display text
                startTime: Math.max(0, currentTime + leadIn),
                duration: finalDuration + 0.1, // Small visual linger
                styleName: 'Default'
            });
            
            currentTime += finalDuration + pauseAfter;
        });

        return segments;
    }
}
