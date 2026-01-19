import * as SDK from 'azure-devops-extension-sdk';
import { AzureDevOpsService } from '../services/azure-devops.service';
import { PipelineService } from '../services/pipeline.service';
import { AutocoderConfig, Repository, Branch, Pipeline, WorkItem } from '../models';
import './dialog.scss';

class AutocoderDialog {
    private azureDevOpsService: AzureDevOpsService;
    private pipelineService: PipelineService;
    private config: { workItemId: number } | null = null;
    private workItem: WorkItem | null = null;

    constructor() {
        this.azureDevOpsService = new AzureDevOpsService();
        this.pipelineService = new PipelineService();
    }

    async initialize(): Promise<void> {
        await SDK.init();
        await this.azureDevOpsService.initialize();
        await this.pipelineService.initialize();

        // Get configuration passed from work item action
        this.config = SDK.getConfiguration().workItemId 
            ? { workItemId: SDK.getConfiguration().workItemId }
            : null;

        if (this.config?.workItemId) {
            this.workItem = await this.azureDevOpsService.getWorkItem(this.config.workItemId);
            this.updateWorkItemDisplay();
        }

        await this.populateRepositories();
        await this.populatePipelines();

        this.setupEventListeners();
        SDK.notifyLoadSucceeded();
    }

    private updateWorkItemDisplay(): void {
        const workItemInfo = document.getElementById('work-item-info');
        if (workItemInfo && this.workItem) {
            workItemInfo.textContent = `#${this.workItem.id} - ${this.workItem.title}`;
        }
    }

    private async populateRepositories(): Promise<void> {
        const repoSelect = document.getElementById('repository-select') as HTMLSelectElement;
        if (!repoSelect) return;

        try {
            const repositories = await this.azureDevOpsService.getRepositories();
            repoSelect.innerHTML = '<option value="">Select a repository</option>';
            
            repositories.forEach((repo: Repository) => {
                const option = document.createElement('option');
                option.value = repo.id;
                option.textContent = repo.name;
                option.dataset.defaultBranch = repo.defaultBranch;
                repoSelect.appendChild(option);
            });
        } catch (error) {
            console.error('Failed to load repositories:', error);
            this.showError('Failed to load repositories');
        }
    }

    private async populateBranches(repositoryId: string): Promise<void> {
        const branchSelect = document.getElementById('branch-select') as HTMLSelectElement;
        if (!branchSelect) return;

        try {
            const branches = await this.azureDevOpsService.getBranches(repositoryId);
            branchSelect.innerHTML = '<option value="">Select a branch</option>';
            
            branches.forEach((branch: Branch) => {
                const option = document.createElement('option');
                option.value = branch.name;
                option.textContent = branch.name;
                branchSelect.appendChild(option);
            });

            // Select default branch if available
            const repoSelect = document.getElementById('repository-select') as HTMLSelectElement;
            const selectedOption = repoSelect.options[repoSelect.selectedIndex];
            const defaultBranch = selectedOption?.dataset.defaultBranch;
            if (defaultBranch) {
                branchSelect.value = defaultBranch;
            }
        } catch (error) {
            console.error('Failed to load branches:', error);
            this.showError('Failed to load branches');
        }
    }

    private async populatePipelines(): Promise<void> {
        const pipelineSelect = document.getElementById('pipeline-select') as HTMLSelectElement;
        if (!pipelineSelect) return;

        try {
            const pipelines = await this.azureDevOpsService.getPipelines();
            pipelineSelect.innerHTML = '<option value="">Select a pipeline</option>';
            
            pipelines.forEach((pipeline: Pipeline) => {
                const option = document.createElement('option');
                option.value = pipeline.id.toString();
                option.textContent = pipeline.folder ? `${pipeline.folder}/${pipeline.name}` : pipeline.name;
                pipelineSelect.appendChild(option);
            });
        } catch (error) {
            console.error('Failed to load pipelines:', error);
            this.showError('Failed to load pipelines');
        }
    }

    private setupEventListeners(): void {
        // Repository change handler
        const repoSelect = document.getElementById('repository-select');
        repoSelect?.addEventListener('change', (e) => {
            const target = e.target as HTMLSelectElement;
            if (target.value) {
                this.populateBranches(target.value);
            }
        });

        // Cancel button handler
        const cancelBtn = document.getElementById('cancel-btn');
        cancelBtn?.addEventListener('click', () => {
            const dialogService = SDK.getConfiguration().dialog;
            if (dialogService) {
                dialogService.close();
            }
        });

        // Submit button handler
        const submitBtn = document.getElementById('submit-btn');
        submitBtn?.addEventListener('click', () => this.triggerAutocoder());
    }

    private async triggerAutocoder(): Promise<void> {
        const repoSelect = document.getElementById('repository-select') as HTMLSelectElement;
        const branchSelect = document.getElementById('branch-select') as HTMLSelectElement;
        const pipelineSelect = document.getElementById('pipeline-select') as HTMLSelectElement;
        const agentCopilot = document.getElementById('agent-copilot') as HTMLInputElement;
        const userPromptInput = document.getElementById('user-prompt') as HTMLTextAreaElement;
        const createPrCheckbox = document.getElementById('create-pr') as HTMLInputElement;

        // Validate required fields
        if (!repoSelect?.value) {
            this.showError('Please select a repository');
            return;
        }
        if (!branchSelect?.value) {
            this.showError('Please select a branch');
            return;
        }
        if (!pipelineSelect?.value) {
            this.showError('Please select a pipeline');
            return;
        }

        const config: AutocoderConfig = {
            workItemId: this.config?.workItemId || 0,
            repositoryId: repoSelect.value,
            sourceBranch: branchSelect.value,
            pipelineId: parseInt(pipelineSelect.value, 10),
            agentType: agentCopilot?.checked ? 'copilot' : 'claude',
            userPrompt: userPromptInput?.value,
            createPullRequest: createPrCheckbox?.checked ?? true
        };

        try {
            this.showLoading(true);
            const runUrl = await this.pipelineService.triggerPipeline(config);
            
            this.showSuccess(`Pipeline triggered successfully! <a href="${runUrl}" target="_blank">View Run</a>`);
            
            // Close dialog after a short delay
            setTimeout(() => {
                const dialogService = SDK.getConfiguration().dialog;
                if (dialogService) {
                    dialogService.close();
                }
            }, 2000);
        } catch (error) {
            console.error('Failed to trigger pipeline:', error);
            this.showError(`Failed to trigger pipeline: ${error instanceof Error ? error.message : 'Unknown error'}`);
        } finally {
            this.showLoading(false);
        }
    }

    private showError(message: string): void {
        const statusDiv = document.getElementById('status-message');
        if (statusDiv) {
            statusDiv.className = 'status-message error';
            statusDiv.innerHTML = message;
            statusDiv.style.display = 'block';
        }
    }

    private showSuccess(message: string): void {
        const statusDiv = document.getElementById('status-message');
        if (statusDiv) {
            statusDiv.className = 'status-message success';
            statusDiv.innerHTML = message;
            statusDiv.style.display = 'block';
        }
    }

    private showLoading(show: boolean): void {
        const submitBtn = document.getElementById('submit-btn') as HTMLButtonElement;
        const loadingSpinner = document.getElementById('loading-spinner');
        
        if (submitBtn) {
            submitBtn.disabled = show;
        }
        if (loadingSpinner) {
            loadingSpinner.style.display = show ? 'block' : 'none';
        }
    }
}

// Initialize the dialog when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    const dialog = new AutocoderDialog();
    dialog.initialize().catch(console.error);
});
