import * as SDK from 'azure-devops-extension-sdk';
import { IWorkItemFormService, WorkItemTrackingServiceIds } from 'azure-devops-extension-api/WorkItemTracking';

SDK.init();

SDK.ready().then(async () => {
    const workItemFormService = await SDK.getService<IWorkItemFormService>(
        WorkItemTrackingServiceIds.WorkItemFormService
    );

    // Get the current work item ID
    const workItemId = await workItemFormService.getId();

    // Open the Autocoder dialog
    const dialogService = await SDK.getService<IHostDialogService>('ms.vss-features.host-dialog-service');

    const extensionContext = SDK.getExtensionContext();
    const dialogContributionId = `${extensionContext.publisherId}.${extensionContext.extensionId}.autocoder-dialog`;

    const dialogOptions: IHostDialogOptions = {
        title: '🤖 Autocoder - Generate Code',
        width: 600,
        height: 500,
        modal: true,
        buttons: null
    };

    await dialogService.openDialog(
        dialogContributionId,
        dialogOptions,
        {
            workItemId: workItemId
        }
    );
});

// Interfaces for dialog service
interface IHostDialogService {
    openDialog(
        contributionId: string,
        options: IHostDialogOptions,
        contributionConfig?: object
    ): Promise<IExternalDialog>;
}

interface IHostDialogOptions {
    title: string;
    width: number;
    height: number;
    modal: boolean;
    buttons: object | null;
}

interface IExternalDialog {
    getContributionInstance<T>(): Promise<T>;
    close(): void;
}
