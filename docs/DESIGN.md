# Autocoder - Azure DevOps AI Agent Extension

## Design Document

**Version:** 1.0
**Date:** January 17, 2026
**Status:** Draft

---

## 1. Executive Summary

Autocoder is an Azure DevOps extension that leverages AI coding agents (GitHub Copilot or Claude Code) to automatically generate code solutions for work items. The extension integrates with Azure Boards and Azure Pipelines to provide a seamless workflow where developers can trigger AI-assisted code generation directly from work items, with the results delivered as pull requests.

---

## 2. Goals & Objectives

### Primary Goals
- Automate simple coding tasks by leveraging AI agents
- Reduce developer toil for repetitive or straightforward implementations
- Integrate AI coding capabilities natively into Azure DevOps workflows

### Success Criteria
- Developers can trigger AI code generation from any work item
- Pipeline tasks successfully execute AI agents in containerized environments
- Generated code is automatically submitted as pull requests for review

---

## 3. Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         Azure DevOps Organization                        │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌──────────────────────┐         ┌──────────────────────────────────┐  │
│  │    Azure Boards      │         │        Azure Pipelines           │  │
│  │                      │         │                                  │  │
│  │  ┌────────────────┐  │  HTTP   │  ┌────────────────────────────┐  │  │
│  │  │  Work Item     │  │ ──────► │  │   Autocoder Pipeline Task  │  │  │
│  │  │  + Autocoder   │  │ Trigger │  │                            │  │  │
│  │  │    Button      │  │         │  │  ┌──────────────────────┐  │  │  │
│  │  └────────────────┘  │         │  │  │  Container Options   │  │  │  │
│  │         │            │         │  │  │                      │  │  │  │
│  │         ▼            │         │  │  │  • Ubuntu + Copilot  │  │  │  │
│  │  ┌────────────────┐  │         │  │  │  • Ubuntu + Claude   │  │  │  │
│  │  │ Trigger Modal  │  │         │  │  └──────────────────────┘  │  │  │
│  │  │ • Branch       │  │         │  │             │              │  │  │
│  │  │ • Pipeline     │  │         │  │             ▼              │  │  │
│  │  └────────────────┘  │         │  │  ┌──────────────────────┐  │  │  │
│  │                      │         │  │  │  Create Pull Request │  │  │  │
│  └──────────────────────┘         │  │  └──────────────────────┘  │  │  │
│                                   │  └────────────────────────────────┘  │
│                                   └──────────────────────────────────────┘
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 4. Component Design

### 4.1 Pipeline Task: `AutocoderTask`

#### 4.1.1 Overview

A custom Azure Pipelines task that executes AI coding agents within containerized environments to generate code based on work item descriptions or user prompts.

#### 4.1.2 Input Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `workItemId` | string | No | - | Azure Boards work item ID (Task, PBI, Bug) |
| `userPrompt` | string | No | - | Custom prompt describing the coding task |
| `agentType` | picklist | Yes | `copilot` | AI agent to use: `copilot` or `claude` |
| `containerImage` | string | No | (auto) | Custom container image override |
| `systemPrompt` | string | No | (default) | Override for the default system prompt |
| `createPullRequest` | boolean | No | `true` | Create PR upon completion |
| `targetBranch` | string | No | `main` | Target branch for the pull request |
| `sourceBranchPrefix` | string | No | `autocoder/` | Prefix for the generated source branch |
| `additionalContext` | string | No | - | Additional context files or instructions |

#### 4.1.3 Environment Variables

| Variable | Agent Type | Description |
|----------|------------|-------------|
| `GITHUB_PAT` | copilot | GitHub Personal Access Token for Copilot authentication |
| `CLAUDE_API_KEY` | claude | Anthropic API key for Claude Code |
| `AZURE_DEVOPS_PAT` | both | PAT for Azure DevOps API access (work items, PRs) |
| `SYSTEM_ACCESSTOKEN` | both | Pipeline OAuth token (auto-injected) |

#### 4.1.4 Container Images

**GitHub Copilot Container:**
```
autocoder/ubuntu-copilot:latest
```
- Base: Ubuntu 22.04 LTS
- Includes: Node.js, Python, .NET SDK, Git, GitHub CLI, Copilot CLI
- Entry point: Copilot agent wrapper script

