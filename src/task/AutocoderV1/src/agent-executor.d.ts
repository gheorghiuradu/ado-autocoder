export interface AgentExecutorOptions {
    agentType: 'copilot' | 'claude';
    containerImage?: string;
    systemPrompt: string;
    workingDirectory: string;
}
export declare class AgentExecutor {
    private readonly defaultImages;
    execute(options: AgentExecutorOptions): Promise<void>;
    private validateEnvironment;
    private runAgentInContainer;
    private isContainerAvailable;
    private executeWithDocker;
    private executeDirectly;
    private executeCopilotDirectly;
    private executeClaudeDirectly;
}
//# sourceMappingURL=agent-executor.d.ts.map