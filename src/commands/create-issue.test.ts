import { describe, expect, it, mock, beforeEach, afterEach } from "bun:test";
import { createIssue } from "./create-issue.ts";
import type { BacklogTask } from "../integrations/backlog.ts";
import type { JiraIssue } from "../integrations/jira.ts";

// Mock the dependencies
const mockBacklogClient = {
	getTask: mock(async (taskId: string): Promise<BacklogTask> => {
		if (taskId === "task-999") {
			throw new Error("Task not found");
		}
		return {
			id: taskId,
			title: "Test Task",
			status: "To Do",
			description: "Test description",
			assignee: "@testuser",
			labels: ["test", "feature"],
			priority: "High",
			acceptanceCriteria: [
				{ index: 1, text: "First criterion", checked: false },
				{ index: 2, text: "Second criterion", checked: true },
			],
		};
	}),
};

const mockJiraClient = {
	createIssue: mock(
		async (
			projectKey: string,
			issueType: string,
			summary: string,
			options?: unknown,
		): Promise<JiraIssue> => {
			return {
				key: "TEST-123",
				id: "12345",
				summary,
				description: options?.description as string,
				status: "To Do",
				issueType,
				created: new Date().toISOString(),
				updated: new Date().toISOString(),
			};
		},
	),
	close: mock(async () => {}),
};

const mockStore = {
	getMapping: mock((taskId: string) => {
		if (taskId === "task-mapped") {
			return { taskId, jiraKey: "TEST-100" };
		}
		return null;
	}),
	addMapping: mock(() => {}),
	setSnapshot: mock(() => {}),
	updateSyncState: mock(() => {}),
	logOperation: mock(() => {}),
	close: mock(() => {}),
};

// Mock the modules
mock.module("../integrations/backlog.ts", () => ({
	BacklogClient: mock(() => mockBacklogClient),
}));

mock.module("../integrations/jira.ts", () => ({
	JiraClient: mock(() => mockJiraClient),
}));

mock.module("../state/store.ts", () => ({
	SyncStore: mock(() => mockStore),
}));

mock.module("../utils/jira-config.ts", () => ({
	getJiraClientOptions: mock(() => ({})),
}));

mock.module("../utils/frontmatter.ts", () => ({
	getTaskFilePath: mock((taskId: string) => `/path/to/${taskId}.md`),
	updateJiraMetadata: mock(() => {}),
}));

// Mock fs module
mock.module("node:fs", () => ({
	readFileSync: mock(() =>
		JSON.stringify({
			jira: {
				projectKey: "TEST",
				issueType: "Task",
			},
		}),
	),
}));

describe("createIssue", () => {
	beforeEach(() => {
		// Reset all mocks before each test
		mockBacklogClient.getTask.mockClear();
		mockJiraClient.createIssue.mockClear();
		mockJiraClient.close.mockClear();
		mockStore.getMapping.mockClear();
		mockStore.addMapping.mockClear();
		mockStore.setSnapshot.mockClear();
		mockStore.updateSyncState.mockClear();
		mockStore.logOperation.mockClear();
		mockStore.close.mockClear();
	});

	it("should create a Jira issue for an unmapped task", async () => {
		const result = await createIssue({
			taskId: "task-123",
		});

		expect(result.success).toBe(true);
		expect(result.jiraKey).toBe("TEST-123");
		expect(result.taskId).toBe("task-123");

		// Verify Backlog client was called
		expect(mockBacklogClient.getTask).toHaveBeenCalledWith("task-123");

		// Verify Jira client was called
		expect(mockJiraClient.createIssue).toHaveBeenCalled();
		const createCall = mockJiraClient.createIssue.mock.calls[0];
		expect(createCall[0]).toBe("TEST"); // projectKey
		expect(createCall[1]).toBe("Task"); // issueType
		expect(createCall[2]).toBe("Test Task"); // summary

		// Verify store operations
		expect(mockStore.addMapping).toHaveBeenCalledWith("task-123", "TEST-123");
		expect(mockStore.setSnapshot).toHaveBeenCalled();
		expect(mockStore.updateSyncState).toHaveBeenCalled();
		expect(mockStore.logOperation).toHaveBeenCalledWith(
			"create-issue",
			"task-123",
			"TEST-123",
			"success",
			expect.any(String),
		);

		// Verify cleanup
		expect(mockStore.close).toHaveBeenCalled();
		expect(mockJiraClient.close).toHaveBeenCalled();
	});

	it("should return error if task does not exist", async () => {
		const result = await createIssue({
			taskId: "task-999",
		});

		expect(result.success).toBe(false);
		expect(result.error).toContain("not found");
		expect(result.jiraKey).toBeUndefined();

		// Should not create Jira issue
		expect(mockJiraClient.createIssue).not.toHaveBeenCalled();
	});

	it("should return error if task is already mapped", async () => {
		const result = await createIssue({
			taskId: "task-mapped",
		});

		expect(result.success).toBe(false);
		expect(result.error).toContain("already mapped");
		expect(result.error).toContain("TEST-100");

		// Should not create Jira issue
		expect(mockJiraClient.createIssue).not.toHaveBeenCalled();
	});

	it("should support dry-run mode", async () => {
		const result = await createIssue({
			taskId: "task-123",
			dryRun: true,
		});

		expect(result.success).toBe(true);
		expect(result.jiraKey).toBeUndefined();

		// Should not create Jira issue in dry-run
		expect(mockJiraClient.createIssue).not.toHaveBeenCalled();

		// Should not store mapping in dry-run
		expect(mockStore.addMapping).not.toHaveBeenCalled();
	});

	it("should support custom issue type", async () => {
		const result = await createIssue({
			taskId: "task-123",
			issueType: "Bug",
		});

		expect(result.success).toBe(true);

		// Verify custom issue type was used
		const createCall = mockJiraClient.createIssue.mock.calls[0];
		expect(createCall[1]).toBe("Bug");
	});

	it("should merge description with acceptance criteria", async () => {
		await createIssue({
			taskId: "task-123",
		});

		// Verify description includes AC
		const createCall = mockJiraClient.createIssue.mock.calls[0];
		const options = createCall[3];
		expect(options.description).toContain("Test description");
		expect(options.description).toContain("Acceptance Criteria");
		expect(options.description).toContain("First criterion");
		expect(options.description).toContain("Second criterion");
	});

	it("should map priority correctly", async () => {
		await createIssue({
			taskId: "task-123",
		});

		// Verify priority was mapped
		const createCall = mockJiraClient.createIssue.mock.calls[0];
		const options = createCall[3];
		expect(options.priority).toBe("High");
	});

	it("should handle assignee correctly", async () => {
		await createIssue({
			taskId: "task-123",
		});

		// Verify assignee was extracted (@ prefix removed)
		const createCall = mockJiraClient.createIssue.mock.calls[0];
		const options = createCall[3];
		expect(options.assignee).toBe("testuser");
	});

	it("should pass labels to Jira", async () => {
		await createIssue({
			taskId: "task-123",
		});

		// Verify labels were passed
		const createCall = mockJiraClient.createIssue.mock.calls[0];
		const options = createCall[3];
		expect(options.labels).toEqual(["test", "feature"]);
	});
});
