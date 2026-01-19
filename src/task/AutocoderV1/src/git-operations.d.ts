export declare class GitOperations {
    private gitPath;
    constructor();
    createBranch(branchName: string, baseBranch: string): Promise<void>;
    fetch(): Promise<void>;
    hasChanges(): Promise<boolean>;
    commitChanges(message: string): Promise<void>;
    pushBranch(branchName: string): Promise<void>;
    private configureGitUser;
    private getExecOptions;
}
//# sourceMappingURL=git-operations.d.ts.map