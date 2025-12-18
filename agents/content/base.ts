import { BaseAgent, AgentTask } from '../../core/agent';
import { LLMService } from '../../core/llm';
import { db } from '../../core/db';

export abstract class ContentAgent extends BaseAgent {
    protected llm: LLMService;
    protected niche: string;

    constructor(niche: string) {
        super({ name: `ContentAgent-${niche}`, type: 'content', niche });
        this.niche = niche;
        this.llm = new LLMService();
    }

    // Abstract method - each niche implements its own story generation
    abstract getSystemPrompt(previousStories: any[]): string;
    abstract getThemes(): string[];
    abstract getUserPrompt(theme: string): string;

    async processTask(task: AgentTask): Promise<any> {
        this.log(`Generating content for ${this.niche}...`);

        // Get previous stories to avoid repetition
        const previousStories = db.query(`
            SELECT script_content, theme 
            FROM story_history 
            WHERE niche = ? 
            ORDER BY created_at DESC 
            LIMIT 5
        `, [this.niche]);

        // Get system and user prompts from subclass
        const systemPrompt = this.getSystemPrompt(previousStories);
        const themes = this.getThemes();
        const randomTheme = themes[Math.floor(Math.random() * themes.length)];
        const userPrompt = this.getUserPrompt(randomTheme);

        // Generate content
        const script = await this.llm.generate(userPrompt, systemPrompt);
        
        // Clean up script
        const cleanedScript = script.trim().replace(/\n+/g, ' ').replace(/\s+/g, ' ');
        
        // Save to DB
        const result = db.run(`INSERT INTO videos (niche, title, script_content, status, theme) VALUES (?, ?, ?, ?, ?)`, 
            [this.niche, `${this.niche}: ${randomTheme}`, cleanedScript, 'scripted', randomTheme]);
        
        // Save to story history
        db.run(`INSERT INTO story_history (niche, theme, script_content) VALUES (?, ?, ?)`, 
            [this.niche, randomTheme, cleanedScript]);
        
        const videoId = result.lastInsertRowid;
        
        // Display the full story
        console.log("\n" + "=".repeat(70));
        console.log(`📖 ${this.niche.toUpperCase()} STORY (ID: ${videoId}, Theme: ${randomTheme})`);
        console.log("=".repeat(70));
        console.log(cleanedScript);
        console.log("=".repeat(70));
        console.log(`📊 Length: ${cleanedScript.length} chars, ${cleanedScript.split(' ').length} words\n`);
        
        this.log(`Story generated (ID ${videoId}): "${cleanedScript.substring(0, 30)}..."`);

        return { videoId, script: cleanedScript, title: randomTheme };
    }
}

