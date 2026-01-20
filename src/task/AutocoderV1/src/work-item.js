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
exports.WorkItemService = void 0;
const tl = __importStar(require("azure-pipelines-task-lib/task"));
const azdev = __importStar(require("azure-devops-node-api"));
class WorkItemService {
    constructor() {
        this.connection = null;
    }
    async getConnection() {
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
    async getWorkItemDetails(workItemId) {
        const id = parseInt(workItemId, 10);
        if (isNaN(id)) {
            throw new Error(`Invalid work item ID: ${workItemId}`);
        }
        try {
            const connection = await this.getConnection();
            const witApi = await connection.getWorkItemTrackingApi();
            const workItem = await witApi.getWorkItem(id, undefined, undefined, undefined);
            if (!workItem || !workItem.fields) {
                throw new Error(`Work item ${workItemId} not found`);
            }
            const fields = workItem.fields;
            const workItemData = {
                id: id,
                title: fields['System.Title'] || '',
                description: this.stripHtml(fields['System.Description'] || ''),
                type: fields['System.WorkItemType'] || '',
                state: fields['System.State'] || '',
                acceptanceCriteria: this.stripHtml(fields['Microsoft.VSTS.Common.AcceptanceCriteria'] || '')
            };
            return this.formatWorkItemDetails(workItemData);
        }
        catch (error) {
            if (error instanceof Error) {
                throw new Error(`Failed to fetch work item ${workItemId}: ${error.message}`);
            }
            throw error;
        }
    }
    formatWorkItemDetails(workItem) {
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
    stripHtml(html) {
        if (!html)
            return '';
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
exports.WorkItemService = WorkItemService;
//# sourceMappingURL=work-item.js.map