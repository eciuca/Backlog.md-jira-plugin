import { describe, expect, it } from "bun:test";
import { PlainTextDisplayAdapter, BlessedDisplayAdapter, type TaskWithJira } from "./display-adapter.ts";
import type { Task } from "../../../src/types/index.ts";

describe("PlainTextDisplayAdapter", () => {
	it("should add Jira metadata section to plain text output", () => {
		const task: TaskWithJira = {
			id: "task-1",
			title: "Test Task",
			status: "In Progress",
			assignee: ["@user"],
			reporter: "@reporter",
			createdDate: "2025-01-01",
			updatedDate: "2025-01-02",
			labels: [],
			dependencies: [],
			rawContent: "# Test\nContent",
			description: "Test description",
			jiraKey: "PROJ-123",
			jiraUrl: "https://jira.example.com/browse/PROJ-123",
			jiraLastSync: "2025-01-02T10:00:00Z",
			jiraSyncState: "InSync",
		};

		const content = "# Test\nContent";
		const coreFormatter = (t: Task, c: string, _f?: string) => {
			return `Task ${t.id} - ${t.title}\nCore output`;
		};

		const result = PlainTextDisplayAdapter.formatTaskWithJira(task, content, undefined, coreFormatter);

		expect(result).toContain("Task task-1 - Test Task");
		expect(result).toContain("Core output");
		expect(result).toContain("Jira Integration:");
		expect(result).toContain("Jira Key: PROJ-123");
		expect(result).toContain("Jira URL: https://jira.example.com/browse/PROJ-123");
		expect(result).toContain("Last Sync: 2025-01-02T10:00:00Z");
		expect(result).toContain("Sync State: ✅ InSync");
	});

	it("should not add Jira section if no Jira metadata", () => {
		const task: Task = {
			id: "task-1",
			title: "Test Task",
			status: "To Do",
			assignee: [],
			labels: [],
			dependencies: [],
			rawContent: "# Test\nContent",
		};

		const content = "# Test\nContent";
		const coreFormatter = (t: Task, _c: string, _f?: string) => {
			return `Task ${t.id} - ${t.title}\nCore output`;
		};

		const result = PlainTextDisplayAdapter.formatTaskWithJira(task, content, undefined, coreFormatter);

		expect(result).toBe("Task task-1 - Test Task\nCore output");
		expect(result).not.toContain("Jira Integration:");
	});

	it("should show correct sync state icons", () => {
		const createTaskWithState = (state: string): TaskWithJira => ({
			id: "task-1",
			title: "Test",
			status: "To Do",
			assignee: [],
			labels: [],
			dependencies: [],
			rawContent: "",
			jiraKey: "PROJ-1",
			jiraSyncState: state as any,
		});

		const coreFormatter = (_t: Task, _c: string, _f?: string) => "Core";

		const inSyncResult = PlainTextDisplayAdapter.formatTaskWithJira(
			createTaskWithState("InSync"),
			"",
			undefined,
			coreFormatter,
		);
		expect(inSyncResult).toContain("✅ InSync");

		const needsPushResult = PlainTextDisplayAdapter.formatTaskWithJira(
			createTaskWithState("NeedsPush"),
			"",
			undefined,
			coreFormatter,
		);
		expect(needsPushResult).toContain("⬆️ NeedsPush");

		const needsPullResult = PlainTextDisplayAdapter.formatTaskWithJira(
			createTaskWithState("NeedsPull"),
			"",
			undefined,
			coreFormatter,
		);
		expect(needsPullResult).toContain("⬇️ NeedsPull");

		const conflictResult = PlainTextDisplayAdapter.formatTaskWithJira(
			createTaskWithState("Conflict"),
			"",
			undefined,
			coreFormatter,
		);
		expect(conflictResult).toContain("⚠️ Conflict");

		const unknownResult = PlainTextDisplayAdapter.formatTaskWithJira(
			createTaskWithState("Unknown"),
			"",
			undefined,
			coreFormatter,
		);
		expect(unknownResult).toContain("❓ Unknown");
	});
});

