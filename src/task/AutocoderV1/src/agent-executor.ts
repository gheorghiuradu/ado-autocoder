import * as tl from 'azure-pipelines-task-lib/task';
import * as tr from 'azure-pipelines-task-lib/toolrunner';

export interface AgentExecutorOptions {
    agentType: 'copilot' | 'claude';
    containerImage?: string;
    systemPrompt: string;
    workingDirectory: string;
}

export class AgentExecutor {
    private readonly defaultImages = {
        copilot: 'autocoder/ubuntu-copilot:latest',
        claude: 'autocoder/ubuntu-claude:latest'
    };

    async execute(options: AgentExecutorOptions): Promise<void> {
        const containerImage = options.containerImage || this.defaultImages[options.agentType];
        
        tl.debug(`Using container image: ${containerImage}`);
        tl.debug(`Agent type: ${options.agentType}`);

        // Validate required environment variables
        this.validateEnvironment(options.agentType);

        // Execute the agent in container
        await this.runAgentInContainer(containerImage, options);
    }

    private validateEnvironment(agentType: 'copilot' | 'claude'): void {
        if (agentType === 'copilot') {
            const githubPat = tl.getVariable('GITHUB_PAT');
            if (!githubPat) {
                throw new Error('GITHUB_PAT environment variable is required for GitHub Copilot agent');
            }
        } else if (agentType === 'claude') {
            const claudeApiKey = tl.getVariable('CLAUDE_API_KEY');
            if (!claudeApiKey) {
                throw new Error('CLAUDE_API_KEY environment variable is required for Claude agent');
            }
        }
    }

    private async runAgentInContainer(
        containerImage: string,
        options: AgentExecutorOptions
    ): Promise<void> {
        // Check if we should use Docker or run directly
        const useContainer = tl.getBoolInput('useContainer', false) ?? this.isContainerAvailable();

        if (useContainer) {
            await this.executeWithDocker(containerImage, options);
        } else {
            await this.executeDirectly(options);
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

        // Build docker run command
        docker.arg('run');
        docker.arg('--rm');
        docker.arg('-v').arg(`${options.workingDirectory}:/workspace`);
        docker.arg('-w').arg('/workspace');

        // Pass environment variables
        if (options.agentType === 'copilot') {
            docker.arg('-e').arg(`GITHUB_PAT=${tl.getVariable('GITHUB_PAT')}`);
        } else {
            docker.arg('-e').arg(`CLAUDE_API_KEY=${tl.getVariable('CLAUDE_API_KEY')}`);
        }

        // Pass the system prompt as an environment variable
        docker.arg('-e').arg(`AUTOCODER_PROMPT=${Buffer.from(options.systemPrompt).toString('base64')}`);

        docker.arg(containerImage);

        const execOptions: tr.IExecOptions = {
            failOnStdErr: false,
            ignoreReturnCode: false
        };

        console.log(`Executing AI agent in container: ${containerImage}`);
        const result = await docker.exec(execOptions);

        if (result !== 0) {
            throw new Error(`AI agent execution failed with exit code ${result}`);
        }
    }

    private async executeDirectly(options: AgentExecutorOptions): Promise<void> {
        // For direct execution (without container), we need the CLI tools installed
        if (options.agentType === 'copilot') {
            await this.executeCopilotDirectly(options);
        } else {
            await this.executeClaudeDirectly(options);
        }
    }

    private async executeCopilotDirectly(options: AgentExecutorOptions): Promise<void> {
        // Note: This is a placeholder for GitHub Copilot CLI execution
        // The actual implementation would depend on the Copilot CLI interface
        console.log('Executing GitHub Copilot agent directly');
        
        const ghPath = tl.which('gh', false);
        if (!ghPath) {
            throw new Error('GitHub CLI (gh) is not installed. Please use container execution or install gh CLI.');
        }

        const gh = tl.tool(ghPath);
        gh.arg('copilot');
        gh.arg('suggest');
        gh.arg('-t').arg('code');
        gh.arg(options.systemPrompt);

        const execOptions: tr.IExecOptions = {
            failOnStdErr: false,
            ignoreReturnCode: false,
            cwd: options.workingDirectory
        };

        const result = await gh.exec(execOptions);
        if (result !== 0) {
            throw new Error(`GitHub Copilot execution failed with exit code ${result}`);
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
