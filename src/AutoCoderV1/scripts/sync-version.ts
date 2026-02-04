import * as fs from 'fs';
import * as path from 'path';


interface Config {
    id: string;
    version: string;
    name: string;
}

function parseVersion(version: string): { Major: number; Minor: number; Patch: number } {
    const [major, minor, patch] = version.split('.').map(Number);
    return { Major: major, Minor: minor, Patch: patch };
}

function syncVersions(configPath: string, revVersion: boolean = false) {
    const devTaskId = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
    const releaseTaskId = '12345678-90ab-cdef-1234-567890abcdef';

    const config: Config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    const versionParts = parseVersion(config.version);
    if (revVersion) {
        versionParts.Patch += 1;
    }

    // Update task.json
    const taskJsonPath = path.join(__dirname, '..', 'dist', 'task.json');
    const taskJson = JSON.parse(fs.readFileSync(taskJsonPath, 'utf-8'));
    taskJson.version = versionParts;
    if (configPath.endsWith('dev.json')) {
        taskJson.id = devTaskId;
    } else if (configPath.endsWith('release.json')) {
        taskJson.id = releaseTaskId;
    }
    fs.writeFileSync(taskJsonPath, JSON.stringify(taskJson, null, 4));

    // Update agent-executor.ts with version tag
    const agentExecutorPath = path.join(__dirname, '..', 'dist', 'agent-executor.js');
    let agentExecutor = fs.readFileSync(agentExecutorPath, 'utf-8');
    let tag = `${versionParts.Major}.${versionParts.Minor}.${versionParts.Patch}`;
    if (configPath.endsWith('dev.json')) {
        tag = 'dev';
    }
    agentExecutor = agentExecutor.replace(
        /ubuntu-copilot:[^']+/g,
        `ubuntu-copilot:${tag}`
    );
    agentExecutor = agentExecutor.replace(
        /ubuntu-claude:[^']+/g,
        `ubuntu-claude:${tag}`
    );
    fs.writeFileSync(agentExecutorPath, agentExecutor);

    console.log(`Synced version ${config.version} to task.json and agent-executor.js`);
}

const configFile = process.argv[2] || path.join(__dirname, '../config/dev.json');
const revVersion = process.argv.includes('--rev-version');
syncVersions(configFile, revVersion);