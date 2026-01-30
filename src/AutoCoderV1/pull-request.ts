import * as tl from 'azure-pipelines-task-lib/task';
import * as azdev from 'azure-devops-node-api';
import { IGitApi } from 'azure-devops-node-api/GitApi';
import { GitPullRequest } from 'azure-devops-node-api/interfaces/GitInterfaces';

export interface PullRequestOptions {
    sourceBranch: string;
    targetBranch: string;
    title: string;
    description: string;
    workItemId?: string;
}

export class PullRequestService {
    private connection: azdev.WebApi | null = null;

    private async getConnection(): Promise<azdev.WebApi> {
        if (this.connection) {
            return this.connection;
        }

        const orgUrl = tl.getVariable('System.TeamFoundationCollectionUri');
        const token = tl.getVariable('System.AccessToken') || tl.getVariable('AZURE_DEVOPS_PAT');

        if (!orgUrl) {
            throw new Error('Unable to determine Azure DevOps organization URL');
        }

        if (!token) {
            throw new Error('No access token available. Ensure the pipeline has access to System.AccessToken or AZURE_DEVOPS_PAT is set.');
        }

        const authHandler = azdev.getPersonalAccessTokenHandler(token);
        this.connection = new azdev.WebApi(orgUrl, authHandler);

        return this.connection;
    }

    async createPullRequest(options: PullRequestOptions): Promise<string> {
        const connection = await this.getConnection();
        const gitApi = await connection.getGitApi();

        const projectId = tl.getVariable('System.TeamProjectId');
        const repositoryId = tl.getVariable('Build.Repository.ID');

        if (!projectId || !repositoryId) {
            throw new Error('Unable to determine project or repository ID');
        }

        // Create the pull request
        const pullRequest: GitPullRequest = {
            sourceRefName: `refs/heads/${options.sourceBranch}`,
            targetRefName: `refs/heads/${options.targetBranch}`,
            title: options.title,
            description: options.description,
            labels: [
                {
                    name: 'AI-generated'
                }
            ]
        };

        tl.debug(`Creating pull request from ${options.sourceBranch} to ${options.targetBranch}`);

        try {
            const createdPR = await gitApi.createPullRequest(
                pullRequest,
                repositoryId,
                projectId
            );

            if (!createdPR || !createdPR.pullRequestId) {
                throw new Error('Failed to create pull request - no PR ID returned');
            }

            // Link work item if provided
            if (options.workItemId) {
                await this.linkWorkItem(gitApi, repositoryId, createdPR.pullRequestId, options.workItemId);
            }

            // Build the PR URL
            const orgUrl = tl.getVariable('System.TeamFoundationCollectionUri');
            const projectName = tl.getVariable('System.TeamProject');
            const repoName = tl.getVariable('Build.Repository.Name');

            const prUrl = `${orgUrl}${projectName}/_git/${repoName}/pullrequest/${createdPR.pullRequestId}`;
            
            console.log(`Pull request #${createdPR.pullRequestId} created successfully`);
            
            return prUrl;
        } catch (error) {
            if (error instanceof Error) {
                throw new Error(`Failed to create pull request: ${error.message}`);
            }
            throw error;
        }
    }

    private async linkWorkItem(
        _gitApi: IGitApi,
        repositoryId: string,
        pullRequestId: number,
        workItemId: string
    ): Promise<void> {
        try {
            const projectId = tl.getVariable('System.TeamProjectId');
            if (!projectId) {
                throw new Error('Unable to determine project ID');
            }

            // Get the work item resource reference
            const orgUrl = tl.getVariable('System.TeamFoundationCollectionUri');
            const workItemUrl = `${orgUrl}_apis/wit/workItems/${workItemId}`;

            // Add the work item link to the PR
            // Note: The actual API call would depend on the specific Azure DevOps API version
            tl.debug(`Linking work item #${workItemId} to PR #${pullRequestId}`);

            // Use the work item tracking API to create the link
            const connection = await this.getConnection();
            const witApi = await connection.getWorkItemTrackingApi();

            // Create a patch document to add the PR link to the work item
            const patchDocument = [
                {
                    op: 'add',
                    path: '/relations/-',
                    value: {
                        rel: 'ArtifactLink',
                        url: `vstfs:///Git/PullRequestId/${projectId}%2F${repositoryId}%2F${pullRequestId}`,
                        attributes: {
                            name: 'Pull Request'
                        }
                    }
                }
            ];

            await witApi.updateWorkItem(
                undefined,
                patchDocument as any,
                parseInt(workItemId, 10),
                projectId
            );

            console.log(`Work item #${workItemId} linked to pull request #${pullRequestId}`);
        } catch (error) {
            // Don't fail the task if linking fails - just log a warning
            if (error instanceof Error) {
                tl.warning(`Failed to link work item #${workItemId} to pull request: ${error.message}`);
            }
        }
    }
}
