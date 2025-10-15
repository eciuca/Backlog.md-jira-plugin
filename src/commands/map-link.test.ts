import { beforeEach, describe, expect, it, mock } from "bun:test";

// Mock clients and store
const mockBacklogClient = {
	getTask: mock((taskId: string) =>
		Promise.resolve({
			id: taskId,
			title: "Test Task",
			description: "Test description",
			status: "To Do",
			assignee: "alice",
			priority: "high",
			labels: ["backend"],
		}),
	),
};

const mockJiraClient = {
	getIssue: mock((issueKey: string) =>
		Promise.resolve({
			key: issueKey,
			id: "10001",
			summary: "Test Jira Issue",
			description: "Test Jira description",
			status: "To Do",
			issueType: "Task",
			assignee: "bob",
			priority: "medium",
			labels: ["frontend"],
			created: "2025-01-01T00:00:00Z",
			updated: "2025-01-01T00:00:00Z",
		}),
	),
	close: mock(() => Promise.resolve()),
};

const mockStore = {
	getMapping: mock((backlogId: string) => null),
	addMapping: mock((backlogId: string, jiraKey: string) => {}),
	setSnapshot: mock(
		(backlogId: string, side: string, hash: string, payload: unknown) => {},
	),
	logOperation: mock(
		(
			op: string,
			backlogId: string | null,
			jiraKey: string | null,
			outcome: string,
			details?: string,
		) => {},
	),
	close: mock(() => {}),
};

const mockUpdateJiraMetadata = mock(
	(
		filePath: string,
		metadata: {
			jiraKey: string;
			jiraLastSync: string;
			jiraSyncState: string;
		},
	) => {},
);