**Claude Code Container:**
```
autocoder/ubuntu-claude:latest
```
- Base: Ubuntu 22.04 LTS
- Includes: Node.js, Python, .NET SDK, Git, Claude Code CLI
- Entry point: Claude agent wrapper script

#### 4.1.5 Default System Prompt

```markdown
You are an expert software developer working on an Azure DevOps repository.

Your task is to implement the requested feature or fix based on the provided context.

Guidelines:
1. Analyze the existing codebase structure and patterns
2. Follow existing code conventions and styles
3. Write clean, maintainable, and well-documented code
4. Include appropriate unit tests when applicable
5. Make minimal, focused changes that address the specific request
6. Do not modify unrelated files or functionality

Work Item Context:
{work_item_details}

Additional Instructions:
{user_prompt}
```

#### 4.1.6 Task Execution Flow

```
┌─────────────────┐
│  Task Starts    │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Validate Inputs │
└────────┬────────┘
         │
         ▼
┌─────────────────┐     ┌─────────────────────────┐
│ Fetch Work Item │────►│ Azure DevOps REST API   │
│ Details         │     │ GET work item by ID     │
└────────┬────────┘     └─────────────────────────┘
         │
         ▼
┌─────────────────┐
│ Prepare Context │
│ & System Prompt │
└────────┬────────┘
         │
         ▼
┌─────────────────┐     ┌─────────────────────────┐
│ Pull Container  │────►│ Container Registry      │
│ Image           │     │ (ACR or Docker Hub)     │
└────────┬────────┘     └─────────────────────────┘
         │
         ▼
┌─────────────────┐
│ Execute Agent   │
│ in Container    │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Agent Generates │
│ Code Changes    │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Commit Changes  │
│ to New Branch   │
└────────┬────────┘
         │
         ▼
┌─────────────────────┐
│ createPullRequest?  │
├──────────┬──────────┤
│   Yes    │    No    │
│    │     │     │    │
│    ▼     │     ▼    │
│ Create   │  Done    │
│ PR via   │          │
│ API      │          │
└──────────┴──────────┘
```

#### 4.1.7 Task Definition (task.json)

```json
{
  "$schema": "https://raw.githubusercontent.com/Microsoft/azure-pipelines-task-lib/master/tasks.schema.json",
  "id": "GUID-HERE",
  "name": "Autocoder",
  "friendlyName": "Autocoder - AI Code Generation",
  "description": "Execute AI coding agents to generate code from work items or prompts",
  "category": "Utility",
  "visibility": ["Build", "Release"],
  "author": "Autocoder Team",
  "version": {
    "Major": 1,
    "Minor": 0,
    "Patch": 0
  },
  "instanceNameFormat": "Autocoder: $(agentType)",
  "inputs": [
    {
      "name": "workItemId",
      "type": "string",
      "label": "Work Item ID",
      "required": false,
      "helpMarkDown": "Azure Boards work item ID to use as context"
    },
    {
      "name": "userPrompt",
      "type": "multiLine",
      "label": "User Prompt",
      "required": false,
      "helpMarkDown": "Custom instructions for the AI agent"
    },
    {
      "name": "agentType",
      "type": "pickList",
      "label": "AI Agent",
      "required": true,
      "defaultValue": "copilot",
      "options": {
        "copilot": "GitHub Copilot",
        "claude": "Claude Code"
      }
    },
    {
      "name": "systemPrompt",
      "type": "multiLine",
      "label": "System Prompt Override",
      "required": false,
      "helpMarkDown": "Override the default system prompt"
    },
    {
      "name": "createPullRequest",
      "type": "boolean",
      "label": "Create Pull Request",
      "defaultValue": true,
      "required": false
    },
    {
      "name": "targetBranch",
      "type": "string",
      "label": "Target Branch",
      "defaultValue": "main",
      "required": false
    }
  ],
  "execution": {
    "Node16": {
      "target": "index.js"
    }
  }
}
```

---

### 4.2 Azure Boards Extension: Work Item Button & Modal

#### 4.2.1 Overview

A contribution to Azure Boards that adds an "Autocoder" button to work item forms. When clicked, it opens a modal dialog allowing users to configure and trigger an AI-powered pipeline run.

