/**
 * Centralized prompt configuration
 * Edit this file to customize all prompts used in the system
 */

export const SceneAnalysisPrompts = {
    /**
     * System prompt for LLM to analyze stories and extract scenes
     */
    systemPrompt: `You are an expert at analyzing stories and breaking them down into visual scenes.
Your task is to analyze a story and identify 5-10 key visual moments that would make good images.
Each scene should represent a distinct moment or setting in the story.

For each scene, provide:
1. A brief description of what's happening
2. A detailed image generation prompt that captures the visual essence

Output your response as a JSON array with this exact format:
[
  {
    "description": "Brief scene description",
    "imagePrompt": "Detailed prompt for image generation, including style and mood"
  },
  ...
]

Make sure to:
- Identify 5-10 scenes (aim for 7-8 for best balance)
- Cover the entire story from beginning to end
- Each scene should be visually distinct
- Image prompts should be detailed and include style information
- For scary stories, include mood words like "dark", "eerie", "mysterious"`,

    /**
     * User prompt template for scene analysis
     * {niche} and {script} will be replaced
     */
    userPromptTemplate: `Analyze this {niche} story and extract 5-10 key visual scenes:

"{script}"

Provide a JSON array with scenes. Each scene needs a description and a detailed imagePrompt.`
};

export const ImageStylePrompts = {
    /**
     * Style base prompts for different niches
     * Used to enhance image generation prompts
     */
    nicheStyles: {
        scary_stories: 'cartoon style, clean lines, vibrant colors, dark mood, eerie atmosphere, detailed, high quality, complete image, finished artwork',
        motivation: 'cartoon style, clean lines, vibrant colors, uplifting mood, detailed, high quality, complete image, finished artwork',
        default: 'cartoon style, clean lines, vibrant colors, detailed, high quality, complete image, finished artwork'
    },

    /**
     * Style enhancements for image generation API
     * Used in Python image_api.py
     */
    styleEnhancements: {
        simple_cartoon: 'simple cartoon style, clean lines, vibrant colors, 2D animation style',
        anime: 'anime style, detailed, vibrant colors, high quality',
        western_cartoon: 'western cartoon style, Disney Pixar style, 3D rendered',
        comic_book: 'comic book style, bold lines, dynamic composition',
        default: 'simple cartoon style, clean lines, vibrant colors'
    },

    /**
     * Default negative prompt for image generation
     * Things to avoid in generated images
     */
    defaultNegativePrompt: 'blurry, low quality, distorted, ugly, bad anatomy, watermark, incomplete, unfinished, pixelated, low resolution, corrupted, glitch, artifacts, noise, grainy, out of focus'
};

export const ScaryStoryPrompts = {
    /**
     * System prompt for generating scary stories
     */
    systemPrompt: `You are an expert horror story writer for TikTok. 
Write a COMPLETE, ENGAGING horror story that will be read aloud (30-45 seconds when spoken).

STRUCTURE:
- Opening (2-3 sentences): Set up a normal, relatable situation with subtle creepy details
- Build-up (2-3 sentences): Escalate tension, add mysterious elements
- Twist (1-2 sentences): Reveal shocking truth that changes everything
- Ending (1 sentence): Leave with chilling realization

REQUIREMENTS:
- Total length: 80-120 words (enough for 30-45 seconds of speech)
- Must be LOGICAL and make complete sense
- Must have a CLEAR, SHOCKING twist
- Must be BELIEVABLE and realistic
- Tone: Creepy, suspenseful, psychological horror
- Write in first person ("I", "my", "me")
- Each sentence should flow naturally into the next

AVOID REPETITION:
Do NOT write stories similar to these previous ones:
{previousStories}

Create something NEW and UNIQUE.

Output ONLY the story text. No titles, no explanations, no quotes. Just the story.`,

    /**
     * User prompt template for scary story generation
     * {theme} will be replaced
     */
    userPromptTemplate: `Write a complete horror story about "{theme}". 
Make it 80-120 words long (30-45 seconds when read aloud). 
Include: setup, tension build-up, shocking twist, and chilling ending. 
Make it scary, logical, and completely original.`,

    /**
     * Retry prompt template (when duplicate detected)
     * {theme} will be replaced
     */
    retryPromptTemplate: `Write a complete horror story about "{theme}". Make it 80-120 words, scary, logical, and COMPLETELY DIFFERENT from previous stories.`,

    /**
     * Available themes for scary stories
     */
    themes: [
        'someone watching you',
        'a strange neighbor',
        'something in the mirror',
        'voices in the dark',
        'a door that should be locked',
        'your own reflection',
        'someone following you',
        'a message you did not send',
        'a sound that should not exist',
        'something under the bed',
        'a phone call from yourself'
    ]
};

export const ContentPrompts = {
    /**
     * Generic system prompt for content generation
     * {niche} will be replaced
     */
    genericSystemPrompt: `You are a content writer for TikTok in the {niche} niche.
Write engaging, viral-worthy content (80-120 words, 30-45 seconds when read aloud).

AVOID REPETITION:
Do NOT write content similar to these previous ones:
{previousStories}

Create something NEW and UNIQUE.

Output ONLY the content text. No titles, no explanations.`,

    /**
     * Generic user prompt template
     * {niche} and {theme} will be replaced
     */
    genericUserPromptTemplate: `Write engaging {niche} content about "{theme}". 
Make it 80-120 words long, inspiring and viral-worthy.`
};

/**
 * Helper function to format prompt templates
 */
export function formatPrompt(template: string, replacements: Record<string, string>): string {
    let result = template;
    for (const [key, value] of Object.entries(replacements)) {
        result = result.replace(new RegExp(`{${key}}`, 'g'), value);
    }
    return result;
}

