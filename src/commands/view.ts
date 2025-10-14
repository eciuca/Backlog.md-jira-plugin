import type { Command } from "commander";
import { BacklogClient } from "../integrations/backlog.ts";
import { SyncStore } from "../state/store.ts";
import { formatTaskWithJira } from "../ui/display-adapter.ts";
import { logger } from "../utils/logger.ts";

// Import core formatter from backlog.md
// In the real implementation, this would need to be properly imported from core
// For now, we'll use a placeholder that would be replaced with the actual import
import type { BacklogTask as Task } from "../integrations/backlog.ts";
type CoreFormatter = (task: Task, content: string, filePath?: string) => string;

interface TaskWithJira extends Task {
	jiraKey?: string;
	jiraUrl?: string;
	jiraLastSync?: string;
	jiraSyncState?: string;
}

/**
 * View a task with Jira metadata
 */
async function viewTask(
	taskId: string,
	options: { plain?: boolean },
): Promise<void> {
	const store = new SyncStore();
	const backlog = new BacklogClient();

	try {
		// Get task from backlog
		const task = await backlog.getTask(taskId);
		// Create content from task fields for formatting
		const content = `# Task Content\n\n${task.description || "No description"}`;

		// Get Jira mapping if exists
		const mapping = store.getMapping(taskId);
		let taskWithJira: TaskWithJira = task;
		if (mapping) {
			const syncState = store.getSyncState(taskId);
			taskWithJira = {
				...task,
				jiraKey: mapping.jiraKey,
				jiraUrl: `https://your-domain.atlassian.net/browse/${mapping.jiraKey}`,
				jiraLastSync: syncState?.lastSyncAt || "Never",
				jiraSyncState: syncState?.conflictState || "Unknown",
			};
		}

		// Get core formatter
		// This would need to be imported from the core package
		// For demonstration purposes, we'll create a simple mock
		const coreFormatter: CoreFormatter = (t, c, f) => {
			// In real implementation, this would be:
			// import { formatTaskPlainText } from 'backlog-md';
			// const formatted = formatTaskPlainText(t, c, f);
			return `[CORE FORMAT PLACEHOLDER]\nTask: ${t.id} - ${t.title}\nStatus: ${t.status}\n\nContent:\n${c}`;
		};

		if (options.plain) {
			// Use adapter to add Jira metadata
			const formatted = formatTaskWithJira(
				taskWithJira,
				content,
				undefined,
				coreFormatter,
			);
			console.log(formatted);
		} else {
			// For blessed UI, would use BlessedDisplayAdapter.generateDetailContentWithJira
			// and pass to viewTaskEnhanced
			console.log("Interactive view not yet implemented. Use --plain flag.");
		}
	} catch (error) {
		logger.error({ error, taskId }, "Failed to view task");
		console.error(`Error viewing task ${taskId}: ${error}`);
		process.exit(1);
	} finally {
		store.close();
	}
}

/**
 * Register view command with CLI
 */
export function registerViewCommand(program: Command): void {
	program
		.command("view <taskId>")
		.description("View task with Jira integration details")
		.option("--plain", "Output plain text format")
		.action(async (taskId, options) => {
			try {
				await viewTask(taskId, options);
				process.exit(0);
			} catch (error) {
				logger.error({ error }, "View command failed");
				console.error(`Error: ${error}`);
				process.exit(1);
			}
		});
}