#### 4.2.2 UI Components

**Work Item Toolbar Button:**
- Location: Work item form toolbar (menu contribution point)
- Icon: Robot/AI icon
- Label: "Autocoder"
- Visibility: All work item types (configurable)

**Trigger Modal Dialog:**

```
┌─────────────────────────────────────────────────────────────┐
│  🤖 Autocoder - Generate Code                          [X]  │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Work Item: #1234 - Implement user authentication           │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ Repository *                                         │   │
│  │ ┌─────────────────────────────────────────────────┐ │   │
│  │ │ my-project/my-repo                           ▼ │ │   │
│  │ └─────────────────────────────────────────────────┘ │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ Source Branch *                                      │   │
│  │ ┌─────────────────────────────────────────────────┐ │   │
│  │ │ main                                         ▼ │ │   │
│  │ └─────────────────────────────────────────────────┘ │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ Pipeline *                                           │   │
│  │ ┌─────────────────────────────────────────────────┐ │   │
│  │ │ autocoder-pipeline                           ▼ │ │   │
│  │ └─────────────────────────────────────────────────┘ │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ AI Agent *                                           │   │
│  │ ○ GitHub Copilot    ● Claude Code                    │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ Additional Instructions (optional)                   │   │
│  │ ┌─────────────────────────────────────────────────┐ │   │
│  │ │                                                 │ │   │
│  │ │                                                 │ │   │
│  │ └─────────────────────────────────────────────────┘ │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  ☑ Create Pull Request automatically                       │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│                              [Cancel]  [🚀 Start Autocoder] │
└─────────────────────────────────────────────────────────────┘
```

#### 4.2.3 Extension Manifest Contributions

```json
{
  "manifestVersion": 1,
  "id": "autocoder",
  "name": "Autocoder",
  "version": "1.0.0",
  "publisher": "your-publisher",
  "description": "AI-powered code generation for Azure DevOps",
  "categories": ["Azure Boards", "Azure Pipelines"],
  "targets": [
    {
      "id": "Microsoft.VisualStudio.Services"
    }
  ],
  "contributions": [
    {
      "id": "autocoder-work-item-menu",
      "type": "ms.vss-web.action",
      "targets": [
        "ms.vss-work-web.work-item-context-menu"
      ],
      "properties": {
        "text": "Autocoder",
        "title": "Generate code with AI",
        "icon": "images/autocoder-icon.png",
        "group": "actions",
        "uri": "dist/work-item-action.html"
      }
    },
    {
      "id": "autocoder-work-item-form-group",
      "type": "ms.vss-work-web.work-item-form-group",
      "targets": [
        "ms.vss-work-web.work-item-form"
      ],
      "properties": {
        "name": "Autocoder",
        "uri": "dist/work-item-form-group.html"
      }
    },
    {
      "id": "autocoder-dialog",
      "type": "ms.vss-web.external-content",
      "properties": {
        "uri": "dist/dialog.html"
      }
    }
  ],
  "files": [
    {
      "path": "dist",
      "addressable": true
    },
    {
      "path": "images",
      "addressable": true
    }
  ],
  "scopes": [
    "vso.build_execute",
    "vso.code_write",
    "vso.work_write"
  ]
}
```

#### 4.2.4 API Interactions

**Fetch Repositories:**
```http
GET https://dev.azure.com/{organization}/{project}/_apis/git/repositories?api-version=7.0
```

**Fetch Branches:**
```http
GET https://dev.azure.com/{organization}/{project}/_apis/git/repositories/{repositoryId}/refs?filter=heads/&api-version=7.0
```

**Fetch Pipelines:**
```http
GET https://dev.azure.com/{organization}/{project}/_apis/pipelines?api-version=7.0
```

**Trigger Pipeline Run:**
```http
POST https://dev.azure.com/{organization}/{project}/_apis/pipelines/{pipelineId}/runs?api-version=7.0

{
  "templateParameters": {
    "workItemId": "1234",
    "agentType": "claude",
    "userPrompt": "Additional instructions...",
    "createPullRequest": "true",
    "targetBranch": "main"
  },
  "resources": {
    "repositories": {
      "self": {
        "refName": "refs/heads/main"
      }
    }
  }
}
```

---

