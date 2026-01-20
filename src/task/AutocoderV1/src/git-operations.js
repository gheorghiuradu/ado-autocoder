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
exports.GitOperations = void 0;
const tl = __importStar(require("azure-pipelines-task-lib/task"));
class GitOperations {
    constructor() {
        this.gitPath = tl.which('git', true);
    }
    async createBranch(branchName, baseBranch) {
        tl.debug(`Creating branch ${branchName} from ${baseBranch}`);
        // Ensure we have the latest from the base branch
        await this.fetch();
        // Create and checkout the new branch
        const git = tl.tool(this.gitPath);
        git.arg('checkout');
        git.arg('-b');
        git.arg(branchName);
        git.arg(`origin/${baseBranch}`);
        const result = await git.exec(this.getExecOptions());
        if (result !== 0) {
            throw new Error(`Failed to create branch ${branchName} from ${baseBranch}`);
        }
    }
    async fetch() {
        const git = tl.tool(this.gitPath);
        git.arg('fetch');
        git.arg('origin');
        const result = await git.exec(this.getExecOptions());
        if (result !== 0) {
            throw new Error('Failed to fetch from origin');
        }
    }
    async hasChanges() {
        // Stage all changes first to detect them
        const gitAdd = tl.tool(this.gitPath);
        gitAdd.arg('add');
        gitAdd.arg('-A');
        await gitAdd.exec(this.getExecOptions());
        // Check if there are staged changes
        const git = tl.tool(this.gitPath);
        git.arg('diff');
        git.arg('--cached');
        git.arg('--quiet');
        // diff --quiet returns 0 if no changes, 1 if there are changes
        const result = await git.exec({
            ...this.getExecOptions(),
            ignoreReturnCode: true
        });
        return result !== 0;
    }
    async commitChanges(message) {
        tl.debug(`Committing changes with message: ${message}`);
        // Configure git user if not already configured
        await this.configureGitUser();
        const git = tl.tool(this.gitPath);
        git.arg('commit');
        git.arg('-m');
        git.arg(message);
        const result = await git.exec(this.getExecOptions());
        if (result !== 0) {
            throw new Error('Failed to commit changes');
        }
    }
    async pushBranch(branchName) {
        tl.debug(`Pushing branch ${branchName} to origin`);
        const git = tl.tool(this.gitPath);
        git.arg('push');
        git.arg('origin');
        git.arg(branchName);
        const result = await git.exec(this.getExecOptions());
        if (result !== 0) {
            throw new Error(`Failed to push branch ${branchName}`);
        }
    }
    async configureGitUser() {
        // Check if user is already configured
        const checkName = tl.tool(this.gitPath);
        checkName.arg('config');
        checkName.arg('user.name');
        const nameResult = await checkName.exec({
            ...this.getExecOptions(),
            ignoreReturnCode: true
        });
        if (nameResult !== 0) {
            // Set user name
            const setName = tl.tool(this.gitPath);
            setName.arg('config');
            setName.arg('user.name');
            setName.arg('Autocoder Bot');
            await setName.exec(this.getExecOptions());
        }
        // Check if email is already configured
        const checkEmail = tl.tool(this.gitPath);
        checkEmail.arg('config');
        checkEmail.arg('user.email');
        const emailResult = await checkEmail.exec({
            ...this.getExecOptions(),
            ignoreReturnCode: true
        });
        if (emailResult !== 0) {
            // Set user email
            const setEmail = tl.tool(this.gitPath);
            setEmail.arg('config');
            setEmail.arg('user.email');
            setEmail.arg('autocoder@example.com');
            await setEmail.exec(this.getExecOptions());
        }
    }
    getExecOptions() {
        return {
            failOnStdErr: false,
            ignoreReturnCode: false,
            cwd: tl.getVariable('Build.SourcesDirectory') || process.cwd()
        };
    }
}
exports.GitOperations = GitOperations;
//# sourceMappingURL=git-operations.js.map