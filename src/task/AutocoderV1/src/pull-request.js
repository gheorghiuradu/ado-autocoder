"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.PullRequestService = void 0;
const tl = __importStar(require("azure-pipelines-task-lib/task"));
const azdev = __importStar(require("azure-devops-node-api"));
class PullRequestService {
    constructor() {
        this.connection = null;
    }
    async getConnection() {
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
    async createPullRequest(options) {
        const connection = await this.getConnection();
        const gitApi = await connection.getGitApi();
        const projectId = tl.getVariable('System.TeamProjectId');
        const repositoryId = tl.getVariable('Build.Repository.ID');
        if (!projectId || !repositoryId) {
            throw new Error('Unable to determine project or repository ID');
        }
        // Create the pull request
        const pullRequest = {
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
            const createdPR = await gitApi.createPullRequest(pullRequest, repositoryId, projectId);
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
        }
        catch (error) {
            if (error instanceof Error) {
                throw new Error(`Failed to create pull request: ${error.message}`);
            }
            throw error;
        }
    }
    async linkWorkItem(_gitApi, repositoryId, pullRequestId, workItemId) {
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
            await witApi.updateWorkItem(undefined, patchDocument, parseInt(workItemId, 10), projectId);
            console.log(`Work item #${workItemId} linked to pull request #${pullRequestId}`);
        }
        catch (error) {
            // Don't fail the task if linking fails - just log a warning
            if (error instanceof Error) {
                tl.warning(`Failed to link work item #${workItemId} to pull request: ${error.message}`);
            }
        }
    }
}
exports.PullRequestService = PullRequestService;
//# sourceMappingURL=pull-request.js.map