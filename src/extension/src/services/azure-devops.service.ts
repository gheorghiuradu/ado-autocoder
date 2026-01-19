import * as SDK from 'azure-devops-extension-sdk';
import { CommonServiceIds, IProjectPageService } from 'azure-devops-extension-api/Common';
import { Repository, Branch, Pipeline, WorkItem } from '../models';

export class AzureDevOpsService {
    private accessToken: string | null = null;
    private projectId: string | null = null;
    private organizationUrl: string | null = null;

    async initialize(): Promise<void> {
        await SDK.ready();
        this.accessToken = await SDK.getAccessToken();
        const context = SDK.getHost();
        this.organizationUrl = `https://dev.azure.com/${context.name}`;
        
        const projectService = await SDK.getService<IProjectPageService>(CommonServiceIds.ProjectPageService);
        const project = await projectService.getProject();
        if (project) {
            this.projectId = project.id;
        }
    }

    private getHeaders(): HeadersInit {
        return {
            'Authorization': `Bearer ${this.accessToken}`,
            'Content-Type': 'application/json'
        };
    }

    async getRepositories(): Promise<Repository[]> {
        const response = await fetch(
            `${this.organizationUrl}/${this.projectId}/_apis/git/repositories?api-version=7.0`,
            { headers: this.getHeaders() }
        );

        if (!response.ok) {
            throw new Error(`Failed to fetch repositories: ${response.statusText}`);
        }

        const data = await response.json();
        return data.value.map((repo: any) => ({
            id: repo.id,
            name: repo.name,
            defaultBranch: repo.defaultBranch?.replace('refs/heads/', '') || 'main',
            project: {
                id: repo.project.id,
                name: repo.project.name
            }
        }));
    }

    async getBranches(repositoryId: string): Promise<Branch[]> {
        const response = await fetch(
            `${this.organizationUrl}/${this.projectId}/_apis/git/repositories/${repositoryId}/refs?filter=heads/&api-version=7.0`,
            { headers: this.getHeaders() }
        );

        if (!response.ok) {
            throw new Error(`Failed to fetch branches: ${response.statusText}`);
        }

        const data = await response.json();
        return data.value.map((ref: any) => ({
            name: ref.name.replace('refs/heads/', ''),
            objectId: ref.objectId
        }));
    }

    async getPipelines(): Promise<Pipeline[]> {
        const response = await fetch(
            `${this.organizationUrl}/${this.projectId}/_apis/pipelines?api-version=7.0`,
            { headers: this.getHeaders() }
        );

        if (!response.ok) {
            throw new Error(`Failed to fetch pipelines: ${response.statusText}`);
        }

        const data = await response.json();
        return data.value.map((pipeline: any) => ({
            id: pipeline.id,
            name: pipeline.name,
            folder: pipeline.folder || ''
        }));
    }

    async getWorkItem(workItemId: number): Promise<WorkItem> {
        const response = await fetch(
            `${this.organizationUrl}/${this.projectId}/_apis/wit/workitems/${workItemId}?api-version=7.0`,
            { headers: this.getHeaders() }
        );

        if (!response.ok) {
            throw new Error(`Failed to fetch work item: ${response.statusText}`);
        }

        const data = await response.json();
        return {
            id: data.id,
            title: data.fields['System.Title'],
            workItemType: data.fields['System.WorkItemType'],
            state: data.fields['System.State']
        };
    }
}
