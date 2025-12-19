import { BaseAgent, AgentTask } from '../../core/agent';
import { LLMService } from '../../core/llm';
import { db } from '../../core/db';

export class HookAgent extends BaseAgent {
    private llm: LLMService;
    private niche: string;
    private readonly fallbackHooks = [
        "Nobody is talking about this.",
        "This changes everything.",
        "You're doing this wrong.",
        "Wait until you hear this.",
        "This will shock you."
    ];

    constructor(niche: string) {
        super({ name: `HookAgent-${niche}`, type: 'content', niche });
        this.niche = niche;
        this.llm = new LLMService();
    }

    async processTask(task: AgentTask): Promise<any> {
        this.log(`Generating hook for ${this.niche}...`);

        const topic = task.payload.topic || task.payload.storyTopic;
        const storyContext = task.payload.storyContext || '';

        // Get previous hooks to avoid repetition (LIMIT 15)
        const previousHooks = db.query(`
            SELECT hook_content 
            FROM hooks 
            WHERE niche = ? 
            ORDER BY created_at DESC 
            LIMIT 15
        `, [this.niche]) as any[];

        const previousHooksText = previousHooks.length > 0 
            ? previousHooks.map((h: any) => `- ${h.hook_content}`).join('\n')
            : 'None yet.';

        // Extract banned phrases from previous hooks
        const bannedPhrases: string[] = [];
        previousHooks.forEach((h: any) => {
            const hook = h.hook_content.toLowerCase();
            // Extract common patterns
            if (hook.includes('nobody talks about')) bannedPhrases.push('Nobody talks about');
            if (hook.includes('this will change')) bannedPhrases.push('This will change everything');
            if (hook.includes('you\'re doing this wrong')) bannedPhrases.push('You\'re doing this wrong');
            if (hook.includes('wait until')) bannedPhrases.push('Wait until');
        });

        const bannedPhrasesText = bannedPhrases.length > 0
            ? `\n\nAVOID using these overused phrases:\n${bannedPhrases.map(p => `- ${p}`).join('\n')}`
            : '';

        // Hook type rotation for viral variety
        const hookTypes = [
            'curiosity gap',
            'shock statement',
            'direct accusation',
            'nobody talks about this',
            'pattern interrupt'
        ];

        const hookType = hookTypes[Math.floor(Math.random() * hookTypes.length)];
        this.log(`📌 Using hook type: ${hookType}`);

        // Retry mechanism (3 attempts)
        let hook: string | null = null;
        let cleanedHook: string | null = null;
        let attempts = 0;
        const maxAttempts = 3;

        while (attempts < maxAttempts && !cleanedHook) {
            attempts++;
            this.log(`🔄 Attempt ${attempts}/${maxAttempts}...`);

            try {
                const systemPrompt = `You are an expert at creating viral TikTok hooks.
Your task is to write a SHORT, CATCHY hook (0-3 seconds when read aloud, 5-12 words).

HOOK STYLE: ${hookType}

REQUIREMENTS:
- Must grab attention IMMEDIATELY
- Should create curiosity or shock
- Must be relevant to the topic/story
- Keep it SHORT (5-12 words)
- No filler words
- Must be punchy and memorable

AVOID REPETITION:
Do NOT write hooks similar to these:
${previousHooksText}${bannedPhrasesText}

Output ONLY the hook text. No explanations, no quotes.`;

                const userPrompt = storyContext 
                    ? `Write a viral hook for this story about "${topic}" using the ${hookType} style:\n\n${storyContext}\n\nCreate a hook that makes people want to watch the full story. Target 5-12 words.`
                    : `Write a viral hook about "${topic}" using the ${hookType} style. Make it catchy and attention-grabbing. Target 5-12 words.`;

                hook = await this.llm.generate(userPrompt, systemPrompt);
                cleanedHook = hook.trim().replace(/\n+/g, ' ').replace(/\s+/g, ' ');

                // 1️⃣ DUŽINSKI GUARD
                const words = cleanedHook.split(' ').filter(w => w.length > 0);
                const wordCount = words.length;
                
                if (wordCount < 5 || wordCount > 15) {
                    throw new Error(`Hook length invalid: ${wordCount} words (required: 5-15)`);
                }

                // Check for duplicates in DB
                try {
                    const existing = db.get(`SELECT id FROM hooks WHERE niche = ? AND hook_content = ?`, 
                        [this.niche, cleanedHook]) as any;
                    if (existing) {
                        throw new Error('Duplicate hook detected in database');
                    }
                } catch (dbError: any) {
                    if (dbError.message.includes('UNIQUE constraint')) {
                        throw new Error('Duplicate hook detected (UNIQUE constraint)');
                    }
                    // If it's a different DB error, continue
                }

                this.log(`✅ Validation passed: ${wordCount} words`);

            } catch (error: any) {
                this.log(`❌ Attempt ${attempts} failed: ${error.message}`);
                cleanedHook = null;
                
                if (attempts === maxAttempts) {
                    // Use fallback on final attempt
                    this.log(`⚠️  All attempts failed, using fallback hook`);
                    cleanedHook = this.fallbackHooks[Math.floor(Math.random() * this.fallbackHooks.length)];
                    const words = cleanedHook.split(' ').filter(w => w.length > 0);
                    const wordCount = words.length;
                    this.log(`📊 Fallback hook: ${wordCount} words`);
                }
            }
        }

        if (!cleanedHook) {
            throw new Error('Failed to generate hook after all attempts and fallbacks');
        }

        const words = cleanedHook.split(' ').filter(w => w.length > 0);
        const wordCount = words.length;

        // Save to DB
        let hookId: number;
        try {
            const result = db.run(`INSERT INTO hooks (niche, hook_content, topic, video_id, hook_type, word_count) VALUES (?, ?, ?, ?, ?, ?)`, 
                [this.niche, cleanedHook, topic, task.payload.videoId || null, hookType, wordCount]);
            
            hookId = Number(result.lastInsertRowid);
        } catch (dbError: any) {
            if (dbError.message.includes('UNIQUE constraint')) {
                this.log(`⚠️  Duplicate detected, retrying...`);
                // Retry with different approach
                return this.processTask({ ...task, payload: { ...task.payload, retry: true } });
            }
            throw dbError;
        }

        this.log(`✅ Hook generated (ID ${hookId}): "${cleanedHook}" (${wordCount} words, ${hookType})`);

        return { hookId, hook: cleanedHook, hookType, wordCount };
    }
}
