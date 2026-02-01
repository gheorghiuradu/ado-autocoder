import * as tl from 'azure-pipelines-task-lib/task';
import * as tr from 'azure-pipelines-task-lib/toolrunner';
import * as os from 'os';


export interface AgentExecutorOptions {
    agentType: 'copilot' | 'claude';
    containerImage?: string;
    systemPrompt: string;
    workingDirectory: string;
    outDirectory: string;
    apiKey: string;
}

export class AgentExecutor {
    private readonly defaultImages = {
        copilot: 'ghcr.io/gheorghiuradu/ado-autocoder/ubuntu-copilot:latest',
        claude: 'ghcr.io/gheorghiuradu/ado-autocoder/ubuntu-claude:latest'
    };

    async execute(options: AgentExecutorOptions): Promise<void> {
        const containerImage = options.containerImage || this.defaultImages[options.agentType];

        console.log(`Using container image: ${containerImage}`);
        console.log(`Agent type: ${options.agentType}`);

        // Execute the agent in container
        await this.runAgentInContainer(containerImage, options);
    }

    private async runAgentInContainer(
        containerImage: string,
        options: AgentExecutorOptions
    ): Promise<void> {
        // Check if Docker is available, otherwise throw an error
        const useContainer = this.isContainerAvailable();

        if (useContainer) {
            await this.executeWithDocker(containerImage, options);
        } else {
            throw new Error('Docker is not available in the current environment. Please run in an environment with Docker support.');
        }
    }

    private isContainerAvailable(): boolean {
        try {
            const dockerPath = tl.which('docker', false);
            return !!dockerPath;
        } catch {
            return false;
        }
    }

    private async executeWithDocker(
        containerImage: string,
        options: AgentExecutorOptions
    ): Promise<void> {
        const dockerPath = tl.which('docker', true);
        const docker = tl.tool(dockerPath);


        // Get current user's UID and GID
        const uid = process.getuid?.() ?? 1001;
        const gid = process.getgid?.() ?? 1001;

        docker.arg('run');
        docker.arg('--rm');
        docker.arg('-v').arg(`${options.workingDirectory}:/src`);
        docker.arg('-v').arg(`${options.outDirectory}:/out`);
        docker.arg('-e').arg(`HID=${uid}`);
        docker.arg('-e').arg(`HGID=${gid}`);
        if (options.agentType === 'copilot') {
            docker.arg('-e').arg(`GITHUB_TOKEN=${options.apiKey}`);
        } else {
            docker.arg('-e').arg(`ANTHROPIC_API_KEY=${options.apiKey}`);
        }

        docker.arg(containerImage);
        docker.arg(Buffer.from(options.systemPrompt).toString('base64'));

        const execOptions: tr.IExecOptions = {
            failOnStdErr: false,
            ignoreReturnCode: false
        };

        console.log(`Executing AI agent in container: ${containerImage}`);
        const result = await docker.execAsync(execOptions);

        if (result !== 0) {
            throw new Error(`AI agent execution failed with exit code ${result}`);
        }
    }

    private async executeClaudeDirectly(options: AgentExecutorOptions): Promise<void> {
        // Note: This is a placeholder for Claude Code CLI execution
        // The actual implementation would depend on the Claude CLI interface
        console.log('Executing Claude Code agent directly');

        const claudePath = tl.which('claude', false);
        if (!claudePath) {
            throw new Error('Claude CLI is not installed. Please use container execution or install Claude CLI.');
        }

        const claude = tl.tool(claudePath);
        claude.arg('--print');
        claude.arg('--dangerously-skip-permissions');
        claude.arg(options.systemPrompt);

        const execOptions: tr.IExecOptions = {
            failOnStdErr: false,
            ignoreReturnCode: false,
            cwd: options.workingDirectory
        };

        const result = await claude.exec(execOptions);
        if (result !== 0) {
            throw new Error(`Claude Code execution failed with exit code ${result}`);
        }
    }
}