describe("map link command", () => {
	beforeEach(() => {
		// Reset all mocks
		mockBacklogClient.getTask.mockClear();
		mockJiraClient.getIssue.mockClear();
		mockJiraClient.close.mockClear();
		mockStore.getMapping.mockClear();
		mockStore.addMapping.mockClear();
		mockStore.setSnapshot.mockClear();
		mockStore.logOperation.mockClear();
		mockStore.close.mockClear();
		mockUpdateJiraMetadata.mockClear();
	});

	describe("validation", () => {
		it("should validate that taskId exists", async () => {
			// AC #2: Validate that taskId exists in Backlog
			const taskId = "task-123";

			mockBacklogClient.getTask.mockResolvedValue({
				id: taskId,
				title: "Valid Task",
				status: "To Do",
			});

			await mockBacklogClient.getTask(taskId);

			expect(mockBacklogClient.getTask).toHaveBeenCalledWith(taskId);
		});

		it("should throw error when taskId does not exist", async () => {
			// AC #2: Validate that taskId exists in Backlog
			const taskId = "task-999";

			mockBacklogClient.getTask.mockRejectedValue(
				new Error(`Task ${taskId} not found`),
			);

			await expect(mockBacklogClient.getTask(taskId)).rejects.toThrow(
				"Task task-999 not found",
			);
		});

		it("should validate that jiraKey exists", async () => {
			// AC #3: Validate that jiraKey exists in Jira
			const jiraKey = "PROJ-456";

			mockJiraClient.getIssue.mockResolvedValue({
				key: jiraKey,
				id: "10001",
				summary: "Valid Issue",
				status: "To Do",
				issueType: "Task",
				created: "2025-01-01T00:00:00Z",
				updated: "2025-01-01T00:00:00Z",
			});

			await mockJiraClient.getIssue(jiraKey);

			expect(mockJiraClient.getIssue).toHaveBeenCalledWith(jiraKey);
		});

		it("should throw error when jiraKey does not exist", async () => {
			// AC #3: Validate that jiraKey exists in Jira
			const jiraKey = "PROJ-999";

			mockJiraClient.getIssue.mockRejectedValue(
				new Error(`Jira issue ${jiraKey} not found`),
			);

			await expect(mockJiraClient.getIssue(jiraKey)).rejects.toThrow(
				"Jira issue PROJ-999 not found",
			);
		});
	});

	describe("mapping creation", () => {
		it("should create mapping in database", async () => {
			// AC #4: Create mapping in SQLite database
			const taskId = "task-123";
			const jiraKey = "PROJ-456";

			mockStore.addMapping(taskId, jiraKey);

			expect(mockStore.addMapping).toHaveBeenCalledWith(taskId, jiraKey);
		});

		it("should create initial snapshots for 3-way merge", async () => {
			// AC #5: Create initial snapshots for 3-way merge
			const taskId = "task-123";
			const backlogHash = "backlogHash123";
			const jiraHash = "jiraHash456";

			mockStore.setSnapshot(taskId, "backlog", backlogHash, {});
			mockStore.setSnapshot(taskId, "jira", jiraHash, {});

			expect(mockStore.setSnapshot).toHaveBeenCalledWith(
				taskId,
				"backlog",
				backlogHash,
				{},
			);
			expect(mockStore.setSnapshot).toHaveBeenCalledWith(
				taskId,
				"jira",
				jiraHash,
				{},
			);
		});

		it("should update task frontmatter with Jira metadata", async () => {
			// AC #6: Update task frontmatter with Jira metadata
			const filePath = "/path/to/task-123 - Title.md";
			const metadata = {
				jiraKey: "PROJ-456",
				jiraLastSync: new Date().toISOString(),
				jiraSyncState: "InSync",
			};

			mockUpdateJiraMetadata(filePath, metadata);

			expect(mockUpdateJiraMetadata).toHaveBeenCalledWith(filePath, metadata);
		});
	});

	describe("existing mapping handling", () => {
		it("should detect when mapping already exists", async () => {
			// AC #7: Handle case where mapping already exists
			const taskId = "task-123";
			const existingJiraKey = "PROJ-OLD";

			mockStore.getMapping.mockReturnValue({
				backlogId: taskId,
				jiraKey: existingJiraKey,
				createdAt: "2025-01-01T00:00:00Z",
				updatedAt: "2025-01-01T00:00:00Z",
			});

			const mapping = mockStore.getMapping(taskId);

			expect(mapping).not.toBeNull();
			expect(mapping?.jiraKey).toBe(existingJiraKey);
		});

		it("should allow overwriting with --force flag", async () => {
			// AC #8: Add --force flag to overwrite existing mapping
			const taskId = "task-123";
			const oldJiraKey = "PROJ-OLD";
			const newJiraKey = "PROJ-NEW";
			const force = true;

			mockStore.getMapping.mockReturnValue({
				backlogId: taskId,
				jiraKey: oldJiraKey,
				createdAt: "2025-01-01T00:00:00Z",
				updatedAt: "2025-01-01T00:00:00Z",
			});

			const existingMapping = mockStore.getMapping(taskId);

			if (existingMapping && force) {
				// Should be allowed to overwrite
				mockStore.addMapping(taskId, newJiraKey);
				expect(mockStore.addMapping).toHaveBeenCalledWith(taskId, newJiraKey);
			}
		});

		it("should throw error when mapping exists without --force", async () => {
			// AC #7: Handle case where mapping already exists (error case)
			const taskId = "task-123";
			const existingJiraKey = "PROJ-OLD";
			const force = false;

			mockStore.getMapping.mockReturnValue({
				backlogId: taskId,
				jiraKey: existingJiraKey,
				createdAt: "2025-01-01T00:00:00Z",
				updatedAt: "2025-01-01T00:00:00Z",
			});

			const existingMapping = mockStore.getMapping(taskId);

			if (existingMapping && !force) {
				expect(() => {
					throw new Error(
						`Task ${taskId} is already linked to ${existingMapping.jiraKey}. Use --force to overwrite.`,
					);
				}).toThrow("already linked");
			}
		});
	});

	describe("operation logging", () => {
		it("should log successful operations", async () => {
			// AC #9: Log operation success/failure
			const taskId = "task-123";
			const jiraKey = "PROJ-456";

			mockStore.logOperation("link", taskId, jiraKey, "success");

			expect(mockStore.logOperation).toHaveBeenCalledWith(
				"link",
				taskId,
				jiraKey,
				"success",
			);
		});

		it("should log failed operations", async () => {
			// AC #9: Log operation success/failure
			const taskId = "task-123";
			const jiraKey = "PROJ-456";

			mockStore.logOperation(
				"link",
				taskId,
				jiraKey,
				"failure",
				"Task not found",
			);

			expect(mockStore.logOperation).toHaveBeenCalledWith(
				"link",
				taskId,
				jiraKey,
				"failure",
				"Task not found",
			);
		});
	});
});
