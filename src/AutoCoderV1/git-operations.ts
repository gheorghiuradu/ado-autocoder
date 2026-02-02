import * as tl from 'azure-pipelines-task-lib/task';
import * as tr from 'azure-pipelines-task-lib/toolrunner';

export class GitOperations {
    private gitPath: string;

    constructor() {
        this.gitPath = tl.which('git', true);
    }

    async hasChanges(): Promise<boolean> {
        // Stage all changes first to detect them
        const gitAdd = tl.tool(this.gitPath);
        gitAdd.arg('add');
        gitAdd.arg('-A');
        await gitAdd.execAsync(this.getExecOptions());

        // Check if there are staged changes
        const git = tl.tool(this.gitPath);
        git.arg('diff');
        git.arg('--cached');
        git.arg('--quiet');

        // diff --quiet returns 0 if no changes, 1 if there are changes
        const result = await git.execAsync({
            ...this.getExecOptions(),
            ignoreReturnCode: true
        });

        return result !== 0;
    }

    getHeadCommit(): string {
        const git = tl.tool(this.gitPath);
        git.arg('rev-parse');
        git.arg('HEAD');

        const commitHash = git.execSync({
            ...this.getExecOptions(),
            silent: true
        }).stdout.trim();

        return commitHash;
    }

    async commitChanges(message: string): Promise<void> {
        tl.debug(`Committing changes with message: ${message}`);

        // Configure git user if not already configured
        await this.configureGitUser();

        const git = tl.tool(this.gitPath);
        git.arg('commit');
        git.arg('-m');
        git.arg(message);

        const result = await git.execAsync(this.getExecOptions());
        if (result !== 0) {
            throw new Error('Failed to commit changes');
        }
    }

    async fetchBranch(branchName: string): Promise<void> {
        tl.debug(`Fetching branch ${branchName} from origin`);

        const git = tl.tool(this.gitPath);
        git.arg('fetch');
        git.arg('origin');
        git.arg(branchName);

        await git.execAsync({ ...this.getExecOptions(), ignoreReturnCode: true });
    }

    async checkoutBranch(branchName: string): Promise<void> {
        tl.debug(`Checking out branch ${branchName}`);

        const git = tl.tool(this.gitPath);
        git.arg('checkout');
        git.arg(branchName);

        const result = await git.execAsync(this.getExecOptions());
        if (result !== 0) {
            throw new Error(`Failed to checkout branch ${branchName}. Make sure you add a checkout step in your pipeline before running this task.`);
        }
    }

    async pullBranch(branchName: string): Promise<void> {
        tl.debug(`Pulling latest changes for branch ${branchName}`);

        const git = tl.tool(this.gitPath);
        git.arg('pull');
        git.arg('origin');
        git.arg(branchName);

        const result = await git.execAsync(this.getExecOptions());
        if (result !== 0) {
            throw new Error(`Failed to pull branch ${branchName}`);
        }
    }

    async pushBranch(branchName: string): Promise<void> {
        tl.debug(`Pushing branch ${branchName} to origin`);

        const git = tl.tool(this.gitPath);
        git.arg('push');
        git.arg('origin');
        git.arg(branchName);

        const result = await git.execAsync(this.getExecOptions());
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
            await setName.execAsync(this.getExecOptions());

            // Check if email is already configured
            const checkEmail = tl.tool(this.gitPath);
            checkEmail.arg('config');
            checkEmail.arg('user.email');

            const emailResult = await checkEmail.execAsync({
                ...this.getExecOptions(),
                ignoreReturnCode: true
            });
            if (emailResult !== 0) {
                // Set user email
                const setEmail = tl.tool(this.gitPath);
                setEmail.arg('config');
                setEmail.arg('user.email');
                setEmail.arg('autocoder@example.com');
                await setEmail.execAsync(this.getExecOptions());
            }
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
