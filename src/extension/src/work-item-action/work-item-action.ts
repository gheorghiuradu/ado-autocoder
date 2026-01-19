import * as SDK from 'azure-devops-extension-sdk';
import { IWorkItemFormService, WorkItemTrackingServiceIds } from 'azure-devops-extension-api/WorkItemTracking';
import { CommonServiceIds, IHostDialogService, IHostDialogOptions, IExternalDialog } from 'azure-devops-extension-api/Common';

SDK.init();

SDK.ready().then(async () => {
    const workItemFormService = await SDK.getService<IWorkItemFormService>(
        WorkItemTrackingServiceIds.WorkItemFormService
    );

    // Get the current work item ID
    const workItemId = await workItemFormService.getId();

    // Open the Autocoder dialog using the standard host dialog service
    const dialogService = await SDK.getService<IHostDialogService>(CommonServiceIds.HostDialogService);

    const extensionContext = SDK.getExtensionContext();
    const dialogContributionId = `${extensionContext.publisherId}.${extensionContext.extensionId}.autocoder-dialog`;

    const dialogOptions: IHostDialogOptions = {
        title: '🤖 Autocoder - Generate Code',
        width: 600,
        height: 500
    };

    await dialogService.openCustomDialog(
        dialogContributionId,
        dialogOptions,
        {
            workItemId: workItemId
        }
    );
});
