import { describe, expect, it } from "bun:test";
import type { BacklogTask as Task } from "../integrations/backlog.ts";
import {
	type TaskWithJira,
	formatTaskWithJira,
	generateDetailContentWithJira,
} from "./display-adapter.ts";

describe("PlainTextDisplayAdapter", () => {
	it("should add Jira metadata section to plain text output", () => {
		const task: TaskWithJira = {
			id: "task-1",
			title: "Test Task",
			status: "In Progress",
			assignee: "@user",
			labels: [],
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

		const result = formatTaskWithJira(task, content, undefined, coreFormatter);

		expect(result).toContain("Task task-1 - Test Task");
		expect(result).toContain("Core output");
		expect(result).toContain("Jira Integration:");
		expect(result).toContain("Jira Key: PROJ-123");
		expect(result).toContain(
			"Jira URL: https://jira.example.com/browse/PROJ-123",
		);
		expect(result).toContain("Last Sync: 2025-01-02T10:00:00Z");
		expect(result).toContain("Sync State: ✅ InSync");
	});

	it("should not add Jira section if no Jira metadata", () => {
		const task: Task = {
			id: "task-1",
			title: "Test Task",
			status: "To Do",
		};

		const content = "# Test\nContent";
		const coreFormatter = (t: Task, _c: string, _f?: string) => {
			return `Task ${t.id} - ${t.title}\nCore output`;
		};

		const result = formatTaskWithJira(task, content, undefined, coreFormatter);

		expect(result).toBe("Task task-1 - Test Task\nCore output");
		expect(result).not.toContain("Jira Integration:");
	});

	it("should show correct sync state icons", () => {
		const createTaskWithState = (
			state: "InSync" | "NeedsPush" | "NeedsPull" | "Conflict" | "Unknown",
		): TaskWithJira => ({
			id: "task-1",
			title: "Test",
			status: "To Do",
			jiraKey: "PROJ-1",
			jiraSyncState: state,
		});

		const coreFormatter = (_t: Task, _c: string, _f?: string) => "Core";

		const inSyncResult = formatTaskWithJira(
			createTaskWithState("InSync"),
			"",
			undefined,
			coreFormatter,
		);
		expect(inSyncResult).toContain("✅ InSync");

		const needsPushResult = formatTaskWithJira(
			createTaskWithState("NeedsPush"),
			"",
			undefined,
			coreFormatter,
		);
		expect(needsPushResult).toContain("⬆️ NeedsPush");

		const needsPullResult = formatTaskWithJira(
			createTaskWithState("NeedsPull"),
			"",
			undefined,
			coreFormatter,
		);
		expect(needsPullResult).toContain("⬇️ NeedsPull");

		const conflictResult = formatTaskWithJira(
			createTaskWithState("Conflict"),
			"",
			undefined,
			coreFormatter,
		);
		expect(conflictResult).toContain("⚠️ Conflict");

		const unknownResult = formatTaskWithJira(
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
			assignee: "@user",
			labels: [],
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

		const result = generateDetailContentWithJira(task, "", coreGenerator);

		expect(result.headerContent).toEqual(["Header"]);
		expect(result.bodyContent).toContain("{bold}{cyan-fg}Jira Integration{/}");
		expect(result.bodyContent.some((line) => line.includes("Jira Key"))).toBe(
			true,
		);
		expect(result.bodyContent.some((line) => line.includes("PROJ-123"))).toBe(
			true,
		);
		expect(result.bodyContent.some((line) => line.includes("Sync State"))).toBe(
			true,
		);
	});

	it("should not modify content if no Jira metadata", () => {
		const task: Task = {
			id: "task-1",
			title: "Test Task",
			status: "To Do",
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
		const result = generateDetailContentWithJira(task, "", coreGenerator);

		expect(result.headerContent).toEqual(originalContent.headerContent);
		expect(result.bodyContent).toEqual(originalContent.bodyContent);
		expect(
			result.bodyContent.some((line) => line.includes("Jira Integration")),
		).toBe(false);
	});

	it("should insert Jira metadata after Details section", () => {
		const task: TaskWithJira = {
			id: "task-1",
			title: "Test Task",
			status: "To Do",
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

		const result = generateDetailContentWithJira(task, "", coreGenerator);

		// Find the Jira Integration section
		const jiraIndex = result.bodyContent.findIndex((line) =>
			line.includes("Jira Integration"),
		);
		const descriptionIndex = result.bodyContent.findIndex((line) =>
			line.includes("Description"),
		);

		// Jira section should come after Details but before Description
		expect(jiraIndex).toBeGreaterThan(0);
		expect(jiraIndex).toBeLessThan(descriptionIndex);
	});

	it("should use correct colors for sync states", () => {
		const createTaskWithState = (
			state: "InSync" | "NeedsPush" | "NeedsPull" | "Conflict" | "Unknown",
		): TaskWithJira => ({
			id: "task-1",
			title: "Test",
			status: "To Do",
			jiraKey: "PROJ-1",
			jiraSyncState: state,
		});

		const coreGenerator = (_t: Task, _r: string) => ({
			headerContent: [],
			bodyContent: ["{bold}{cyan-fg}Details{/}"],
		});

		const inSyncResult = generateDetailContentWithJira(
			createTaskWithState("InSync"),
			"",
			coreGenerator,
		);
		expect(
			inSyncResult.bodyContent.some((line) => line.includes("{green-fg}")),
		).toBe(true);

		const needsPushResult = generateDetailContentWithJira(
			createTaskWithState("NeedsPush"),
			"",
			coreGenerator,
		);
		expect(
			needsPushResult.bodyContent.some((line) => line.includes("{yellow-fg}")),
		).toBe(true);

		const needsPullResult = generateDetailContentWithJira(
			createTaskWithState("NeedsPull"),
			"",
			coreGenerator,
		);
		expect(
			needsPullResult.bodyContent.some((line) => line.includes("{cyan-fg}")),
		).toBe(true);

		const conflictResult = generateDetailContentWithJira(
			createTaskWithState("Conflict"),
			"",
			coreGenerator,
		);
		expect(
			conflictResult.bodyContent.some((line) => line.includes("{red-fg}")),
		).toBe(true);
	});
});
