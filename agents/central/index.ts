import { BaseAgent, AgentTask } from '../../core/agent';
import { ResearchAgent } from '../research';
import { ContentAgent } from '../content';
import { ScaryContentAgent } from '../content/scary';
import { HookAgent } from '../hook';
import { StoryAgent } from '../story';
import { FactsAgent } from '../facts';
import { VideoAgent } from '../video';
import { PublishingAgent } from '../publish';

export class CentralAgent extends BaseAgent {
    private research: ResearchAgent;
    private video: VideoAgent;
    private publish: PublishingAgent;
    private contentAgents: Map<string, BaseAgent>;
    private hookAgents: Map<string, HookAgent>;
    private storyAgents: Map<string, StoryAgent>;
    private factsAgent: FactsAgent;

    constructor() {
        super({ name: 'CentralAgent', type: 'central' });
        this.research = new ResearchAgent();
        this.video = new VideoAgent();
        this.publish = new PublishingAgent();
        this.contentAgents = new Map();
        this.hookAgents = new Map();
        this.storyAgents = new Map();
        
        // Register Content Agents (legacy)
        this.contentAgents.set('motivation', new ContentAgent('motivation'));
        this.contentAgents.set('scary_stories', new ScaryContentAgent());
        
        // Register Hook Agents
        this.hookAgents.set('scary_stories', new HookAgent('scary_stories'));
        this.hookAgents.set('did_you_know', new HookAgent('did_you_know'));
        this.hookAgents.set('motivation', new HookAgent('motivation'));
        
        // Register Story Agents
        this.storyAgents.set('scary_stories', new StoryAgent('scary_stories'));
        this.storyAgents.set('did_you_know', new StoryAgent('did_you_know'));
        this.storyAgents.set('motivation', new StoryAgent('motivation'));
        
        // Register Facts Agent
        this.factsAgent = new FactsAgent();
    }

    async runDailyCycle(niche: string) {
        this.log(`Starting daily cycle for: ${niche}`);

        let scriptResult;
        let fullScript: string;

        // Special handling for "did_you_know" niche
        if (niche === 'did_you_know') {
            console.log("\n💡 Generating Did You Know fact...\n");
            const factsResult = await this.factsAgent.processTask({
                id: 'task-facts', type: 'content', payload: {}, status: 'pending'
            });
            
            // Generate hook for the fact
            const hookAgent = this.hookAgents.get('did_you_know');
            if (hookAgent) {
                const hookResult = await hookAgent.processTask({
                    id: 'task-hook', type: 'hook', 
                    payload: { 
                        topic: factsResult.title, 
                        storyContext: factsResult.fact,
                        videoId: factsResult.videoId
                    }, 
                    status: 'pending'
                });
                fullScript = `${hookResult.hook} ${factsResult.fact}`;
                scriptResult = { ...factsResult, script: fullScript, hook: hookResult.hook };
            } else {
                fullScript = factsResult.fact;
                scriptResult = { ...factsResult, script: fullScript };
            }
            console.log(`✅ Fact ready for video production\n`);
        } else {
            // For other niches, use Hook + Story agents
            const hookAgent = this.hookAgents.get(niche);
            const storyAgent = this.storyAgents.get(niche);
            
            if (!hookAgent || !storyAgent) {
                // Fallback to legacy content agents
                const contentAgent = this.contentAgents.get(niche);
                if (!contentAgent) {
                    this.log(`No content agent for niche ${niche}`);
                    return;
                }
                
                if (niche === 'scary_stories') {
                    console.log("\n🎭 Generating scary story...\n");
                    scriptResult = await contentAgent.processTask({
                        id: 'task-gen-scary', type: 'content', payload: { topic: 'random' }, status: 'pending'
                    });
                    console.log(`✅ Story ready for video production\n`);
                } else {
                    const trends = await this.research.processTask({ 
                        id: 'task-res', type: 'research', payload: { niche }, status: 'pending' 
                    });
                    scriptResult = await contentAgent.processTask({
                        id: 'task-content', type: 'content', payload: { topic: trends[0] }, status: 'pending'
                    });
                }
            } else {
                // New flow: Hook + Story
                let topic = 'random';
                
                // Get topic from research if needed
                if (niche !== 'scary_stories') {
                    const trends = await this.research.processTask({ 
                        id: 'task-res', type: 'research', payload: { niche }, status: 'pending' 
                    });
                    topic = trends[0] || 'random';
                }
                
                console.log(`\n🎣 Generating hook for ${niche}...\n`);
                const hookResult = await hookAgent.processTask({
                    id: 'task-hook', type: 'hook', 
                    payload: { topic }, 
                    status: 'pending'
                });
                
                console.log(`📖 Generating story for ${niche}...\n`);
                const storyResult = await storyAgent.processTask({
                    id: 'task-story', type: 'story', 
                    payload: { 
                        topic, 
                        hook: hookResult.hook 
                    }, 
                    status: 'pending'
                });
                
                fullScript = `${hookResult.hook} ${storyResult.story}`;
                scriptResult = { 
                    videoId: storyResult.videoId, 
                    script: fullScript, 
                    hook: hookResult.hook,
                    story: storyResult.story,
                    title: storyResult.title
                };
                console.log(`✅ Content ready for video production\n`);
            }
        }

        // 2. Video Production
        const videoResult = await this.video.processTask({
            id: 'task-video', type: 'video', 
            payload: { 
                videoId: scriptResult.videoId, 
                script: scriptResult.script || scriptResult.story || scriptResult.fact, 
                niche,
                useDriveVideos: true // Use Drive videos from assets/drive_videos (skip image generation)
            }, 
            status: 'pending'
        });

        if (videoResult.status === 'failed') {
            this.log('❌ Video generation failed.');
            if (videoResult.error) {
                this.log(`   Error: ${videoResult.error}`);
            }
            if (videoResult.debugDir) {
                this.log(`   Debug files: ${videoResult.debugDir}`);
            }
            return;
        }

        // 3. Publish
        await this.publish.processTask({
            id: 'task-pub', type: 'publish', 
            payload: { videoId: videoResult.videoId, filePath: videoResult.filePath }, 
            status: 'pending'
        });

        console.log("\n" + "=".repeat(70));
        console.log("✅ Daily cycle completed successfully!");
        console.log("=".repeat(70));
        console.log(`📹 Video ID: ${videoResult.videoId}`);
        console.log(`📁 Video file: ${videoResult.filePath}`);
        if (videoResult.debugDir) {
            console.log(`🔍 Debug files: ${videoResult.debugDir}`);
        }
        console.log("=".repeat(70) + "\n");
        
        this.log('Daily cycle completed successfully.');
    }

    async processTask(task: AgentTask): Promise<any> {
        return;
    }
}
