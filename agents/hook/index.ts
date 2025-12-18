import { BaseAgent, AgentTask } from '../../core/agent';
import { LLMService } from '../../core/llm';
import { db } from '../../core/db';

export class HookAgent extends BaseAgent {
    private llm: LLMService;
    private niche: string;

    constructor(niche: string) {
        super({ name: `HookAgent-${niche}`, type: 'content', niche });
        this.niche = niche;
        this.llm = new LLMService();
    }

    async processTask(task: AgentTask): Promise<any> {
        this.log(`Generating hook for ${this.niche}...`);

        const topic = task.payload.topic || task.payload.storyTopic;
        const storyContext = task.payload.storyContext || '';

        // Get previous hooks to avoid repetition
        const previousHooks = db.query(`
            SELECT hook_content 
            FROM hooks 
            WHERE niche = ? 
            ORDER BY created_at DESC 
            LIMIT 5
        `, [this.niche]) as any[];

        const previousHooksText = previousHooks.length > 0 
            ? previousHooks.map((h: any) => `- ${h.hook_content}`).join('\n')
            : 'None yet.';

        const systemPrompt = `You are an expert at creating viral TikTok hooks.
Your task is to write a SHORT, CATCHY hook (0-3 seconds when read aloud, 5-15 words max).

REQUIREMENTS:
- Must grab attention IMMEDIATELY
- Should create curiosity or shock
- Must be relevant to the topic/story
- Keep it SHORT (5-15 words)
- No filler words

AVOID REPETITION:
Do NOT write hooks similar to these:
${previousHooksText}

Output ONLY the hook text. No explanations, no quotes.`;

        const userPrompt = storyContext 
            ? `Write a viral hook for this story about "${topic}":\n\n${storyContext}\n\nCreate a hook that makes people want to watch the full story.`
            : `Write a viral hook about "${topic}". Make it catchy and attention-grabbing.`;

        const hook = await this.llm.generate(userPrompt, systemPrompt);
        const cleanedHook = hook.trim().replace(/\n+/g, ' ').replace(/\s+/g, ' ');

        // Save to DB
        const result = db.run(`INSERT INTO hooks (niche, hook_content, topic, video_id) VALUES (?, ?, ?, ?)`, 
            [this.niche, cleanedHook, topic, task.payload.videoId || null]);

        const hookId = result.lastInsertRowid;
        this.log(`Hook generated (ID ${hookId}): "${cleanedHook}"`);

        return { hookId, hook: cleanedHook };
    }
}


