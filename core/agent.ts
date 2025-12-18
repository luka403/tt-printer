export interface AgentConfig {
    name: string;
    type: 'central' | 'research' | 'content' | 'hook' | 'story' | 'video' | 'publish';
    niche?: string;
}

export interface AgentTask {
    id: string;
    type: string;
    payload: any;
    status: 'pending' | 'processing' | 'completed' | 'failed';
    result?: any;
}

export abstract class BaseAgent {
    protected config: AgentConfig;

    constructor(config: AgentConfig) {
        this.config = config;
        console.log(`[Agent ${this.config.name}] Initialized`);
    }

    abstract processTask(task: AgentTask): Promise<any>;

    protected log(message: string) {
        console.log(`[${this.config.name}] ${message}`);
    }
}