describe("BlessedDisplayAdapter", () => {
	it("should add Jira metadata to blessed UI body content", () => {
		const task: TaskWithJira = {
			id: "task-1",
			title: "Test Task",
			status: "In Progress",
			assignee: ["@user"],
			labels: [],
			dependencies: [],
			rawContent: "",
			jiraKey: "PROJ-123",
			jiraUrl: "https://jira.example.com/browse/PROJ-123",
			jiraLastSync: "2025-01-02T10:00:00Z",
			jiraSyncState: "InSync",
		};

		const coreGenerator = (_t: Task, _r: string) => ({
			headerContent: ["Header"],
			bodyContent: [
				"{bold}{cyan-fg}Details{/}",
				"Some details",
				"",
				"{bold}{cyan-fg}Description{/}",
				"Some description",
			],
		});

		const result = BlessedDisplayAdapter.generateDetailContentWithJira(task, "", coreGenerator);

		expect(result.headerContent).toEqual(["Header"]);
		expect(result.bodyContent).toContain("{bold}{cyan-fg}Jira Integration{/}");
		expect(result.bodyContent.some((line) => line.includes("Jira Key"))).toBe(true);
		expect(result.bodyContent.some((line) => line.includes("PROJ-123"))).toBe(true);
		expect(result.bodyContent.some((line) => line.includes("Sync State"))).toBe(true);
	});

	it("should not modify content if no Jira metadata", () => {
		const task: Task = {
			id: "task-1",
			title: "Test Task",
			status: "To Do",
			assignee: [],
			labels: [],
			dependencies: [],
			rawContent: "",
		};

		const coreGenerator = (_t: Task, _r: string) => ({
			headerContent: ["Header"],
			bodyContent: [
				"{bold}{cyan-fg}Details{/}",
				"Some details",
				"",
				"{bold}{cyan-fg}Description{/}",
				"Some description",
			],
		});

		const originalContent = coreGenerator(task, "");
		const result = BlessedDisplayAdapter.generateDetailContentWithJira(task, "", coreGenerator);

		expect(result.headerContent).toEqual(originalContent.headerContent);
		expect(result.bodyContent).toEqual(originalContent.bodyContent);
		expect(result.bodyContent.some((line) => line.includes("Jira Integration"))).toBe(false);
	});

	it("should insert Jira metadata after Details section", () => {
		const task: TaskWithJira = {
			id: "task-1",
			title: "Test Task",
			status: "To Do",
			assignee: [],
			labels: [],
			dependencies: [],
			rawContent: "",
			jiraKey: "PROJ-1",
		};

		const coreGenerator = (_t: Task, _r: string) => ({
			headerContent: ["Header"],
			bodyContent: [
				"{bold}{cyan-fg}Details{/}",
				"Line 1",
				"Line 2",
				"",
				"{bold}{cyan-fg}Description{/}",
				"Description text",
			],
		});

		const result = BlessedDisplayAdapter.generateDetailContentWithJira(task, "", coreGenerator);

		// Find the Jira Integration section
		const jiraIndex = result.bodyContent.findIndex((line) => line.includes("Jira Integration"));
		const descriptionIndex = result.bodyContent.findIndex((line) => line.includes("Description"));

		// Jira section should come after Details but before Description
		expect(jiraIndex).toBeGreaterThan(0);
		expect(jiraIndex).toBeLessThan(descriptionIndex);
	});

	it("should use correct colors for sync states", () => {
		const createTaskWithState = (state: string): TaskWithJira => ({
			id: "task-1",
			title: "Test",
			status: "To Do",
			assignee: [],
			labels: [],
			dependencies: [],
			rawContent: "",
			jiraKey: "PROJ-1",
			jiraSyncState: state as any,
		});

		const coreGenerator = (_t: Task, _r: string) => ({
			headerContent: [],
			bodyContent: ["{bold}{cyan-fg}Details{/}"],
		});

		const inSyncResult = BlessedDisplayAdapter.generateDetailContentWithJira(
			createTaskWithState("InSync"),
			"",
			coreGenerator,
		);
		expect(inSyncResult.bodyContent.some((line) => line.includes("{green-fg}"))).toBe(true);

		const needsPushResult = BlessedDisplayAdapter.generateDetailContentWithJira(
			createTaskWithState("NeedsPush"),
			"",
			coreGenerator,
		);
		expect(needsPushResult.bodyContent.some((line) => line.includes("{yellow-fg}"))).toBe(true);

		const needsPullResult = BlessedDisplayAdapter.generateDetailContentWithJira(
			createTaskWithState("NeedsPull"),
			"",
			coreGenerator,
		);
		expect(needsPullResult.bodyContent.some((line) => line.includes("{cyan-fg}"))).toBe(true);

		const conflictResult = BlessedDisplayAdapter.generateDetailContentWithJira(
			createTaskWithState("Conflict"),
			"",
			coreGenerator,
		);
		expect(conflictResult.bodyContent.some((line) => line.includes("{red-fg}"))).toBe(true);
	});
});
