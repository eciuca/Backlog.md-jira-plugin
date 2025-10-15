import {
	afterAll,
	afterEach,
	beforeAll,
	beforeEach,
	describe,
	expect,
	it,
	mock,
} from "bun:test";
import { join } from "node:path";
import { cleanupDir, uniqueTestDir, writeJson } from "../../test/helpers/fs.ts";
import type { BacklogTask } from "../integrations/backlog.ts";
import type { JiraIssue } from "../integrations/jira.ts";
import { createIssue } from "./create-issue.ts";

let testDir: string;
let configDir: string;
let dbPath: string;

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

// Mock the modules at file scope
mock.module("../integrations/backlog.ts", () => ({
	BacklogClient: mock(() => mockBacklogClient),
}));

mock.module("../integrations/jira.ts", () => ({
	JiraClient: mock(() => mockJiraClient),
}));

mock.module("../utils/jira-config.ts", () => ({
	getJiraClientOptions: mock(() => ({})),
}));

mock.module("../utils/frontmatter.ts", () => ({
	getTaskFilePath: mock((taskId: string) => `/path/to/${taskId}.md`),
	updateJiraMetadata: mock(() => {}),
}));

describe("createIssue", () => {
	beforeEach(() => {
		// Create unique test directory and config
		testDir = uniqueTestDir("create-issue-test");
		configDir = join(testDir, ".backlog-jira");
		dbPath = join(configDir, "jira-sync.db");

		// Create real config file
		const configPath = join(configDir, "config.json");
		writeJson(configPath, {
			jira: {
				projectKey: "TEST",
				issueType: "Task",
			},
		});

		// Create a real database in the isolated test directory
		const { SyncStore } = require("../state/store.ts");
		const store = new SyncStore(dbPath);

		// Add the "task-mapped" mapping for tests
		store.addMapping("task-mapped", "TEST-100");
		store.close();

		// Reset all mocks before each test
		mockBacklogClient.getTask.mockClear();
		mockJiraClient.createIssue.mockClear();
		mockJiraClient.close.mockClear();
	});

	afterEach(() => {
		// Cleanup test directory
		cleanupDir(testDir);
	});

	it("should create a Jira issue for an unmapped task", async () => {
		const result = await createIssue({
			taskId: "task-123",
			configDir,
			dbPath,
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

		// Verify database operations by checking the actual database
		const { SyncStore } = require("../state/store.ts");
		const store = new SyncStore(dbPath);

		const mapping = store.getMapping("task-123");
		expect(mapping).not.toBeNull();
		expect(mapping?.jiraKey).toBe("TEST-123");

		store.close();

		// Verify cleanup
		expect(mockJiraClient.close).toHaveBeenCalled();
	});

	it("should return error if task does not exist", async () => {
		const result = await createIssue({
			taskId: "task-999",
			configDir,
			dbPath,
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
			configDir,
			dbPath,
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
			configDir,
			dbPath,
		});

		expect(result.success).toBe(true);
		expect(result.jiraKey).toBeUndefined();

		// Should not create Jira issue in dry-run
		expect(mockJiraClient.createIssue).not.toHaveBeenCalled();

		// Verify no mapping was created in dry-run
		const { SyncStore } = require("../state/store.ts");
		const store = new SyncStore(dbPath);

		const mapping = store.getMapping("task-123");
		expect(mapping).toBeNull();

		store.close();
	});

	it("should support custom issue type", async () => {
		const result = await createIssue({
			taskId: "task-123",
			issueType: "Bug",
			configDir,
			dbPath,
		});

		expect(result.success).toBe(true);

		// Verify custom issue type was used
		const createCall = mockJiraClient.createIssue.mock.calls[0];
		expect(createCall[1]).toBe("Bug");
	});

	it("should merge description with acceptance criteria", async () => {
		await createIssue({
			taskId: "task-123",
			configDir,
			dbPath,
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
			configDir,
			dbPath,
		});

		// Verify priority was mapped
		const createCall = mockJiraClient.createIssue.mock.calls[0];
		const options = createCall[3];
		expect(options.priority).toBe("High");
	});

	it("should handle assignee correctly", async () => {
		await createIssue({
			taskId: "task-123",
			configDir,
			dbPath,
		});

		// Verify assignee was extracted (@ prefix removed)
		const createCall = mockJiraClient.createIssue.mock.calls[0];
		const options = createCall[3];
		expect(options.assignee).toBe("testuser");
	});

	it("should pass labels to Jira", async () => {
		await createIssue({
			taskId: "task-123",
			configDir,
			dbPath,
		});

		// Verify labels were passed
		const createCall = mockJiraClient.createIssue.mock.calls[0];
		const options = createCall[3];
		expect(options.labels).toEqual(["test", "feature"]);
	});
});
