import { TaskRunner } from '../src/task-runner';

// Mock azure-pipelines-task-lib
jest.mock('azure-pipelines-task-lib/task', () => ({
    getInput: jest.fn(),
    getBoolInput: jest.fn(),
    getVariable: jest.fn(),
    debug: jest.fn(),
    warning: jest.fn(),
    setResult: jest.fn(),
    setVariable: jest.fn(),
    which: jest.fn().mockReturnValue('/usr/bin/git'),
    tool: jest.fn().mockReturnValue({
        arg: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(0)
    }),
    TaskResult: {
        Succeeded: 0,
        Failed: 1
    }
}));

// Mock fs
jest.mock('fs', () => ({
    readFileSync: jest.fn().mockReturnValue(`You are an expert software developer.
Work Item Context:
{work_item_details}

Additional Instructions:
{user_prompt}`)
}));

// Mock the services
jest.mock('../src/work-item', () => ({
    WorkItemService: jest.fn().mockImplementation(() => ({
        getWorkItemDetails: jest.fn().mockResolvedValue('Test work item details')
    }))
}));

jest.mock('../src/agent-executor', () => ({
    AgentExecutor: jest.fn().mockImplementation(() => ({
        execute: jest.fn().mockResolvedValue(undefined)
    }))
}));

jest.mock('../src/git-operations', () => ({
    GitOperations: jest.fn().mockImplementation(() => ({
        createBranch: jest.fn().mockResolvedValue(undefined),
        hasChanges: jest.fn().mockResolvedValue(false),
        commitChanges: jest.fn().mockResolvedValue(undefined),
        pushBranch: jest.fn().mockResolvedValue(undefined)
    }))
}));

jest.mock('../src/pull-request', () => ({
    PullRequestService: jest.fn().mockImplementation(() => ({
        createPullRequest: jest.fn().mockResolvedValue('https://dev.azure.com/test/pr/1')
    }))
}));

import * as tl from 'azure-pipelines-task-lib/task';

describe('TaskRunner', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('Input Validation', () => {
        it('should fail if neither workItemId nor userPrompt is provided', async () => {
            (tl.getInput as jest.Mock).mockImplementation((name: string) => {
                if (name === 'agentType') return 'copilot';
                return undefined;
            });
            (tl.getBoolInput as jest.Mock).mockReturnValue(true);
            (tl.getVariable as jest.Mock).mockReturnValue('/workspace');

            const runner = new TaskRunner();
            
            await expect(runner.run()).rejects.toThrow('Either workItemId or userPrompt must be provided');
        });

        it('should fail if invalid agent type is provided', async () => {
            (tl.getInput as jest.Mock).mockImplementation((name: string) => {
                if (name === 'agentType') return 'invalid-agent';
                if (name === 'userPrompt') return 'Test prompt';
                return undefined;
            });
            (tl.getBoolInput as jest.Mock).mockReturnValue(true);
            (tl.getVariable as jest.Mock).mockReturnValue('/workspace');

            const runner = new TaskRunner();
            
            await expect(runner.run()).rejects.toThrow("Invalid agent type: invalid-agent. Must be 'copilot' or 'claude'");
        });
    });

    describe('Branch Name Generation', () => {
        it('should generate branch name with work item ID when provided', () => {
            const runner = new TaskRunner();
            // Access private method via type casting for testing
            const generateBranchName = (runner as any).generateBranchName.bind(runner);
            
            const branchName = generateBranchName('autocoder/', '1234');
            
            expect(branchName).toMatch(/^autocoder\/wi-1234-\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}$/);
        });

        it('should generate branch name without work item ID when not provided', () => {
            const runner = new TaskRunner();
            const generateBranchName = (runner as any).generateBranchName.bind(runner);
            
            const branchName = generateBranchName('autocoder/');
            
            expect(branchName).toMatch(/^autocoder\/\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}$/);
        });
    });

    describe('Commit Message Generation', () => {
        it('should include work item ID in commit message when provided', () => {
            const runner = new TaskRunner();
            const generateCommitMessage = (runner as any).generateCommitMessage.bind(runner);
            
            const message = generateCommitMessage('1234', 'Add new feature');
            
            expect(message).toContain('#1234');
            expect(message).toContain('[Autocoder]');
        });

        it('should truncate long user prompts in commit message', () => {
            const runner = new TaskRunner();
            const generateCommitMessage = (runner as any).generateCommitMessage.bind(runner);
            
            const longPrompt = 'A'.repeat(100);
            const message = generateCommitMessage('1234', longPrompt);
            
            expect(message).toContain('...');
            expect(message.length).toBeLessThan(200);
        });
    });

    describe('PR Title Generation', () => {
        it('should include work item ID in PR title when provided', () => {
            const runner = new TaskRunner();
            const generatePRTitle = (runner as any).generatePRTitle.bind(runner);
            
            const title = generatePRTitle('1234', 'Implement user authentication');
            
            expect(title).toContain('[Autocoder]');
            expect(title).toContain('#1234');
            expect(title).toContain('Implement user authentication');
        });

        it('should use default title when no user prompt provided', () => {
            const runner = new TaskRunner();
            const generatePRTitle = (runner as any).generatePRTitle.bind(runner);
            
            const title = generatePRTitle('1234');
            
            expect(title).toContain('[Autocoder]');
            expect(title).toContain('#1234');
            expect(title).toContain('AI-generated code changes');
        });
    });

    describe('PR Description Generation', () => {
        it('should generate description with all provided information', () => {
            const runner = new TaskRunner();
            const generatePRDescription = (runner as any).generatePRDescription.bind(runner);
            
            const description = generatePRDescription('1234', 'Add login feature', 'copilot');
            
            expect(description).toContain('AI-Generated Pull Request');
            expect(description).toContain('#1234');
            expect(description).toContain('Add login feature');
            expect(description).toContain('GitHub Copilot');
            expect(description).toContain('requires human review');
        });

        it('should correctly identify Claude agent in description', () => {
            const runner = new TaskRunner();
            const generatePRDescription = (runner as any).generatePRDescription.bind(runner);
            
            const description = generatePRDescription('1234', 'Add login feature', 'claude');
            
            expect(description).toContain('Claude Code');
        });
    });
});
