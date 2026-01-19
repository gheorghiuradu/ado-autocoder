export interface Repository {
    id: string;
    name: string;
    defaultBranch: string;
    project: {
        id: string;
        name: string;
    };
}

export interface Branch {
    name: string;
    objectId: string;
}

export interface Pipeline {
    id: number;
    name: string;
    folder: string;
}

export interface WorkItem {
    id: number;
    title: string;
    workItemType: string;
    state: string;
}

export interface AutocoderConfig {
    workItemId: number;
    repositoryId: string;
    sourceBranch: string;
    pipelineId: number;
    agentType: 'copilot' | 'claude';
    userPrompt?: string;
    createPullRequest: boolean;
}

export interface PipelineRunRequest {
    templateParameters: {
        workItemId: string;
        agentType: string;
        userPrompt: string;
        createPullRequest: string;
        targetBranch: string;
    };
    resources: {
        repositories: {
            self: {
                refName: string;
            };
        };
    };
}
