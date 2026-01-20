export interface WorkItem {
    id: number;
    title: string;
    description: string;
    type: string;
    state: string;
    acceptanceCriteria?: string;
}
export declare class WorkItemService {
    private connection;
    private getConnection;
    getWorkItemDetails(workItemId: string): Promise<string>;
    private formatWorkItemDetails;
    private stripHtml;
}
//# sourceMappingURL=work-item.d.ts.map