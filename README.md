# Autocoder - Azure DevOps AI Pipeline Task

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Azure DevOps](https://img.shields.io/badge/Azure%20DevOps-Extension-blue.svg)](https://marketplace.visualstudio.com/azuredevops)

> Automate code generation using AI agents in Azure Pipelines

Autocoder is an Azure DevOps extension that provides a custom pipeline task for executing AI coding agents (GitHub Copilot or Claude Code) in containerized environments. The task generates code based on work item context or custom prompts, with results delivered as pull requests.

> **Note:** This extension focuses on the pipeline task. A future companion extension will provide Azure Boards UI integration (work item button and trigger modal).

---

## ✨ Features

- **🎯 Work Item Context** - Fetch context from Azure Boards work items (tasks, bugs, user stories) by ID
- **🤖 Multiple AI Agents** - Choose between GitHub Copilot or Claude Code based on your preferences
- **🔄 Automated PR Creation** - Generated code is automatically submitted as pull requests for review
- **📦 Containerized Execution** - Secure, isolated execution in Docker containers
- **⚙️ Flexible Configuration** - Customize system prompts, target branches, and agent behavior
- **📝 Custom Prompts** - Use work item context, custom prompts, or both

---

## 📋 Prerequisites

- Azure DevOps Services or Azure DevOps Server 2020+
- Azure Pipelines with container support (Linux agents)
- One of the following AI agent credentials:
  - **GitHub Copilot**: GitHub Personal Access Token with Copilot access
  - **Claude Code**: Anthropic API key
- Azure DevOps Personal Access Token (PAT) with:
  - Work Items (Read) - if using work item context
  - Code (Read & Write)
  - Build (Read & Execute)

---

## 🚀 Quick Start

### 1. Install the Extension

Install Autocoder from the [Azure DevOps Marketplace](https://marketplace.visualstudio.com/azuredevops):

```bash
# Or install via tfx-cli
tfx extension install --publisher Autocoder --extension-id autocoder
```

### 2. Configure Pipeline Variables

Add the following variables to your Azure Pipeline or Variable Group:

| Variable | Description | Required For |
|----------|-------------|--------------|
| `GITHUB_PAT` | GitHub Personal Access Token | GitHub Copilot |
| `CLAUDE_API_KEY` | Anthropic API key | Claude Code |
| `AZURE_DEVOPS_PAT` | Azure DevOps PAT | Both agents |

**Example Variable Group:**
```yaml
variables:
  - group: autocoder-secrets
```

### 3. Add Pipeline Task

Create a pipeline YAML file or add the task to an existing pipeline:

```yaml
trigger: none # Manual trigger from work items

pool:
  vmImage: 'ubuntu-latest'

steps:
  - task: Autocoder@1
    inputs:
      workItemId: '$(System.WorkItemId)'  # Auto-populated from work item
      agentType: 'copilot'                # or 'claude'
      targetBranch: 'main'
      createPullRequest: true
    env:
      GITHUB_PAT: $(GITHUB_PAT)           # From variable group
      AZURE_DEVOPS_PAT: $(AZURE_DEVOPS_PAT)
```

### 4. Run the Pipeline

Trigger the pipeline manually or via API, passing the required parameters:

```bash
# Example: Trigger via Azure CLI
az pipelines run --name "autocoder-pipeline" \
  --parameters workItemId=1234 agentType=copilot
```

---

## 📖 Documentation

### Pipeline Task Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `workItemId` | string | No | - | Azure Boards work item ID |
| `userPrompt` | string | No | - | Custom instructions for the AI agent |
| `agentType` | picklist | Yes | `copilot` | AI agent: `copilot` or `claude` |
| `containerImage` | string | No | (auto) | Override default container image |
| `systemPrompt` | string | No | (default) | Override default system prompt |
| `createPullRequest` | boolean | No | `true` | Create PR after code generation |
| `targetBranch` | string | No | `main` | Target branch for pull request |
| `sourceBranchPrefix` | string | No | `autocoder/` | Prefix for generated branches |
| `additionalContext` | string | No | - | Additional context files or instructions |

### Environment Variables

| Variable | Agent Type | Description |
|----------|------------|-------------|
| `GITHUB_PAT` | Copilot | GitHub Personal Access Token |
| `CLAUDE_API_KEY` | Claude | Anthropic API key |
| `AZURE_DEVOPS_PAT` | Both | Azure DevOps PAT for API access |

### Container Images

Autocoder uses pre-built container images with all necessary dependencies:

- **GitHub Copilot**: `autocoder/ubuntu-copilot:latest`
  - Ubuntu 22.04 LTS
  - Node.js, Python, .NET SDK, Git
  - GitHub CLI & Copilot CLI

- **Claude Code**: `autocoder/ubuntu-claude:latest`
  - Ubuntu 22.04 LTS
  - Node.js, Python, .NET SDK, Git
  - Claude Code CLI

---

## 💡 Usage Examples

### Basic Usage with Work Item

```yaml
steps:
  - task: Autocoder@1
    inputs:
      workItemId: '$(System.WorkItemId)'
      agentType: 'copilot'
    env:
      GITHUB_PAT: $(GITHUB_PAT)
      AZURE_DEVOPS_PAT: $(AZURE_DEVOPS_PAT)
```

### Custom Prompt without Work Item

```yaml
steps:
  - task: Autocoder@1
    inputs:
      userPrompt: |
        Create a new REST API endpoint for user authentication.
        - Use Express.js
        - Include JWT token generation
        - Add input validation
      agentType: 'claude'
      targetBranch: 'develop'
    env:
      CLAUDE_API_KEY: $(CLAUDE_API_KEY)
      AZURE_DEVOPS_PAT: $(AZURE_DEVOPS_PAT)
```

### With Custom System Prompt

```yaml
steps:
  - task: Autocoder@1
    inputs:
      workItemId: '$(System.WorkItemId)'
      agentType: 'copilot'
      systemPrompt: |
        You are a senior Python developer specializing in Django.
        Follow PEP 8 conventions and write comprehensive docstrings.
        Include unit tests using pytest.
    env:
      GITHUB_PAT: $(GITHUB_PAT)
      AZURE_DEVOPS_PAT: $(AZURE_DEVOPS_PAT)
```

### Without Auto-PR Creation

```yaml
steps:
  - task: Autocoder@1
    inputs:
      workItemId: '$(System.WorkItemId)'
      agentType: 'claude'
      createPullRequest: false  # Commit to branch only
      sourceBranchPrefix: 'feature/'
    env:
      CLAUDE_API_KEY: $(CLAUDE_API_KEY)
      AZURE_DEVOPS_PAT: $(AZURE_DEVOPS_PAT)
```

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                  Azure DevOps Organization                  │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌──────────────────┐         ┌───────────────────────┐    │
│  │  Azure Boards    │  REST   │   Azure Pipelines     │    │
│  │                  │   API   │                       │    │
│  │  ┌────────────┐  │◄────────│  ┌─────────────────┐  │    │
│  │  │ Work Item  │  │ (fetch  │  │ Autocoder Task  │  │    │
│  │  │ (context)  │  │ context)│  │                 │  │    │
│  │  └────────────┘  │         │  │  ┌───────────┐  │  │    │
│  │                  │         │  │  │ Container │  │  │    │
│  └──────────────────┘         │  │  │ • Copilot │  │  │    │
│                               │  │  │ • Claude  │  │  │    │
│                               │  │  └───────────┘  │  │    │
│                               │  │        │        │  │    │
│                               │  │        ▼        │  │    │
│                               │  │  ┌───────────┐  │  │    │
│                               │  │  │ Create PR │  │  │    │
│                               │  │  └───────────┘  │  │    │
│                               │  └─────────────────┘  │    │
│                               └───────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
```

For detailed architecture and design decisions, see [docs/DESIGN.md](docs/DESIGN.md).

---

## 🔧 Development

### Project Structure

```
ado-autocoder/
├── src/
│   └── task/                   # Pipeline task extension
│       ├── vss-extension.json  # Extension manifest
│       ├── AutocoderV1/        # Task implementation
│       │   ├── task.json
│       │   ├── index.ts
│       │   └── src/
│       └── images/
├── containers/                 # Container definitions
│   ├── copilot/
│   └── claude/
├── docs/
│   └── DESIGN.md              # Detailed design document
├── pipelines/
│   ├── build-task.yml
│   ├── build-containers.yml
│   └── templates/
└── package.json
```

### Build from Source

```bash
# Install dependencies
npm install

# Build the extension
npm run build

# Run tests
npm test

# Package extension
npm run package
```

### Build Container Images

```bash
# Build Copilot container
docker build -t autocoder/ubuntu-copilot:latest ./src/containers/copilot

# Build Claude container
docker build -t autocoder/ubuntu-claude:latest ./src/containers/claude
```

---

## 🛣️ Roadmap

- [ ] **Phase 1: Foundation** - Project setup and base containers
- [ ] **Phase 2: AI Integration** - Copilot & Claude agent integration
- [ ] **Phase 3: Git & PR Operations** - Branch management and PR creation
- [ ] **Phase 4: Polish & Error Handling** - Comprehensive error handling and logging
- [ ] **Phase 5: Testing & Documentation** - Comprehensive testing and docs

### Future Enhancements

- **Azure Boards Extension** - Companion extension with work item button and trigger modal
- Multi-file context support
- Iterative conversation mode
- Pre-defined prompt templates
- Usage analytics and cost tracking
- Support for additional AI providers
- AI-assisted code review integration

---

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## 🙏 Acknowledgments

- [Azure DevOps Extension SDK](https://learn.microsoft.com/en-us/azure/devops/extend/overview)
- [GitHub Copilot CLI](https://docs.github.com/en/copilot)
- [Claude Code](https://docs.anthropic.com)

---

## 📬 Support

- **Issues**: [GitHub Issues](https://github.com/yourusername/autocoder/issues)
- **Discussions**: [GitHub Discussions](https://github.com/yourusername/autocoder/discussions)
- **Email**: support@autocoder.dev

---

Made with ❤️ by the Autocoder Team
