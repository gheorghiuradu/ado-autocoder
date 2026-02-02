import * as tl from 'azure-pipelines-task-lib/task';
import { WorkItemDetails, WorkItemService } from './work-item';
import { AgentExecutor } from './agent-executor';
import { GitOperations } from './git-operations';
import { PullRequestService } from './pull-request';
import * as fs from 'fs';
import * as path from 'path';

export interface TaskInputs {
    workItemId?: string;
    userPrompt?: string;
    agentType: 'copilot' | 'claude';
    apiKey: string;
    containerImage?: string;
    systemPrompt?: string;
    createPullRequest: boolean;
    targetBranch: string;
}

export class TaskRunner {
    private workItemService: WorkItemService;
    private agentExecutor: AgentExecutor;
    private gitOperations: GitOperations;
    private pullRequestService: PullRequestService;

    constructor() {
        this.workItemService = new WorkItemService();
        this.agentExecutor = new AgentExecutor();
        this.gitOperations = new GitOperations();
        this.pullRequestService = new PullRequestService();
    }

    async run(): Promise<void> {
        console.log('Starting Autocoder task');

        // Get and validate inputs
        const inputs = this.getInputs();
        this.validateInputs(inputs);

        console.log(`Agent type: ${inputs.agentType}`);
        console.log(`Create PR: ${inputs.createPullRequest}`);
        console.log(`Target branch: ${inputs.targetBranch}`);

        // Fetch work item details if provided
        let workItemDetails = null as WorkItemDetails | null;
        if (inputs.workItemId) {
            console.log(`Fetching work item: ${inputs.workItemId}`);
            workItemDetails = await this.workItemService.getWorkItemDetails(inputs.workItemId);
        }

        // Prepare the prompt
        const systemPrompt = await this.prepareSystemPrompt(
            inputs.systemPrompt,
            workItemDetails?.details || '',
            inputs.userPrompt,
        );

        // Checkout the source branch
        const branch = tl.getVariable('Build.SourceBranch')?.replace('refs/heads/', '');
        if (!branch) {
            throw new Error('Unable to determine source branch name');
        }
        console.log(`Checking out source branch: ${branch}`);
        await this.gitOperations.fetchBranch(branch);
        await this.gitOperations.checkoutBranch(branch);
        const headBefore = this.gitOperations.getHeadCommit();

        // Execute the AI agent
        console.log('Executing AI agent');
        await this.agentExecutor.execute({
            agentType: inputs.agentType,
            containerImage: inputs.containerImage,
            systemPrompt: systemPrompt,
            workingDirectory: tl.getVariable('Build.SourcesDirectory') || process.cwd(),
            outDirectory: tl.getVariable('Build.ArtifactStagingDirectory') || `${process.cwd()}/out`,
            apiKey: inputs.apiKey,
        });

        // Check if there are any changes to commit
        const hasChanges = await this.gitOperations.hasChanges();
        if (hasChanges) {
            console.log('Committing changes');
            const commitMessage = this.generateCommitMessage(inputs.workItemId, inputs.userPrompt);
            await this.gitOperations.commitChanges(commitMessage);
        }

        const headAfter = this.gitOperations.getHeadCommit();
        if (headBefore === headAfter) {
            console.log('No changes were made by the AI agent. Exiting.');
            tl.setResult(tl.TaskResult.Succeeded, 'No changes to commit');
            return;
        }

        // Sync changes to remote
        console.log(`Syncing changes for branch ${branch}`);
        await this.gitOperations.pullBranch(branch);
        await this.gitOperations.pushBranch(branch);

        // Create pull request if requested
        if (inputs.createPullRequest) {
            console.log('Creating pull request');
            const prTitle = this.generatePRTitle(inputs.workItemId, inputs.userPrompt, workItemDetails?.title);
            const log = fs.readFileSync(path.join(tl.getVariable('Build.ArtifactStagingDirectory') || `${process.cwd()}/out`, 'autocoder.log'), 'utf-8');
            const prDescription = this.generatePRDescription(inputs.workItemId, inputs.userPrompt, inputs.agentType, log);

            const prUrl = await this.pullRequestService.createPullRequest({
                sourceBranch: branch,
                targetBranch: inputs.targetBranch,
                title: prTitle,
                description: prDescription,
                workItemId: inputs.workItemId
            });

            tl.setVariable('AutocoderPullRequestUrl', prUrl);
            console.log(`Pull request created: ${prUrl}`);
        }

        tl.setResult(tl.TaskResult.Succeeded, 'Autocoder task completed successfully');
    }

