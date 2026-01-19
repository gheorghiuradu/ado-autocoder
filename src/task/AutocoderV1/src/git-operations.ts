import * as tl from 'azure-pipelines-task-lib/task';
import * as tr from 'azure-pipelines-task-lib/toolrunner';

export class GitOperations {
    private gitPath: string;

    constructor() {
        this.gitPath = tl.which('git', true);
    }

    async createBranch(branchName: string, baseBranch: string): Promise<void> {
        tl.debug(`Creating branch ${branchName} from ${baseBranch}`);

        // Ensure we have the latest from the base branch
        await this.fetch();

        // Create and checkout the new branch
        const git = tl.tool(this.gitPath);
        git.arg('checkout');
        git.arg('-b');
        git.arg(branchName);
        git.arg(`origin/${baseBranch}`);

        const result = await git.exec(this.getExecOptions());
        if (result !== 0) {
            throw new Error(`Failed to create branch ${branchName} from ${baseBranch}`);
        }
    }

    async fetch(): Promise<void> {
        const git = tl.tool(this.gitPath);
        git.arg('fetch');
        git.arg('origin');

        const result = await git.exec(this.getExecOptions());
        if (result !== 0) {
            throw new Error('Failed to fetch from origin');
        }
    }

    async hasChanges(): Promise<boolean> {
        // Stage all changes first to detect them
        const gitAdd = tl.tool(this.gitPath);
        gitAdd.arg('add');
        gitAdd.arg('-A');
        await gitAdd.exec(this.getExecOptions());

        // Check if there are staged changes
        const git = tl.tool(this.gitPath);
        git.arg('diff');
        git.arg('--cached');
        git.arg('--quiet');

        // diff --quiet returns 0 if no changes, 1 if there are changes
        const result = await git.exec({
            ...this.getExecOptions(),
            ignoreReturnCode: true
        });

        return result !== 0;
    }

    async commitChanges(message: string): Promise<void> {
        tl.debug(`Committing changes with message: ${message}`);

        // Configure git user if not already configured
        await this.configureGitUser();

        const git = tl.tool(this.gitPath);
        git.arg('commit');
        git.arg('-m');
        git.arg(message);

        const result = await git.exec(this.getExecOptions());
        if (result !== 0) {
            throw new Error('Failed to commit changes');
        }
    }

    async pushBranch(branchName: string): Promise<void> {
        tl.debug(`Pushing branch ${branchName} to origin`);

        const git = tl.tool(this.gitPath);
        git.arg('push');
        git.arg('origin');
        git.arg(branchName);

        const result = await git.exec(this.getExecOptions());
        if (result !== 0) {
            throw new Error(`Failed to push branch ${branchName}`);
        }
    }

    private async configureGitUser(): Promise<void> {
        // Check if user is already configured
        const checkName = tl.tool(this.gitPath);
        checkName.arg('config');
        checkName.arg('user.name');

        const nameResult = await checkName.exec({
            ...this.getExecOptions(),
            ignoreReturnCode: true
        });

        if (nameResult !== 0) {
            // Set user name
            const setName = tl.tool(this.gitPath);
            setName.arg('config');
            setName.arg('user.name');
            setName.arg('Autocoder Bot');
            await setName.exec(this.getExecOptions());
        }

        // Check if email is already configured
        const checkEmail = tl.tool(this.gitPath);
        checkEmail.arg('config');
        checkEmail.arg('user.email');

        const emailResult = await checkEmail.exec({
            ...this.getExecOptions(),
            ignoreReturnCode: true
        });

        if (emailResult !== 0) {
            // Set user email
            const setEmail = tl.tool(this.gitPath);
            setEmail.arg('config');
            setEmail.arg('user.email');
            setEmail.arg('autocoder@example.com');
            await setEmail.exec(this.getExecOptions());
        }
    }

    private getExecOptions(): tr.IExecOptions {
        return {
            failOnStdErr: false,
            ignoreReturnCode: false,
            cwd: tl.getVariable('Build.SourcesDirectory') || process.cwd()
        };
    }
}
