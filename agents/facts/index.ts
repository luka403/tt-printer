import { BaseAgent, AgentTask } from '../../core/agent';
import { LLMService } from '../../core/llm';
import { db } from '../../core/db';

export class FactsAgent extends BaseAgent {
    private llm: LLMService;
    
    // Predefined hooks for consistent viral performance
    private readonly FACT_HOOK_POOL = [
        "Nobody tells you this.",
        "Most people don’t know this.",
        "This sounds fake, but it’s real.",
        "Your body does this automatically.",
        "This happens without you noticing.",
        "Almost nobody learns this in school.",
        "Your brain does this every day.",
        "This is happening inside you right now.",
        "You’ve experienced this without realizing it.",
        "This is way more important than you think."
    ];

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

    async processTask(task: AgentTask): Promise<any> {
        this.log(`Generating "Did You Know" fact...`);

        const factTypes = [
            'counterintuitive',
            'myth busting',
            'hidden biology',
            'everyday explained',
            'psychology trick',
            'ancient history'
        ];

        const factType = factTypes[Math.floor(Math.random() * factTypes.length)];
        this.log(`📌 Using fact type: ${factType}`);

        const themes = [
            'science', 'history', 'nature', 'animals', 'space',
            'human body', 'technology', 'psychology', 'food', 'culture'
        ];

        const randomTheme = themes[Math.floor(Math.random() * themes.length)];

        // Retry mechanism
        let factBody: string | null = null;
        let attempts = 0;
        const maxAttempts = 3;

        // Select hook programmatically
        const selectedHook = this.FACT_HOOK_POOL[Math.floor(Math.random() * this.FACT_HOOK_POOL.length)];

        while (attempts < maxAttempts && !factBody) {
            attempts++;
            this.log(`🔄 Attempt ${attempts}/${maxAttempts}...`);

            try {
                // EXTREMELY SIMPLE PROMPT to avoid LLM crash
                const systemPrompt = `You generate ONLY the factual body of a TikTok "Did You Know" video.

Rules:
- Start directly with the fact content (e.g. "honey never spoils...")
- Do NOT include the "Did you know" phrase at the start
- Do NOT write a hook
- Do NOT add titles or formatting
- Write 2–3 sentences
- Target 50–90 words
- Natural spoken English
- Widely accepted true facts only
- No speculation`;

                const userPrompt = `Topic: ${randomTheme}\nStyle: ${factType}\n\nWrite a surprising but true fact.`;

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

        // Combine Hook + Fact
        const fullScript = `${selectedHook} Did you know ${factBody}`;
        const wordCount = fullScript.split(' ').length;

        // Save to DB
        let videoId: number;
        try {
            const result = db.run(`INSERT INTO facts (niche, fact_content, theme, fact_type, word_count) VALUES (?, ?, ?, ?, ?)`, 
                ['did_you_know', factBody, randomTheme, factType, wordCount]);
            
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
        console.log(`📝 Body: Did you know ${factBody}`);
        console.log("=".repeat(70));
        
        return { 
            videoId, 
            fact: factBody, 
            hook: selectedHook, 
            fullScript,
            title: randomTheme, 
            niche: 'did_you_know', 
            factType, 
            wordCount 
        };
    }
}
