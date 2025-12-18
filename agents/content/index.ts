import { ContentAgent as BaseContentAgent } from './base';
import { AgentTask } from '../../core/agent';
import { db } from '../../core/db';

export class ContentAgent extends BaseContentAgent {
    constructor(niche: string) {
        super(niche);
    }

    getSystemPrompt(previousStories: any[]): string {
        // Generic system prompt - can be overridden by specific niches
        const previousStoriesText = previousStories.length > 0 
            ? previousStories.map((s: any) => `- ${s.script_content}`).join('\n')
            : 'None yet.';

        return `You are a content writer for TikTok in the ${this.niche} niche.
        Write engaging, viral-worthy content (80-120 words, 30-45 seconds when read aloud).
        
        AVOID REPETITION:
        Do NOT write content similar to these previous ones:
        ${previousStoriesText}
        
        Create something NEW and UNIQUE.
        
        Output ONLY the content text. No titles, no explanations.`;
    }

    getThemes(): string[] {
        // Default themes - can be overridden
        return ['motivation', 'success', 'inspiration', 'growth', 'achievement'];
    }

    getUserPrompt(theme: string): string {
        return `Write engaging ${this.niche} content about "${theme}". 
        Make it 80-120 words long, inspiring and viral-worthy.`;
    }

    async processTask(task: AgentTask): Promise<any> {
        // Task payload should contain the 'trend' or 'topic'
        const topic = task.payload.topic;
        this.log(`Generating script for topic: ${topic}`);

        const systemPrompt = `You are a viral TikTok script writer for the ${this.config.niche} niche. 
        Keep it short (under 60 seconds). 
        Format:
        - Hook (0-3s)
        - Body (valuable info/story)
        - Call to Action`;

        const script = await this.llm.generate(`Write a script about: "${topic}"`, systemPrompt);
        
        // Save to DB
        const result = db.run(`INSERT INTO videos (niche, title, script_content, status) VALUES (?, ?, ?, ?)`, 
            [this.config.niche, topic, script, 'scripted']);
        
        const videoId = result.lastInsertRowid;
        this.log(`Script generated for Video ID ${videoId}`);

        return { videoId, script, title: topic };
    }
}

