import { BaseAgent, AgentTask } from '../../core/agent';
import { LLMService } from '../../core/llm';
import { db } from '../../core/db';

export class FactsAgent extends BaseAgent {
    private llm: LLMService;
    
    // Expanded Themes Pool
    private readonly THEMES = [
        "food", "human body", "psychology", "brain", "habits", 
        "science", "space", "animals", "nature", "history", 
        "technology", "everyday objects", "sleep", "emotions", 
        "memory", "health", "time", "money behavior", 
        "social behavior", "weird facts"
    ];

    // Organized Hook Pools by Category
    private readonly HOOK_POOLS: { [key: string]: string[] } = {
        food: [
            "This food never goes bad.",
            "This should expire, but it doesn’t.",
            "People throw this away for no reason.",
            "This food breaks the rules of time.",
            "You’ve eaten this without realizing this."
        ],
        human_body: [
            "Your body does this automatically.",
            "This happens inside you right now.",
            "Your body knows this before you do.",
            "Your brain does this every single day.",
            "You don’t control this, your body does."
        ],
        brain: [
            "Your body does this automatically.",
            "This happens inside you right now.",
            "Your body knows this before you do.",
            "Your brain does this every single day.",
            "You don’t control this, your body does."
        ],
        psychology: [
            "Your brain tricks you like this.",
            "Your mind lies to you here.",
            "This is why you feel this way.",
            "Your brain does this to protect you.",
            "You’ve experienced this without realizing it."
        ],
        emotions: [
            "Your brain tricks you like this.",
            "Your mind lies to you here.",
            "This is why you feel this way.",
            "Your brain does this to protect you.",
            "You’ve experienced this without realizing it."
        ],
        animals: [
            "Animals do this naturally.",
            "Nature has already figured this out.",
            "This happens in the wild all the time.",
            "Animals use this to survive.",
            "Nature doesn’t waste energy like we do."
        ],
        nature: [
            "Animals do this naturally.",
            "Nature has already figured this out.",
            "This happens in the wild all the time.",
            "Animals use this to survive.",
            "Nature doesn’t waste energy like we do."
        ],
        science: [
            "This sounds fake, but it’s real.",
            "Science can’t fully explain this.",
            "This breaks what we thought we knew.",
            "Scientists were shocked by this.",
            "This shouldn’t work, but it does."
        ],
        space: [
            "This sounds fake, but it’s real.",
            "Science can’t fully explain this.",
            "This breaks what we thought we knew.",
            "Scientists were shocked by this.",
            "This shouldn’t work, but it does."
        ],
        default: [
            "You do this every day without thinking.",
            "This habit changes your brain.",
            "Your routine causes this.",
            "Your body adapts to this over time.",
            "This happens when you sleep.",
            "Nobody tells you this.",
            "Most people don’t know this."
        ]
    };

    private readonly fallbackFacts = [
        "your brain uses more energy resting than your muscles.",
        "octopuses have three hearts and blue blood.",
        "honey never spoils. Archaeologists have found 3000-year-old honey that's still edible.",
        "bananas are berries, but strawberries aren't.",
        "a day on Venus is longer than its year."
    ];

    constructor() {
        super({ name: 'FactsAgent', type: 'content', niche: 'did_you_know' });
        this.llm = new LLMService();
    }

    private getHookForTheme(theme: string): string {
        // Normalize theme key
        let key = 'default';
        if (['food'].includes(theme)) key = 'food';
        else if (['human body', 'brain', 'health'].includes(theme)) key = 'human_body';
        else if (['psychology', 'emotions', 'memory', 'social behavior', 'money behavior'].includes(theme)) key = 'psychology';
        else if (['animals', 'nature'].includes(theme)) key = 'animals';
        else if (['science', 'space', 'technology'].includes(theme)) key = 'science';
        else if (['sleep', 'habits', 'everyday objects', 'time', 'weird facts', 'history'].includes(theme)) key = 'default';

        const pool = this.HOOK_POOLS[key] || this.HOOK_POOLS['default'];
        return pool[Math.floor(Math.random() * pool.length)];
    }

