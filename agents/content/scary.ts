import { ContentAgent } from './base';
import { AgentTask } from '../../core/agent';
import { db } from '../../core/db';
import { ScaryStoryPrompts, formatPrompt } from '../../config/prompts';

export class ScaryContentAgent extends ContentAgent {
    constructor() {
        super('scary_stories');
    }

    getSystemPrompt(previousStories: any[]): string {
        const previousStoriesText = previousStories.length > 0 
            ? previousStories.map((s: any) => `- ${s.script_content}`).join('\n')
            : 'None yet.';

        return formatPrompt(ScaryStoryPrompts.systemPrompt, {
            previousStories: previousStoriesText
        });
    }

    getThemes(): string[] {
        return ScaryStoryPrompts.themes;
    }

    getUserPrompt(theme: string): string {
        return formatPrompt(ScaryStoryPrompts.userPromptTemplate, {
            theme
        });
    }

    async processTask(task: AgentTask): Promise<any> {
        this.log(`Generating Scary Story...`);

        // Get previous stories to avoid repetition
        const previousStories = db.query(`
            SELECT script_content, theme 
            FROM story_history 
            WHERE niche = ? 
            ORDER BY created_at DESC 
            LIMIT 5
        `, ['scary_stories']);

        const previousStoriesText = previousStories.length > 0 
            ? previousStories.map((s: any) => `- ${s.script_content}`).join('\n')
            : 'None yet.';

        const systemPrompt = formatPrompt(ScaryStoryPrompts.systemPrompt, {
            previousStories: previousStoriesText
        });

        // We rotate themes or use provided theme
        const themes = ScaryStoryPrompts.themes;
        const randomTheme = themes[Math.floor(Math.random() * themes.length)];

        const userPrompt = formatPrompt(ScaryStoryPrompts.userPromptTemplate, {
            theme: randomTheme
        });

        const script = await this.llm.generate(userPrompt, systemPrompt);
        
        // Clean up script (remove any extra whitespace/newlines from LLM)
        const cleanedScript = script.trim().replace(/\n+/g, ' ').replace(/\s+/g, ' ');
        
        // Create hash to check for duplicates
        const crypto = require('crypto');
        const storyHash = crypto.createHash('md5').update(cleanedScript.toLowerCase().trim()).digest('hex');
        
        // Check if this exact story was already generated (check by hash or content)
        const existing = db.get(`SELECT id FROM story_history WHERE story_hash = ? OR script_content = ?`, [storyHash, cleanedScript]) as any;
        if (existing) {
            this.log(`⚠️  Exact duplicate story detected, generating new one...`);
            // Retry with different theme
            const newTheme = themes[Math.floor(Math.random() * themes.length)];
            const retryPrompt = formatPrompt(ScaryStoryPrompts.retryPromptTemplate, {
                theme: newTheme
            });
            const newScript = await this.llm.generate(retryPrompt, systemPrompt);
            const newCleanedScript = newScript.trim().replace(/\n+/g, ' ').replace(/\s+/g, ' ');
            // Recursive retry (with limit)
            if (!task.payload?.retryCount || task.payload.retryCount < 3) {
                return this.processTask({ 
                    ...task, 
                    payload: { ...task.payload, retryCount: (task.payload?.retryCount || 0) + 1 } 
                });
            }
        }
        
        // Save to DB
        const result = db.run(`INSERT INTO videos (niche, title, script_content, status, theme) VALUES (?, ?, ?, ?, ?)`, 
            ['scary_stories', `Scary Story: ${randomTheme}`, cleanedScript, 'scripted', randomTheme]);
        
        // Save to story history to avoid repetition
        db.run(`INSERT INTO story_history (niche, theme, script_content, story_hash) VALUES (?, ?, ?, ?)`, 
            ['scary_stories', randomTheme, cleanedScript, storyHash]);
        
        const videoId = result.lastInsertRowid;
        
        // Display the full story that will be used
        console.log("\n" + "=".repeat(70));
        console.log(`📖 FINAL STORY FOR VIDEO (ID: ${videoId}, Theme: ${randomTheme})`);
        console.log("=".repeat(70));
        console.log(cleanedScript);
        console.log("=".repeat(70));
        console.log(`📊 Final length: ${cleanedScript.length} characters`);
        console.log(`📊 Word count: ${cleanedScript.split(' ').length} words\n`);
        
        this.log(`Scary Story generated (ID ${videoId}): "${cleanedScript.substring(0, 30)}..."`);

        return { videoId, script: cleanedScript, title: randomTheme };
    }
}

