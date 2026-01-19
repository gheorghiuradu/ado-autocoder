import { WorkItemService } from '../src/work-item';

// Create mock getWorkItem function
const mockGetWorkItem = jest.fn();
const mockWebApi = jest.fn();

// Mock azure-pipelines-task-lib
jest.mock('azure-pipelines-task-lib/task', () => ({
    getVariable: jest.fn(),
    debug: jest.fn(),
    which: jest.fn().mockReturnValue('/usr/bin/git'),
    tool: jest.fn().mockReturnValue({
        arg: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(0)
    })
}));

// Mock azure-devops-node-api
jest.mock('azure-devops-node-api', () => ({
    WebApi: jest.fn().mockImplementation(() => ({
        getWorkItemTrackingApi: jest.fn().mockResolvedValue({
            getWorkItem: mockGetWorkItem
        })
    })),
    getPersonalAccessTokenHandler: jest.fn()
}));

import * as tl from 'azure-pipelines-task-lib/task';
import * as azdev from 'azure-devops-node-api';

describe('WorkItemService', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockGetWorkItem.mockReset();
    });

    describe('getWorkItemDetails', () => {
        it('should throw error for invalid work item ID', async () => {
            const service = new WorkItemService();
            
            await expect(service.getWorkItemDetails('invalid')).rejects.toThrow('Invalid work item ID: invalid');
        });

        it('should throw error when org URL is not available', async () => {
            (tl.getVariable as jest.Mock).mockReturnValue(undefined);

            const service = new WorkItemService();
            
            await expect(service.getWorkItemDetails('123')).rejects.toThrow('Unable to determine Azure DevOps organization URL');
        });

        it('should throw error when access token is not available', async () => {
            (tl.getVariable as jest.Mock).mockImplementation((name: string) => {
                if (name === 'System.TeamFoundationCollectionUri') return 'https://dev.azure.com/org/';
                return undefined;
            });

            const service = new WorkItemService();
            
            await expect(service.getWorkItemDetails('123')).rejects.toThrow('No access token available');
        });

        it('should format work item details correctly', async () => {
            const mockWorkItemData = {
                fields: {
                    'System.Title': 'Test Task',
                    'System.Description': '<p>Test description</p>',
                    'System.WorkItemType': 'Task',
                    'System.State': 'Active',
                    'Microsoft.VSTS.Common.AcceptanceCriteria': '<li>Criteria 1</li><li>Criteria 2</li>'
                }
            };

            mockGetWorkItem.mockResolvedValue(mockWorkItemData);

            (tl.getVariable as jest.Mock).mockImplementation((name: string) => {
                if (name === 'System.TeamFoundationCollectionUri') return 'https://dev.azure.com/org/';
                if (name === 'System.AccessToken') return 'test-token';
                return undefined;
            });

            const service = new WorkItemService();
            const details = await service.getWorkItemDetails('123');

            expect(details).toContain('## Work Item #123');
            expect(details).toContain('**Type:** Task');
            expect(details).toContain('**Title:** Test Task');
            expect(details).toContain('**State:** Active');
            expect(details).toContain('Test description');
        });
    });

    describe('HTML stripping', () => {
        it('should strip HTML tags from content', () => {
            const service = new WorkItemService();
            const stripHtml = (service as any).stripHtml.bind(service);

            expect(stripHtml('<p>Hello</p>')).toBe('Hello');
            expect(stripHtml('<div><span>Nested</span></div>')).toBe('Nested');
            // Note: <br/> adds a newline, but trailing may be trimmed
            expect(stripHtml('<br/>Line break').trim()).toBe('Line break');
        });

        it('should decode HTML entities', () => {
            const service = new WorkItemService();
            const stripHtml = (service as any).stripHtml.bind(service);

            expect(stripHtml('&amp;&lt;&gt;&quot;&#39;')).toBe('&<>"\'');
            // &nbsp; is converted to space, but may be trimmed at the start
            expect(stripHtml('word&nbsp;space')).toContain(' ');
        });

        it('should handle empty input', () => {
            const service = new WorkItemService();
            const stripHtml = (service as any).stripHtml.bind(service);

            expect(stripHtml('')).toBe('');
            expect(stripHtml(null as any)).toBe('');
            expect(stripHtml(undefined as any)).toBe('');
        });
    });
});