## 5. Security Considerations

### 5.1 Authentication & Authorization

| Component | Authentication Method | Permissions Required |
|-----------|----------------------|---------------------|
| Pipeline Task | Pipeline OAuth Token | Code Read/Write, Work Items Read |
| Boards Extension | User OAuth Token | Build Execute, Code Write, Work Items Read |
| GitHub Copilot | GITHUB_PAT (secret variable) | GitHub Copilot access |
| Claude Code | CLAUDE_API_KEY (secret variable) | Anthropic API access |

### 5.2 Secret Management

- All API keys must be stored as secret pipeline variables or Azure Key Vault
- Never log or expose secrets in pipeline output
- Use Azure DevOps Variable Groups with Key Vault integration
- Implement token rotation policies

### 5.3 Container Security

- Use signed container images
- Implement vulnerability scanning in container build pipeline
- Run containers with minimal privileges (non-root)
- Network isolation during agent execution
- Scan generated code for secrets before committing

### 5.4 Code Review Requirements

- All AI-generated pull requests require human review
- Implement branch policies on target branches
- Consider adding automated security scanning as PR checks
- Add "AI-generated" label/tag to PRs for visibility

---

## 6. Data Flow

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                              Data Flow Diagram                                │
└──────────────────────────────────────────────────────────────────────────────┘

  User                Azure Boards           Pipeline                AI Agent
   │                      │                     │                       │
   │  Click Autocoder     │                     │                       │
   │─────────────────────►│                     │                       │
   │                      │                     │                       │
   │  Select Options      │                     │                       │
   │─────────────────────►│                     │                       │
   │                      │                     │                       │
   │  Trigger             │  POST /pipelines    │                       │
   │─────────────────────►│────────────────────►│                       │
   │                      │  {workItemId,       │                       │
   │                      │   agentType, ...}   │                       │
   │                      │                     │                       │
   │                      │                     │  GET /workitems/{id}  │
   │                      │◄────────────────────│                       │
   │                      │                     │                       │
   │                      │  {title, desc,      │                       │
   │                      │   acceptance...}    │                       │
   │                      │────────────────────►│                       │
   │                      │                     │                       │
   │                      │                     │  Start Container      │
   │                      │                     │──────────────────────►│
   │                      │                     │  {context, prompt}    │
   │                      │                     │                       │
   │                      │                     │                       │
   │                      │                     │  Generated Code       │
   │                      │                     │◄──────────────────────│
   │                      │                     │                       │
   │                      │                     │  git commit & push    │
   │                      │                     │──────────────────────►│
   │                      │                     │      (to repo)        │
   │                      │                     │                       │
   │                      │                     │  POST /pullrequests   │
   │                      │                     │──────────────────────►│
   │                      │                     │      (to repo)        │
   │                      │                     │                       │
   │  Notification        │                     │                       │
   │◄─────────────────────│◄────────────────────│                       │
   │  (PR Created)        │                     │                       │
