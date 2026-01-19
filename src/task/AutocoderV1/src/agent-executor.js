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
exports.AgentExecutor = void 0;
const tl = __importStar(require("azure-pipelines-task-lib/task"));
class AgentExecutor {
    constructor() {
        this.defaultImages = {
            copilot: 'autocoder/ubuntu-copilot:latest',
            claude: 'autocoder/ubuntu-claude:latest'
        };
    }
    async execute(options) {
        const containerImage = options.containerImage || this.defaultImages[options.agentType];
        tl.debug(`Using container image: ${containerImage}`);
        tl.debug(`Agent type: ${options.agentType}`);
        // Validate required environment variables
        this.validateEnvironment(options.agentType);
        // Execute the agent in container
        await this.runAgentInContainer(containerImage, options);
    }
    validateEnvironment(agentType) {
        if (agentType === 'copilot') {
            const githubPat = tl.getVariable('GITHUB_PAT');
            if (!githubPat) {
                throw new Error('GITHUB_PAT environment variable is required for GitHub Copilot agent');
            }
        }
        else if (agentType === 'claude') {
            const claudeApiKey = tl.getVariable('CLAUDE_API_KEY');
            if (!claudeApiKey) {
                throw new Error('CLAUDE_API_KEY environment variable is required for Claude agent');
            }
        }
    }
    async runAgentInContainer(containerImage, options) {
        // Check if we should use Docker or run directly
        const useContainer = tl.getBoolInput('useContainer', false) ?? this.isContainerAvailable();
        if (useContainer) {
            await this.executeWithDocker(containerImage, options);
        }
        else {
            await this.executeDirectly(options);
        }
    }
    isContainerAvailable() {
        try {
            const dockerPath = tl.which('docker', false);
            return !!dockerPath;
        }
        catch {
            return false;
        }
    }
    async executeWithDocker(containerImage, options) {
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
        }
        else {
            docker.arg('-e').arg(`CLAUDE_API_KEY=${tl.getVariable('CLAUDE_API_KEY')}`);
        }
        // Pass the system prompt as an environment variable
        docker.arg('-e').arg(`AUTOCODER_PROMPT=${Buffer.from(options.systemPrompt).toString('base64')}`);
        docker.arg(containerImage);
        const execOptions = {
            failOnStdErr: false,
            ignoreReturnCode: false
        };
        console.log(`Executing AI agent in container: ${containerImage}`);
        const result = await docker.exec(execOptions);
        if (result !== 0) {
            throw new Error(`AI agent execution failed with exit code ${result}`);
        }
    }
    async executeDirectly(options) {
        // For direct execution (without container), we need the CLI tools installed
        if (options.agentType === 'copilot') {
            await this.executeCopilotDirectly(options);
        }
        else {
            await this.executeClaudeDirectly(options);
        }
    }
    async executeCopilotDirectly(options) {
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
        const execOptions = {
            failOnStdErr: false,
            ignoreReturnCode: false,
            cwd: options.workingDirectory
        };
        const result = await gh.exec(execOptions);
        if (result !== 0) {
            throw new Error(`GitHub Copilot execution failed with exit code ${result}`);
        }
    }
    async executeClaudeDirectly(options) {
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
        const execOptions = {
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
exports.AgentExecutor = AgentExecutor;
//# sourceMappingURL=agent-executor.js.map