    async processTask(task: AgentTask): Promise<any> {
        this.log(`Generating "Did You Know" fact...`);

        const styles = [
            "counterintuitive",
            "hidden biology",
            "everyday explained",
            "weird but true",
            "psychology trick",
            "little-known fact"
        ];

        const randomStyle = styles[Math.floor(Math.random() * styles.length)];
        const randomTheme = this.THEMES[Math.floor(Math.random() * this.THEMES.length)];
        
        this.log(`📌 Theme: ${randomTheme} | Style: ${randomStyle}`);

        // Retry mechanism
        let factBody: string | null = null;
        let attempts = 0;
        const maxAttempts = 3;

        // Select hook programmatically based on theme
        const selectedHook = this.getHookForTheme(randomTheme);

        while (attempts < maxAttempts && !factBody) {
            attempts++;
            this.log(`🔄 Attempt ${attempts}/${maxAttempts}...`);

            try {
                // SYSTEM PROMPT (FINAL)
                const systemPrompt = `You generate the BODY of a TikTok "Did You Know" video.

IMPORTANT:
- You do NOT write the hook.
- You do NOT start with "Did you know".
- You write ONLY the fact body.

STYLE RULES:
- Write for SPOKEN TikTok narration
- Short sentences (8–14 words)
- One idea per sentence
- Natural, conversational English
- Storytelling tone (like explaining to a friend)

STRUCTURE:
1. Clear claim
2. Why it’s surprising
3. Explanation
4. One WOW detail (optional)

CONTENT RULES:
- 2–4 sentences total
- 50–90 words total
- Widely accepted true facts only
- No speculation
- No academic tone
- No lists, no formatting

OUTPUT:
Return ONLY plain text.`;

                const userPrompt = `Theme: ${randomTheme}\nStyle: ${randomStyle}\n\nWrite a surprising but true fact body.`;

                factBody = await this.llm.generate(userPrompt, systemPrompt, { task: 'fact' });
                
                // Cleanup: Remove quotes, newlines, extra spaces
                factBody = factBody.trim().replace(/\n+/g, ' ').replace(/\s+/g, ' ').replace(/^"|"$/g, '');
                
                // Cleanup: Remove "Did you know" if LLM added it despite instructions
                if (factBody.toLowerCase().startsWith('did you know')) {
                    factBody = factBody.substring(12).trim();
                    if (factBody.startsWith('that')) factBody = factBody.substring(4).trim();
                }

                // Validate length
                const words = factBody.split(' ').filter(w => w.length > 0);
                if (words.length < 30 || words.length > 120) {
                    throw new Error(`Invalid fact length: ${words.length} words (target 50-90)`);
                }

                // Check duplicates (simple check)
                try {
                    const existing = db.get(`SELECT id FROM facts WHERE niche = ? AND fact_content = ?`, 
                        ['did_you_know', factBody]) as any;
                    if (existing) throw new Error('Duplicate fact detected');
                } catch (dbError: any) {
                    if (dbError.message.includes('UNIQUE constraint')) throw new Error('Duplicate fact detected');
                }

                this.log(`✅ Validation passed`);

            } catch (error: any) {
                this.log(`❌ Attempt ${attempts} failed: ${error.message}`);
                factBody = null;
                
                if (attempts === maxAttempts) {
                    this.log(`⚠️  All attempts failed, using fallback`);
                    factBody = this.fallbackFacts[Math.floor(Math.random() * this.fallbackFacts.length)];
                }
            }
        }

        if (!factBody) {
            factBody = "honey never spoils. Archaeologists have found 3000-year-old honey that's still edible.";
        }

        // Combine Hook + Pause + Fact (Pause is handled in VideoComposer usually, here just space)
        // Note: The user requested: FINAL_SCRIPT = HOOK <short pause> BODY
        // We will combine them with a space here, but pass them separately for styling.
        // For TTS, we might want to add a pause marker if TTS supports it, or just rely on punctuation.
        // Adding a period after hook ensures a pause.
        const fullScript = `${selectedHook} ${factBody}`;
        const wordCount = fullScript.split(' ').length;

        // Save to DB
        let videoId: number;
        try {
            const result = db.run(`INSERT INTO facts (niche, fact_content, theme, fact_type, word_count) VALUES (?, ?, ?, ?, ?)`, 
                ['did_you_know', factBody, randomTheme, randomStyle, wordCount]);
            
            const videoResult = db.run(`INSERT INTO videos (niche, title, script_content, status, theme) VALUES (?, ?, ?, ?, ?)`, 
                ['did_you_know', `Did You Know: ${randomTheme}`, fullScript, 'scripted', randomTheme]);
            
            videoId = Number(videoResult.lastInsertRowid);
            
            db.run(`INSERT INTO story_history (niche, theme, script_content) VALUES (?, ?, ?)`, 
                ['did_you_know', randomTheme, factBody]);
        } catch (dbError) {
            this.log('⚠️ DB Error (likely duplicate), restarting task...');
            return this.processTask(task);
        }
        
        console.log("\n" + "=".repeat(70));
        console.log(`💡 DID YOU KNOW FACT (ID: ${videoId}, Theme: ${randomTheme})`);
        console.log(`🪝 Hook: ${selectedHook}`);
        console.log(`📝 Body: ${factBody}`);
        console.log("=".repeat(70));
        
        return { 
            videoId, 
            fact: factBody, 
            hook: selectedHook, 
            fullScript,
            title: randomTheme, 
            niche: 'did_you_know', 
            factType: randomStyle, 
            wordCount 
        };
    }
}
