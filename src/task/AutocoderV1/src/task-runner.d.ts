export interface TaskInputs {
    workItemId?: string;
    userPrompt?: string;
    agentType: 'copilot' | 'claude';
    containerImage?: string;
    systemPrompt?: string;
    createPullRequest: boolean;
    targetBranch: string;
    sourceBranchPrefix: string;
    additionalContext?: string;
}
export declare class TaskRunner {
    private workItemService;
    private agentExecutor;
    private gitOperations;
    private pullRequestService;
    constructor();
    run(): Promise<void>;
    private getInputs;
    private validateInputs;
    private prepareSystemPrompt;
    private generateBranchName;
    private generateCommitMessage;
    private generatePRTitle;
    private generatePRDescription;
}
//# sourceMappingURL=task-runner.d.ts.map