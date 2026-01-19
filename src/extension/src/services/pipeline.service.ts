import * as SDK from 'azure-devops-extension-sdk';
import { CommonServiceIds, IProjectPageService } from 'azure-devops-extension-api/Common';
import { AutocoderConfig, PipelineRunRequest } from '../models';

export class PipelineService {
    private accessToken: string | null = null;
    private organizationUrl: string | null = null;
    private projectId: string | null = null;

    async initialize(): Promise<void> {
        await SDK.ready();
        this.accessToken = await SDK.getAccessToken();
        const context = SDK.getHost();
        this.organizationUrl = `https://dev.azure.com/${context.name}`;

        const projectService = await SDK.getService<IProjectPageService>(CommonServiceIds.ProjectPageService);
        const project = await projectService.getProject();
        if (project) {
            this.projectId = project.id;
        }
    }

    private getHeaders(): HeadersInit {
        return {
            'Authorization': `Bearer ${this.accessToken}`,
            'Content-Type': 'application/json'
        };
    }

    async triggerPipeline(config: AutocoderConfig): Promise<string> {
        const requestBody: PipelineRunRequest = {
            templateParameters: {
                workItemId: config.workItemId.toString(),
                agentType: config.agentType,
                userPrompt: config.userPrompt || '',
                createPullRequest: config.createPullRequest.toString(),
                targetBranch: config.sourceBranch
            },
            resources: {
                repositories: {
                    self: {
                        refName: `refs/heads/${config.sourceBranch}`
                    }
                }
            }
        };

        const response = await fetch(
            `${this.organizationUrl}/${this.projectId}/_apis/pipelines/${config.pipelineId}/runs?api-version=7.0`,
            {
                method: 'POST',
                headers: this.getHeaders(),
                body: JSON.stringify(requestBody)
            }
        );

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(`Failed to trigger pipeline: ${response.statusText}. ${errorData.message || ''}`);
        }

        const data = await response.json();
        return data._links?.web?.href || `${this.organizationUrl}/${this.projectId}/_build/results?buildId=${data.id}`;
    }
}
