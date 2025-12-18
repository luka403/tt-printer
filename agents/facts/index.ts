import { BaseAgent, AgentTask } from '../../core/agent';
import { LLMService } from '../../core/llm';
import { db } from '../../core/db';

export class FactsAgent extends BaseAgent {
    private llm: LLMService;

    constructor() {
        super({ name: 'FactsAgent', type: 'content', niche: 'did_you_know' });
        this.llm = new LLMService();
    }

    async processTask(task: AgentTask): Promise<any> {
        this.log(`Generating "Did You Know" fact...`);

        // Get previous facts to avoid repetition
        const previousFacts = db.query(`
            SELECT script_content, theme 
            FROM story_history 
            WHERE niche = ? 
            ORDER BY created_at DESC 
            LIMIT 10
        `, ['did_you_know']) as any[];

        const previousFactsText = previousFacts.length > 0 
            ? previousFacts.map((s: any) => `- ${s.script_content}`).join('\n')
            : 'None yet.';

        const systemPrompt = `You are an expert at creating "Did You Know" facts for TikTok.
Write engaging, surprising, and educational facts that will go viral.

STRUCTURE:
- Hook: Start with "Did you know..." or similar attention-grabbing phrase
- Fact: Present the surprising fact clearly
- Context: Add brief context or why it matters (optional)
- Keep total length: 50-100 words (20-35 seconds when read aloud)

REQUIREMENTS:
- Must be TRUE and verifiable
- Should be surprising or counterintuitive
- Must be interesting and shareable
- Keep it concise and punchy
- Make people want to share it

AVOID REPETITION:
Do NOT write facts similar to these previous ones:
${previousFactsText}

Create something NEW and UNIQUE.

Output ONLY the fact text. No titles, no explanations.`;

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
        const userPrompt = `Write a "Did You Know" fact about ${randomTheme}. Make it surprising, true, and viral-worthy.`;

        const fact = await this.llm.generate(userPrompt, systemPrompt);
        const cleanedFact = fact.trim().replace(/\n+/g, ' ').replace(/\s+/g, ' ');

        // Save to DB
        const result = db.run(`INSERT INTO videos (niche, title, script_content, status, theme) VALUES (?, ?, ?, ?, ?)`, 
            ['did_you_know', `Did You Know: ${randomTheme}`, cleanedFact, 'scripted', randomTheme]);
        
        // Save to story history
        db.run(`INSERT INTO story_history (niche, theme, script_content) VALUES (?, ?, ?)`, 
            ['did_you_know', randomTheme, cleanedFact]);

        const videoId = result.lastInsertRowid;
        
        console.log("\n" + "=".repeat(70));
        console.log(`💡 DID YOU KNOW FACT (ID: ${videoId}, Theme: ${randomTheme})`);
        console.log("=".repeat(70));
        console.log(cleanedFact);
        console.log("=".repeat(70));
        console.log(`📊 Length: ${cleanedFact.length} chars, ${cleanedFact.split(' ').length} words\n`);
        
        this.log(`Fact generated (ID ${videoId}): "${cleanedFact.substring(0, 30)}..."`);

        return { videoId, fact: cleanedFact, title: randomTheme, niche: 'did_you_know' };
    }
}


