import * as tl from 'azure-pipelines-task-lib/task';
import { TaskRunner } from './src/task-runner';

async function run(): Promise<void> {
    try {
        const taskRunner = new TaskRunner();
        await taskRunner.run();
    } catch (err) {
        if (err instanceof Error) {
            tl.setResult(tl.TaskResult.Failed, err.message);
        } else {
            tl.setResult(tl.TaskResult.Failed, 'An unknown error occurred');
        }
    }
}

run();
