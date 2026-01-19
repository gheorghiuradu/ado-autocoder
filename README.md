# Autocoder - Azure DevOps AI Pipeline Task

Autocoder is an Azure DevOps pipeline task extension that leverages AI coding agents (GitHub Copilot or Claude Code) to automatically generate code solutions. The task can use work item context or custom prompts to generate code, with the results delivered as pull requests.

> **Note:** This extension focuses on the pipeline task. A future companion extension may provide Azure Boards UI integration.

## Features

- 🤖 **AI-Powered Code Generation**: Use GitHub Copilot or Claude Code to automatically generate code
- 📋 **Work Item Context**: Optionally fetch context from Azure Boards work item descriptions
- 🔄 **Automated PR Creation**: Automatically create pull requests with generated changes
- 🎯 **Pipeline Task**: Easy-to-use Azure Pipelines task for CI/CD integration

## Project Structure

```
ado-autocoder/
├── docs/
│   └── DESIGN.md              # Design document
├── src/
│   └── task/                  # Pipeline Task
│       ├── AutocoderV1/
│       │   ├── src/           # Task source code
│       │   ├── tests/         # Unit tests
│       │   └── task.json      # Task definition
│       └── vss-extension.json # Task extension manifest
├── containers/
│   ├── copilot/               # GitHub Copilot container
│   └── claude/                # Claude Code container
└── pipelines/
    ├── build-extension.yml    # Extension CI/CD
    ├── build-containers.yml   # Container CI/CD
    └── templates/             # Usage templates
```

## Prerequisites

- Node.js 16+
- Azure DevOps organization
- GitHub Copilot or Claude Code API access

## Installation

### Build the Pipeline Task

```bash
cd src/task/AutocoderV1
npm install
npm run build
```

### Package the Extension

```bash
cd src/task
npx tfx extension create --manifest-globs vss-extension.json
```

## Usage

### Pipeline Task

Add the Autocoder task to your Azure Pipeline:

```yaml
- task: Autocoder@1
  inputs:
    workItemId: '1234'
    agentType: 'copilot'  # or 'claude'
    userPrompt: 'Implement the feature as described'
    createPullRequest: true
    targetBranch: 'main'
  env:
    GITHUB_PAT: $(GITHUB_PAT)
    CLAUDE_API_KEY: $(CLAUDE_API_KEY)
```

### Task Inputs

| Input | Required | Default | Description |
|-------|----------|---------|-------------|
| `workItemId` | No | - | Azure Boards work item ID |
| `userPrompt` | No | - | Custom instructions for the AI |
| `agentType` | Yes | `copilot` | AI agent: `copilot` or `claude` |
| `containerImage` | No | (auto) | Custom container image |
| `systemPrompt` | No | (default) | Override system prompt |
| `createPullRequest` | No | `true` | Create PR on completion |
| `targetBranch` | No | `main` | Target branch for PR |
| `sourceBranchPrefix` | No | `autocoder/` | Source branch prefix |
| `additionalContext` | No | - | Additional context |

## Environment Variables

| Variable | Agent | Description |
|----------|-------|-------------|
| `GITHUB_PAT` | copilot | GitHub Personal Access Token |
| `CLAUDE_API_KEY` | claude | Anthropic API key |
| `AZURE_DEVOPS_PAT` | both | Azure DevOps PAT (optional) |
| `SYSTEM_ACCESSTOKEN` | both | Pipeline OAuth token |

## Container Images

Pre-built container images are available:

- `autocoder/ubuntu-copilot:latest` - GitHub Copilot agent
- `autocoder/ubuntu-claude:latest` - Claude Code agent

Both containers include:
- Ubuntu 22.04 LTS
- Node.js 20.x
- Python 3
- .NET SDK 8.0
- Git

## Development

### Running Tests

```bash
cd src/task/AutocoderV1
npm test
```

### Linting

```bash
cd src/task/AutocoderV1
npm run lint
```

### Building Containers

```bash
docker build -t autocoder/ubuntu-copilot:latest containers/copilot/
docker build -t autocoder/ubuntu-claude:latest containers/claude/
```

## Security Considerations

- All API keys should be stored as secret pipeline variables
- Generated code should be reviewed before merging
- Container images run as non-root users
- Consider adding branch policies for AI-generated PRs

## License

MIT License - see [LICENSE](LICENSE) for details

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run tests
5. Submit a pull request

## Support

For issues and feature requests, please use the GitHub Issues page.