    private getInputs(): TaskInputs {
        return {
            workItemId: tl.getInput('workItemId', false),
            userPrompt: tl.getInput('userPrompt', false),
            agentType: tl.getInput('agentType', true) as 'copilot' | 'claude',
            apiKey: tl.getInput('apiKey', true) || '',
            containerImage: tl.getInput('containerImage', false),
            systemPrompt: tl.getInput('systemPrompt', false),
            createPullRequest: tl.getBoolInput('createPullRequest', false) ?? true,
            targetBranch: tl.getInput('targetBranch', false) || 'main',
        };
    }

    private validateInputs(inputs: TaskInputs): void {
        if (!inputs.workItemId && !inputs.userPrompt) {
            throw new Error('Either workItemId or userPrompt must be provided');
        }

        if (!['copilot', 'claude'].includes(inputs.agentType)) {
            throw new Error(`Invalid agent type: ${inputs.agentType}. Must be 'copilot' or 'claude'`);
        }

        if (!inputs.apiKey) {
            throw new Error('API key must be provided');
        }
    }

    private async prepareSystemPrompt(
        customSystemPrompt: string | undefined,
        workItemDetails: string,
        userPrompt: string | undefined,
    ): Promise<string> {
        let systemPrompt: string;

        if (customSystemPrompt) {
            systemPrompt = customSystemPrompt;
        } else {
            // Read default system prompt
            const promptPath = path.join(__dirname, 'default-system-prompt.md');
            systemPrompt = fs.readFileSync(promptPath, 'utf-8');
        }

        // Replace placeholders
        systemPrompt = systemPrompt.replace('{work_item_details}', `Work Item Context:
            ${workItemDetails}` || '');
        systemPrompt = systemPrompt.replace('{user_prompt}', `Additional Instructions:
            ${userPrompt}` || '');

        return systemPrompt;
    }

    private generateCommitMessage(workItemId?: string, userPrompt?: string): string {
        let message = '[Autocoder] AI-generated code changes';
        if (workItemId) {
            message += ` for #${workItemId}`;
        }
        if (userPrompt) {
            // Take first 50 characters of user prompt for commit message
            const shortPrompt = userPrompt.substring(0, 50).replace(/\n/g, ' ');
            message += `: ${shortPrompt}${userPrompt.length > 50 ? '...' : ''}`;
        }
        return message;
    }

    private generatePRTitle(workItemId?: string, userPrompt?: string, workItemTitle?: string): string {
        let title = '[Autocoder]';
        if (workItemId) {
            title += ` #${workItemId}:`;
        }
        if (userPrompt) {
            const shortPrompt = userPrompt.substring(0, 60).replace(/\n/g, ' ');
            title += ` ${shortPrompt}${userPrompt.length > 60 ? '...' : ''}`;
        } else if (workItemTitle) {
            title += ` ${workItemTitle}`;
        } else {
            title += ' AI-generated code changes';
        }
        return title;
    }

    private generatePRDescription(workItemId?: string, userPrompt?: string, agentType?: string, log?: string): string {
        let description = '## 🤖 AI-Generated Pull Request\n\n';
        description += 'This pull request was automatically generated by Autocoder.\n\n';
        description += `**AI Agent:** ${agentType === 'copilot' ? 'GitHub Copilot' : 'Claude Code'}\n\n`;

        if (workItemId) {
            description += `**Work Item:** #${workItemId}\n\n`;
        }

        if (userPrompt) {
            description += `**Instructions:**\n${userPrompt}\n\n`;
        }

        description += '---\n\n';
        description += '⚠️ **Note:** This code was generated by AI and requires human review before merging.\n';
        description += 'Please verify the changes carefully and ensure they meet your quality standards.\n';

        if (log) {
            description += '\n---\n\n';
            description += '### Autocoder Log Output\n';
            description += '```\n';
            description += log;
            description += '\n```\n';
        }

        return description.substring(0, 4000); // Limit to first 4000 characters
    }
}