```

---

## 7. Project Structure

```
ado-autocoder/
├── docs/
│   ├── DESIGN.md                    # This document
│   ├── ARCHITECTURE.md              # Detailed architecture
│   └── USER_GUIDE.md                # End-user documentation
│
├── src/
│   ├── extension/                   # Azure Boards Extension
│   │   ├── package.json
│   │   ├── vss-extension.json       # Extension manifest
│   │   ├── tsconfig.json
│   │   ├── webpack.config.js
│   │   └── src/
│   │       ├── work-item-action/    # Work item menu action
│   │       │   ├── work-item-action.ts
│   │       │   └── work-item-action.html
│   │       ├── dialog/              # Trigger modal dialog
│   │       │   ├── dialog.ts
│   │       │   ├── dialog.html
│   │       │   └── dialog.scss
│   │       ├── services/            # Shared services
│   │       │   ├── azure-devops.service.ts
│   │       │   └── pipeline.service.ts
│   │       └── models/              # TypeScript interfaces
│   │           └── index.ts
│   │
│   └── task/                        # Pipeline Task
│       ├── AutocoderV1/
│       │   ├── task.json            # Task definition
│       │   ├── package.json
│       │   ├── tsconfig.json
│       │   ├── index.ts             # Task entry point
│       │   ├── src/
│       │   │   ├── task-runner.ts   # Main task logic
│       │   │   ├── work-item.ts     # Work item fetching
│       │   │   ├── agent-executor.ts # Container execution
│       │   │   ├── git-operations.ts # Git operations
│       │   │   ├── pull-request.ts  # PR creation
│       │   │   └── prompts/
│       │   │       └── default-system-prompt.md
│       │   └── tests/
│       │       └── *.test.ts
│       └── vss-extension.json       # Task extension manifest
│
├── containers/
│   ├── copilot/
│   │   ├── Dockerfile
│   │   ├── entrypoint.sh
│   │   └── scripts/
│   │       └── run-copilot.sh
│   └── claude/
│       ├── Dockerfile
│       ├── entrypoint.sh
│       └── scripts/
│           └── run-claude.sh
│
├── pipelines/
│   ├── build-extension.yml          # CI/CD for extension
│   ├── build-containers.yml         # CI/CD for containers
│   └── templates/
│       └── autocoder-template.yml   # Example usage template
│
├── .gitignore
├── LICENSE
└── README.md
```

---

## 8. Implementation Phases

### Phase 1: Foundation (Weeks 1-2)
- [ ] Set up project structure and build pipelines
- [ ] Create base container images (Ubuntu + dependencies)
- [ ] Implement basic pipeline task without AI integration
- [ ] Create extension scaffold with work item button

### Phase 2: AI Integration (Weeks 3-4)
- [ ] Integrate GitHub Copilot CLI into container
- [ ] Integrate Claude Code CLI into container
- [ ] Implement agent execution logic in pipeline task
- [ ] Add work item context fetching

### Phase 3: Git & PR Operations (Weeks 5-6)
- [ ] Implement branch creation and commit logic
- [ ] Add pull request creation functionality
- [ ] Link PR to work item automatically
- [ ] Add status reporting back to work item

### Phase 4: UI & Polish (Weeks 7-8)
- [ ] Complete modal dialog implementation
- [ ] Add loading states and error handling
- [ ] Implement pipeline selection and configuration
- [ ] Add user preferences/settings

### Phase 5: Testing & Documentation (Weeks 9-10)
- [ ] Unit and integration testing
- [ ] End-to-end testing with real repositories
- [ ] Security review
- [ ] Complete documentation

---

## 9. Dependencies

### Runtime Dependencies
- Azure DevOps Services / Azure DevOps Server 2020+
- Docker/Podman for container execution
- Node.js 16+ (pipeline task runtime)
- Git 2.30+

### Development Dependencies
- TypeScript 5.0+
- Azure DevOps Extension SDK
- azure-pipelines-task-lib
- webpack (for extension bundling)
- tfx-cli (for packaging)

### External Services
- GitHub (for Copilot authentication)
- Anthropic API (for Claude Code)
- Container Registry (ACR, Docker Hub, or self-hosted)

---

## 10. Future Enhancements

1. **Multi-file Context** - Allow specifying additional files for context
2. **Conversation Mode** - Iterative refinement of generated code
3. **Template Library** - Pre-defined prompts for common tasks
4. **Usage Analytics** - Track success rates and patterns
5. **Cost Management** - Token usage tracking and limits
6. **Custom Agents** - Support for additional AI providers
7. **Code Review Integration** - AI-assisted code review comments
8. **Learning Mode** - Learn from accepted/rejected PRs

---

## 11. Glossary

| Term | Definition |
|------|------------|
| **Autocoder** | The name of this Azure DevOps extension |
| **Agent** | The AI coding assistant (Copilot or Claude) |
| **PBI** | Product Backlog Item (Azure Boards work item type) |
| **PAT** | Personal Access Token |
| **Work Item** | Azure Boards entity (Task, Bug, PBI, etc.) |

---

## 12. References

- [Azure DevOps Extension SDK](https://learn.microsoft.com/en-us/azure/devops/extend/overview)
- [Azure Pipelines Task SDK](https://github.com/microsoft/azure-pipelines-task-lib)
- [GitHub Copilot CLI](https://docs.github.com/en/copilot)
- [Claude Code Documentation](https://docs.anthropic.com)
- [Azure DevOps REST API](https://learn.microsoft.com/en-us/rest/api/azure/devops)
