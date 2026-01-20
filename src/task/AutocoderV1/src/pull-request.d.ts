export interface PullRequestOptions {
    sourceBranch: string;
    targetBranch: string;
    title: string;
    description: string;
    workItemId?: string;
}
export declare class PullRequestService {
    private connection;
    private getConnection;
    createPullRequest(options: PullRequestOptions): Promise<string>;
    private linkWorkItem;
}
//# sourceMappingURL=pull-request.d.ts.map