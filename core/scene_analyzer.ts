import { LLMService } from './llm';
import { SceneAnalysisPrompts, ImageStylePrompts, formatPrompt } from '../config/prompts';

export interface Scene {
    timestamp: number; // Start time in seconds
    duration: number; // Duration in seconds
    description: string; // Human-readable scene description
    imagePrompt: string; // Optimized prompt for image generation
    imagePath?: string; // Path to generated image (added after generation)
}

export class SceneAnalyzer {
    private llm: LLMService;

    constructor() {
        this.llm = new LLMService();
    }

    /**
     * Analyzes a story script and extracts 5-10 key scenes with timestamps
     * @param script The story text
     * @param audioDuration Duration of the audio in seconds
     * @param niche The niche (e.g., 'scary_stories')
     * @returns Array of scenes with timestamps and image prompts
     */
    async analyzeStory(script: string, audioDuration: number, niche: string = 'scary_stories'): Promise<Scene[]> {
        const systemPrompt = SceneAnalysisPrompts.systemPrompt;
        const userPrompt = formatPrompt(SceneAnalysisPrompts.userPromptTemplate, {
            niche,
            script
        });

        try {
            const response = await this.llm.generate(userPrompt, systemPrompt);
            
            // Parse JSON from LLM response (might have markdown code blocks)
            let jsonStr = response.trim();
            
            // Remove markdown code blocks if present
            if (jsonStr.includes('```json')) {
                jsonStr = jsonStr.split('```json')[1].split('```')[0].trim();
            } else if (jsonStr.includes('```')) {
                jsonStr = jsonStr.split('```')[1].split('```')[0].trim();
            }

            const scenes: Omit<Scene, 'timestamp' | 'duration'>[] = JSON.parse(jsonStr);

            // Calculate timestamps and durations
            const sceneDuration = audioDuration / scenes.length;
            const scenesWithTiming: Scene[] = scenes.map((scene, index) => ({
                ...scene,
                timestamp: index * sceneDuration,
                duration: sceneDuration
            }));

            // Ensure last scene extends to end of audio
            if (scenesWithTiming.length > 0) {
                const lastScene = scenesWithTiming[scenesWithTiming.length - 1];
                lastScene.duration = audioDuration - lastScene.timestamp;
            }

            // Enhance image prompts with style information
            const styleBase = this.getStyleBase(niche);
            scenesWithTiming.forEach((scene, index) => {
                const originalPrompt = scene.imagePrompt;
                scene.imagePrompt = `${styleBase}, ${scene.imagePrompt}`;
                
                // Debug logging
                console.log(`[SceneAnalyzer] Scene ${index + 1} prompt:`);
                console.log(`  Original: ${originalPrompt.substring(0, 100)}...`);
                console.log(`  Enhanced: ${scene.imagePrompt.substring(0, 150)}...`);
            });

            return scenesWithTiming;
        } catch (error: any) {
            console.error('[SceneAnalyzer] Error analyzing story:', error.message);
            
            // Fallback: create simple time-based scenes
            return this.createFallbackScenes(script, audioDuration, niche);
        }
    }

    /**
     * Creates fallback scenes if LLM analysis fails
     */
    private createFallbackScenes(script: string, audioDuration: number, niche: string): Scene[] {
        const numScenes = 7;
        const sceneDuration = audioDuration / numScenes;
        const sentences = script.split(/[.!?]+/).filter(s => s.trim().length > 0);
        const sentencesPerScene = Math.ceil(sentences.length / numScenes);

        const scenes: Scene[] = [];
        const styleBase = this.getStyleBase(niche);

        for (let i = 0; i < numScenes; i++) {
            const startIdx = i * sentencesPerScene;
            const endIdx = Math.min(startIdx + sentencesPerScene, sentences.length);
            const sceneText = sentences.slice(startIdx, endIdx).join('. ').trim();
            
            scenes.push({
                timestamp: i * sceneDuration,
                duration: sceneDuration,
                description: sceneText.substring(0, 100) + (sceneText.length > 100 ? '...' : ''),
                imagePrompt: `${styleBase}, ${sceneText.substring(0, 150)}`
            });
        }

        return scenes;
    }

    /**
     * Gets the base style prompt for a niche
     */
    private getStyleBase(niche: string): string {
        return ImageStylePrompts.nicheStyles[niche as keyof typeof ImageStylePrompts.nicheStyles] 
            || ImageStylePrompts.nicheStyles.default;
    }
}

