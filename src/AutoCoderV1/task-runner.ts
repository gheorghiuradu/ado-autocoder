import * as tl from 'azure-pipelines-task-lib/task';
import { WorkItemDetails, WorkItemService } from './work-item';
import { AgentExecutor } from './agent-executor';
import { GitOperations } from './git-operations';
import { PullRequestCommentThread, PullRequestService } from './pull-request';
import * as fs from 'fs';
import * as path from 'path';

export interface TaskInputs {
    operationMode: 'work' | 'prRespond';
    pullRequestId?: string;
    workItemId?: string;
    userPrompt?: string;
    agentType: 'copilot' | 'claude';
    apiKey: string;
    containerImage?: string;
    systemPrompt?: string;
    createPullRequest: boolean;
    targetBranch: string;
    model?: string;
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

        console.log(`Operation mode: ${inputs.operationMode}`);
        console.log(`Agent type: ${inputs.agentType}`);

        if (inputs.operationMode === 'prRespond') {
            await this.runPrRespondMode(inputs);
        } else {
            await this.runWorkMode(inputs);
        }
    }

    private async runWorkMode(inputs: TaskInputs): Promise<void> {
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
            model: inputs.model,
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

    private async runPrRespondMode(inputs: TaskInputs): Promise<void> {
        const pullRequestId = inputs.pullRequestId!;
        console.log(`Addressing comments on pull request #${pullRequestId}`);

        // Fetch PR info and active comment threads
        const prInfo = await this.pullRequestService.getPullRequestInfo(pullRequestId);
        console.log(`PR: "${prInfo.title}" (${prInfo.sourceBranch} → ${prInfo.targetBranch})`);

        const threads = await this.pullRequestService.getActiveCommentThreads(pullRequestId);
        if (threads.length === 0) {
            console.log('No active comment threads found. Exiting.');
            tl.setResult(tl.TaskResult.Succeeded, 'No active comments to address');
            return;
        }
        console.log(`Found ${threads.length} active comment thread(s)`);

        const workItemDetails = prInfo.workItemId ? await this.workItemService.getWorkItemDetails(prInfo.workItemId) : undefined;
        const customInstructions = inputs.userPrompt || '';

        // Prepare the prompt with PR context and comment threads
        const systemPrompt = await this.preparePrReviewSystemPrompt(
            inputs.systemPrompt,
            prInfo.title,
            prInfo.description,
            customInstructions,
            workItemDetails,
            threads,
        );

        // Checkout the PR source branch
        const branch = prInfo.sourceBranch;
        console.log(`Checking out PR source branch: ${branch}`);
        await this.gitOperations.fetchBranch(branch);
        await this.gitOperations.checkoutBranch(branch);
        const headBefore = this.gitOperations.getHeadCommit();

        // Execute the AI agent
        const outDirectory = tl.getVariable('Build.ArtifactStagingDirectory') || `${process.cwd()}/out`;
        console.log('Executing AI agent to address PR comments');
        await this.agentExecutor.execute({
            agentType: inputs.agentType,
            containerImage: inputs.containerImage,
            systemPrompt: systemPrompt,
            workingDirectory: tl.getVariable('Build.SourcesDirectory') || process.cwd(),
            outDirectory: outDirectory,
            apiKey: inputs.apiKey,
            model: inputs.model,
        });

        // Commit and push changes if any
        const hasChanges = await this.gitOperations.hasChanges();
        if (hasChanges) {
            console.log('Committing changes');
            await this.gitOperations.commitChanges(`[Autocoder] Address PR #${pullRequestId} comments`);
            console.log(`Syncing changes for branch ${branch}`);
            await this.gitOperations.pullBranch(branch);
            await this.gitOperations.pushBranch(branch);
        }

        const headAfter = this.gitOperations.getHeadCommit();
        const madeChanges = headBefore !== headAfter;

        // Read agent-generated responses and post them to the PR threads
        const responsesFile = path.join(outDirectory, 'pr-responses.json');
        if (fs.existsSync(responsesFile)) {
            await this.postPrResponses(pullRequestId, responsesFile);
        } else if (madeChanges) {
            // Fallback: post a generic reply to all threads
            for (const thread of threads) {
                await this.pullRequestService.replyToThread(
                    pullRequestId,
                    thread.threadId,
                    '🤖 **Autocoder**: I have addressed this comment and pushed the relevant changes.'
                );
            }
        } else {
            console.log('No changes made and no responses file found');
        }

        tl.setResult(tl.TaskResult.Succeeded, `PR review mode completed. Addressed ${threads.length} comment thread(s).`);
    }

    private async postPrResponses(pullRequestId: string, responsesFile: string): Promise<void> {
        let responses: Array<{ threadId: number; response: string; resolved?: boolean }>;
        try {
            responses = JSON.parse(fs.readFileSync(responsesFile, 'utf-8'));
        } catch (error) {
            tl.warning(`Failed to parse pr-responses.json: ${error instanceof Error ? error.message : error}`);
            return;
        }

        for (const item of responses) {
            if (!item.threadId || !item.response) {
                continue;
            }
            await this.pullRequestService.replyToThread(pullRequestId, item.threadId, `🤖 **Autocoder**: ${item.response}`);
            if (item.resolved) {
                await this.pullRequestService.resolveThread(pullRequestId, item.threadId);
            }
        }
    }

    private async preparePrReviewSystemPrompt(
        customSystemPrompt: string | undefined,
        prTitle: string,
        prDescription: string | undefined,
        customInstructions: string,
        workItemDetails: WorkItemDetails | undefined,
        threads: PullRequestCommentThread[],
    ): Promise<string> {
        let systemPrompt: string;

        if (customSystemPrompt) {
            systemPrompt = customSystemPrompt;
        } else {
            const promptPath = path.join(__dirname, 'pr-respond-system-prompt.md');
            systemPrompt = fs.readFileSync(promptPath, 'utf-8');
        }

        const prContext = `## Pull Request\n**Title:** ${prTitle}\n**Description:** ${prDescription || ''}`;

        const threadsText = threads.map(t => {
            const fileInfo = t.filePath ? `\n**File:** ${t.filePath}` : '';
            const comments = t.comments.map(c => `  - **${c.author}**: ${c.content}`).join('\n');
            return `### Thread #${t.threadId}${fileInfo}\n${comments}`;
        }).join('\n\n');

        const prCommentThreads = `## Active Comment Threads\n\n${threadsText}`;

        systemPrompt = systemPrompt.replace('{pr_context}', prContext);
        systemPrompt = systemPrompt.replace('{pr_comment_threads}', prCommentThreads);
        if (workItemDetails) {
            systemPrompt = systemPrompt.replace('{work_item_details}', `## Work Item Context\n **Title:** ${workItemDetails.title}\n **Description:** ${workItemDetails.details}`);
        } else {
            systemPrompt = systemPrompt.replace('{work_item_details}', '');
        }
        if (customInstructions) {
            systemPrompt = systemPrompt.replace('{custom_instructions}', `## Additional Instructions\n${customInstructions}`);
        } else {
            systemPrompt = systemPrompt.replace('{custom_instructions}', '');
        }

        return systemPrompt;
    }

    private getInputs(): TaskInputs {
        return {
            operationMode: (tl.getInput('operationMode', true) || 'work') as 'work' | 'prRespond',
            pullRequestId: tl.getInput('pullRequestId', false),
            workItemId: tl.getInput('workItemId', false),
            userPrompt: tl.getInput('userPrompt', false),
            agentType: tl.getInput('agentType', true) as 'copilot' | 'claude',
            apiKey: tl.getInput('apiKey', true) || '',
            containerImage: tl.getInput('containerImage', false),
            systemPrompt: tl.getInput('systemPrompt', false),
            createPullRequest: tl.getBoolInput('createPullRequest', false) ?? true,
            targetBranch: tl.getInput('targetBranch', false) || 'main',
            model: tl.getInput('model', false),
        };
    }

    private validateInputs(inputs: TaskInputs): void {
        if (!['work', 'prRespond'].includes(inputs.operationMode)) {
            throw new Error(`Invalid operation mode: ${inputs.operationMode}. Must be 'work' or 'prRespond'`);
        }

        if (inputs.operationMode === 'work' && !inputs.workItemId && !inputs.userPrompt) {
            throw new Error('Either workItemId or userPrompt must be provided in work mode');
        }

        if (inputs.operationMode === 'prRespond' && !inputs.pullRequestId) {
            throw new Error('pullRequestId must be provided in prRespond mode');
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
