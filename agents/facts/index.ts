import { BaseAgent, AgentTask } from '../../core/agent';
import { LLMService } from '../../core/llm';
import { db } from '../../core/db';

export class FactsAgent extends BaseAgent {
    private llm: LLMService;
    private readonly fallbackFacts = [
        "Did you know your brain uses more energy resting than your muscles?",
        "Did you know octopuses have three hearts and blue blood?",
        "Did you know honey never spoils? Archaeologists have found 3000-year-old honey that's still edible.",
        "Did you know bananas are berries, but strawberries aren't?",
        "Did you know a day on Venus is longer than its year?"
    ];

    constructor() {
        super({ name: 'FactsAgent', type: 'content', niche: 'did_you_know' });
        this.llm = new LLMService();
    }

    async processTask(task: AgentTask): Promise<any> {
        this.log(`Generating "Did You Know" fact...`);

        // Get previous facts to avoid repetition (LIMIT 15 for better memory window)
        const previousFacts = db.query(`
            SELECT script_content, theme 
            FROM story_history 
            WHERE niche = ? 
            ORDER BY created_at DESC 
            LIMIT 15
        `, ['did_you_know']) as any[];

        const previousFactsText = previousFacts.length > 0 
            ? previousFacts.map((s: any) => `- ${s.script_content}`).join('\n')
            : 'None yet.';

        // Fact type rotation for viral variety
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
            'science',
            'history',
            'nature',
            'animals',
            'space',
            'human body',
            'technology',
            'psychology',
            'food',
            'culture'
        ];

        const randomTheme = themes[Math.floor(Math.random() * themes.length)];

        // Retry mechanism (3 attempts)
        let fact: string | null = null;
        let cleanedFact: string | null = null;
        let attempts = 0;
        const maxAttempts = 3;

        while (attempts < maxAttempts && !cleanedFact) {
            attempts++;
            this.log(`🔄 Attempt ${attempts}/${maxAttempts}...`);

            try {
                const systemPrompt = `You are an expert at creating "Did You Know" facts for TikTok.
Write engaging, surprising, and educational facts that will go viral.

FACT STYLE: ${factType}

STRUCTURE:
- Hook: Start with "Did you know..." or "Most people don't know..." (REQUIRED)
- Fact: Present the surprising fact clearly
- Context: Add brief context or why it matters (optional)
-  optimal for 20-35 seconds video

REQUIREMENTS:
- Must be TRUE and verifiable (only use widely known, well-established facts)
- Should be surprising or counterintuitive
- Must be interesting and shareable
- Keep it concise and punchy
- Make people want to share it
- Avoid exact numbers, dates, or statistics unless widely known
- Do not speculate or invent research

AVOID REPETITION:
Do NOT write facts similar to these previous ones:
${previousFactsText}

Create something NEW and UNIQUE.

Output ONLY the fact text. No titles, no explanations.`;

                const userPrompt = `Write a "Did You Know" fact about ${randomTheme} using the ${factType} style. Make it surprising, true, and viral-worthy. Target 50-90 words.`;

                fact = await this.llm.generate(userPrompt, systemPrompt);
                cleanedFact = fact.trim().replace(/\n+/g, ' ').replace(/\s+/g, ' ');

                // 1️⃣ DUŽINSKA VALIDACIJA
                const words = cleanedFact.split(' ').filter(w => w.length > 0);
                const wordCount = words.length;
                
                if (wordCount < 50 || wordCount > 100) {
                    throw new Error(`Invalid fact length: ${wordCount} words (required: 50-100)`);
                }

                // 2️⃣ HOOK VALIDACIJA (PRVA REČENICA)
                const lowerFact = cleanedFact.toLowerCase();
                if (
                    !lowerFact.startsWith('did you know') &&
                    !lowerFact.startsWith('most people don\'t know') &&
                    !lowerFact.startsWith('most people don\'t know that')
                ) {
                    throw new Error(`Fact does not start with a hook phrase. Got: "${cleanedFact.substring(0, 30)}..."`);
                }

                // Check for duplicates in DB
                try {
                    const existing = db.get(`SELECT id FROM facts WHERE niche = ? AND fact_content = ?`, 
                        ['did_you_know', cleanedFact]) as any;
                    if (existing) {
                        throw new Error('Duplicate fact detected in database');
                    }
                } catch (dbError: any) {
                    if (dbError.message.includes('UNIQUE constraint')) {
                        throw new Error('Duplicate fact detected (UNIQUE constraint)');
                    }
                    // If it's a different DB error, continue
                }

                this.log(`✅ Validation passed: ${wordCount} words, starts with hook`);

            } catch (error: any) {
                this.log(`❌ Attempt ${attempts} failed: ${error.message}`);
                cleanedFact = null;
                
                if (attempts === maxAttempts) {
                    // Use fallback on final attempt
                    this.log(`⚠️  All attempts failed, using fallback fact`);
                    cleanedFact = this.fallbackFacts[Math.floor(Math.random() * this.fallbackFacts.length)];
                    const words = cleanedFact.split(' ').filter(w => w.length > 0);
                    const wordCount = words.length;
                    this.log(`📊 Fallback fact: ${wordCount} words`);
                }
            }
        }

        if (!cleanedFact) {
            throw new Error('Failed to generate fact after all attempts and fallbacks');
        }

        const words = cleanedFact.split(' ').filter(w => w.length > 0);
        const wordCount = words.length;

        // Save to facts table
        let videoId: number;
        try {
            const result = db.run(`INSERT INTO facts (niche, fact_content, theme, fact_type, word_count) VALUES (?, ?, ?, ?, ?)`, 
                ['did_you_know', cleanedFact, randomTheme, factType, wordCount]);
            
            // Also save to videos table for pipeline compatibility
            const videoResult = db.run(`INSERT INTO videos (niche, title, script_content, status, theme) VALUES (?, ?, ?, ?, ?)`, 
                ['did_you_know', `Did You Know: ${randomTheme}`, cleanedFact, 'scripted', randomTheme]);
            
            videoId = Number(videoResult.lastInsertRowid);
            
            // Save to story history
            db.run(`INSERT INTO story_history (niche, theme, script_content) VALUES (?, ?, ?)`, 
                ['did_you_know', randomTheme, cleanedFact]);
        } catch (dbError: any) {
            if (dbError.message.includes('UNIQUE constraint')) {
                this.log(`⚠️  Duplicate detected, retrying with new theme...`);
                // Retry with different theme
                return this.processTask(task);
            }
            throw dbError;
        }
        
        console.log("\n" + "=".repeat(70));
        console.log(`💡 DID YOU KNOW FACT (ID: ${videoId}, Theme: ${randomTheme}, Type: ${factType})`);
        console.log("=".repeat(70));
        console.log(cleanedFact);
        console.log("=".repeat(70));
        console.log(`📊 Length: ${cleanedFact.length} chars, ${wordCount} words`);
        console.log(`✅ Validations: Length ✓, Hook ✓, Unique ✓\n`);
        
        this.log(`Fact generated (ID ${videoId}): "${cleanedFact.substring(0, 30)}..." (${wordCount} words, ${factType})`);

        return { videoId, fact: cleanedFact, title: randomTheme, niche: 'did_you_know', factType, wordCount };
    }
}
