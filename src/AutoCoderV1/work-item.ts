import * as tl from 'azure-pipelines-task-lib/task';
import * as azdev from 'azure-devops-node-api';

export interface WorkItem {
    id: number;
    title: string;
    description: string;
    type: string;
    state: string;
    acceptanceCriteria?: string;
}

export interface WorkItemDetails {
    id: number;
    title: string;
    details: string;
}

export class WorkItemService {
    private connection: azdev.WebApi | null = null;

    private async getConnection(): Promise<azdev.WebApi> {
        if (this.connection) {
            return this.connection;
        }

        const orgUrl = tl.getVariable('System.TeamFoundationCollectionUri');
        const token = tl.getVariable('System.AccessToken') || tl.getVariable('AZURE_DEVOPS_PAT');

        if (!orgUrl) {
            throw new Error('Unable to determine Azure DevOps organization URL');
        }

        if (!token) {
            throw new Error('No access token available. Ensure the pipeline has access to System.AccessToken or AZURE_DEVOPS_PAT is set.');
        }

        const authHandler = azdev.getPersonalAccessTokenHandler(token);
        this.connection = new azdev.WebApi(orgUrl, authHandler);

        return this.connection;
    }

    async getWorkItemDetails(workItemId: string): Promise<WorkItemDetails> {
        const id = parseInt(workItemId, 10);
        if (isNaN(id)) {
            throw new Error(`Invalid work item ID: ${workItemId}`);
        }

        try {
            const connection = await this.getConnection();
            const witApi = await connection.getWorkItemTrackingApi();

            const workItem = await witApi.getWorkItem(
                id,
                undefined,
                undefined,
                undefined
            );

            if (!workItem || !workItem.fields) {
                throw new Error(`Work item ${workItemId} not found`);
            }

            const fields = workItem.fields;
            const workItemData: WorkItem = {
                id: id,
                title: fields['System.Title'] || '',
                description: this.stripHtml(fields['System.Description'] || ''),
                type: fields['System.WorkItemType'] || '',
                state: fields['System.State'] || '',
                acceptanceCriteria: this.stripHtml(fields['Microsoft.VSTS.Common.AcceptanceCriteria'] || '')
            };

            return {
                id: workItemData.id,
                title: workItemData.title,
                details: this.formatWorkItemDetails(workItemData)
            };
        } catch (error) {
            if (error instanceof Error) {
                throw new Error(`Failed to fetch work item ${workItemId}: ${error.message}`);
            }
            throw error;
        }
    }

    private formatWorkItemDetails(workItem: WorkItem): string {
        let details = '';
        details += `## Work Item #${workItem.id}\n\n`;
        details += `**Type:** ${workItem.type}\n`;
        details += `**Title:** ${workItem.title}\n`;
        details += `**State:** ${workItem.state}\n\n`;

        if (workItem.description) {
            details += `### Description\n${workItem.description}\n\n`;
        }

        if (workItem.acceptanceCriteria) {
            details += `### Acceptance Criteria\n${workItem.acceptanceCriteria}\n`;
        }

        return details;
    }

    private stripHtml(html: string): string {
        if (!html) return '';
        // Basic HTML stripping - replace common tags and decode entities
        return html
            .replace(/<br\s*\/?>/gi, '\n')
            .replace(/<\/p>/gi, '\n\n')
            .replace(/<\/div>/gi, '\n')
            .replace(/<\/li>/gi, '\n')
            .replace(/<li>/gi, '• ')
            .replace(/<[^>]+>/g, '')
            .replace(/&nbsp;/g, ' ')
            .replace(/&amp;/g, '&')
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&quot;/g, '"')
            .replace(/&#39;/g, "'")
            .replace(/\n{3,}/g, '\n\n')
            .trim();
    }
}
