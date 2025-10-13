/**
 * Display adapter for backlog-jira plugin
 * 
 * Wraps core display formatters to add Jira-specific metadata without modifying core files.
 * This maintains separation of concerns and allows the core to remain plugin-agnostic.
 */

import type { Task } from "../../../src/types/index.ts";

/**
 * Jira metadata fields that can be added to tasks by the plugin
 */
export interface JiraMetadata {
	jiraKey?: string;
	jiraUrl?: string;
	jiraLastSync?: string;
	jiraSyncState?: "InSync" | "NeedsPush" | "NeedsPull" | "Conflict" | "Unknown";
}

/**
 * Task with optional Jira metadata
 */
export type TaskWithJira = Task & Partial<JiraMetadata>;

/**
 * Format Jira metadata for plain text display
 */
function formatJiraMetadataPlain(task: TaskWithJira): string[] {
	const lines: string[] = [];
	
	if (!task.jiraKey && !task.jiraUrl && !task.jiraLastSync) {
		// No Jira metadata to display
		return lines;
	}

	lines.push("");
	lines.push("Jira Integration:");
	lines.push("-".repeat(50));
	
	if (task.jiraKey) {
		lines.push(`Jira Key: ${task.jiraKey}`);
	}
	
	if (task.jiraUrl) {
		lines.push(`Jira URL: ${task.jiraUrl}`);
	}
	
	if (task.jiraLastSync) {
		lines.push(`Last Sync: ${task.jiraLastSync}`);
	}
	
	if (task.jiraSyncState) {
		const stateIcon = getSyncStateIcon(task.jiraSyncState);
		lines.push(`Sync State: ${stateIcon} ${task.jiraSyncState}`);
	}
	
	return lines;
}

/**
 * Get icon for sync state in plain text
 */
function getSyncStateIcon(state: string): string {
	switch (state) {
		case "InSync":
			return "✅";
		case "NeedsPush":
			return "⬆️";
		case "NeedsPull":
			return "⬇️";
		case "Conflict":
			return "⚠️";
		case "Unknown":
			return "❓";
		default:
			return "  ";
	}
}

/**
 * Format Jira metadata for blessed/terminal UI with tags
 */
function formatJiraMetadataBlessed(task: TaskWithJira): string[] {
	const lines: string[] = [];
	
	if (!task.jiraKey && !task.jiraUrl && !task.jiraLastSync) {
		// No Jira metadata to display
		return lines;
	}

	lines.push("");
	lines.push("{bold}{cyan-fg}Jira Integration{/}");
	
	if (task.jiraKey) {
		lines.push(`{bold}Jira Key:{/bold} {blue-fg}${task.jiraKey}{/}`);
	}
	
	if (task.jiraUrl) {
		lines.push(`{bold}Jira URL:{/bold} {blue-fg}${task.jiraUrl}{/}`);
	}
	
	if (task.jiraLastSync) {
		lines.push(`{bold}Last Sync:{/bold} ${task.jiraLastSync}`);
	}
	
	if (task.jiraSyncState) {
		const stateIcon = getSyncStateIcon(task.jiraSyncState);
		const stateColor = getSyncStateColor(task.jiraSyncState);
		lines.push(`{bold}Sync State:{/bold} {${stateColor}-fg}${stateIcon} ${task.jiraSyncState}{/}`);
	}
	
	return lines;
}

/**
 * Get color for sync state in blessed UI
 */
function getSyncStateColor(state: string): string {
	switch (state) {
		case "InSync":
			return "green";
		case "NeedsPush":
			return "yellow";
		case "NeedsPull":
			return "cyan";
		case "Conflict":
			return "red";
		case "Unknown":
			return "gray";
		default:
			return "white";
	}
}

/**
 * Plain text display adapter
 * 
 * Wraps core formatTaskPlainText to add Jira metadata section
 */
export class PlainTextDisplayAdapter {
	/**
	 * Format task with Jira metadata for plain text output
	 * 
	 * @param task Task to format (may include Jira metadata)
	 * @param content Task markdown content
	 * @param filePath Optional file path
	 * @param coreFormatter Core formatter function from backlog.md
	 * @returns Formatted plain text with Jira metadata
	 */
	static formatTaskWithJira(
		task: TaskWithJira,
		content: string,
		filePath: string | undefined,
		coreFormatter: (task: Task, content: string, filePath?: string) => string,
	): string {
		// Get core formatted output
		const coreOutput = coreFormatter(task, content, filePath);
		
		// Add Jira metadata section
		const jiraMetadata = formatJiraMetadataPlain(task);
		
		if (jiraMetadata.length === 0) {
			return coreOutput;
		}
		
		return coreOutput + "\n" + jiraMetadata.join("\n");
	}
}

/**
 * Blessed UI display adapter
 * 
 * Extends core generateDetailContent for terminal UI to show Jira fields
 */
export class BlessedDisplayAdapter {
	/**
	 * Generate detail content with Jira metadata for blessed UI
	 * 
	 * @param task Task to format (may include Jira metadata)
	 * @param rawContent Raw markdown content
	 * @param coreGenerator Core detail content generator from backlog.md
	 * @returns Detail content with Jira metadata
	 */
	static generateDetailContentWithJira(
		task: TaskWithJira,
		rawContent: string,
		coreGenerator: (task: Task, rawContent: string) => { headerContent: string[]; bodyContent: string[] },
	): { headerContent: string[]; bodyContent: string[] } {
		// Get core generated content
		const coreContent = coreGenerator(task, rawContent);
		
		// Add Jira metadata to body content (after metadata section)
		const jiraMetadata = formatJiraMetadataBlessed(task);
		
		if (jiraMetadata.length > 0) {
			// Insert Jira metadata after the core metadata section
			// Find the position after the Details section
			const detailsIndex = coreContent.bodyContent.findIndex((line) => 
				line.includes("Details")
			);
			
			if (detailsIndex >= 0) {
				// Find next section (usually Description)
				let insertIndex = detailsIndex + 1;
				while (
					insertIndex < coreContent.bodyContent.length &&
					!coreContent.bodyContent[insertIndex].includes("{bold}{cyan-fg}") &&
					!coreContent.bodyContent[insertIndex].startsWith("##")
				) {
					insertIndex++;
				}
				
				// Insert Jira metadata before next section
				coreContent.bodyContent.splice(insertIndex, 0, ...jiraMetadata);
			} else {
				// If Details section not found, append to end
				coreContent.bodyContent.push(...jiraMetadata);
			}
		}
		
		return coreContent;
	}
}
