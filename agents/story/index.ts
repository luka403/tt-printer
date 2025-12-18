import { BaseAgent, AgentTask } from '../../core/agent';
import { LLMService } from '../../core/llm';
import { db } from '../../core/db';

export class StoryAgent extends BaseAgent {
    private llm: LLMService;
    private niche: string;

    constructor(niche: string) {
        super({ name: `StoryAgent-${niche}`, type: 'content', niche });
        this.niche = niche;
        this.llm = new LLMService();
    }

    async processTask(task: AgentTask): Promise<any> {
        this.log(`Generating story for ${this.niche}...`);

        const topic = task.payload.topic;
        const hook = task.payload.hook || '';

        // Get previous stories to avoid repetition
        const previousStories = db.query(`
            SELECT script_content, theme 
            FROM story_history 
            WHERE niche = ? 
            ORDER BY created_at DESC 
            LIMIT 5
        `, [this.niche]) as any[];

        const previousStoriesText = previousStories.length > 0 
            ? previousStories.map((s: any) => `- ${s.script_content}`).join('\n')
            : 'None yet.';

        const systemPrompt = `You are a content writer for TikTok in the ${this.niche} niche.
Write engaging, viral-worthy content (80-120 words, 30-45 seconds when read aloud).

STRUCTURE:
- Body: Valuable information, story, or facts
- Call to Action: Subtle engagement prompt (optional)

REQUIREMENTS:
- Must be valuable and engaging
- Keep it concise (80-120 words)
- Make it shareable and viral-worthy
- Flow naturally from the hook if provided

AVOID REPETITION:
Do NOT write content similar to these previous ones:
${previousStoriesText}

Create something NEW and UNIQUE.

Output ONLY the story/body text. No titles, no explanations.`;

        const userPrompt = hook 
            ? `Write the body of a TikTok video about "${topic}". The hook is: "${hook}". Continue from the hook with valuable content.`
            : `Write engaging ${this.niche} content about "${topic}". Make it 80-120 words long, inspiring and viral-worthy.`;

        const story = await this.llm.generate(userPrompt, systemPrompt);
        const cleanedStory = story.trim().replace(/\n+/g, ' ').replace(/\s+/g, ' ');

        // Save to DB
        const result = db.run(`INSERT INTO videos (niche, title, script_content, status, theme) VALUES (?, ?, ?, ?, ?)`, 
            [this.niche, `${this.niche}: ${topic}`, cleanedStory, 'scripted', topic]);
        
        // Save to story history
        db.run(`INSERT INTO story_history (niche, theme, script_content) VALUES (?, ?, ?)`, 
            [this.niche, topic, cleanedStory]);

        const videoId = result.lastInsertRowid;
        
        this.log(`Story generated (ID ${videoId}): "${cleanedStory.substring(0, 30)}..."`);

        return { videoId, story: cleanedStory, title: topic };
    }
}


