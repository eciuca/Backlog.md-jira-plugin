import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { logger } from "./logger.ts";

/**
 * Marker types for wrapping agent instruction content
 */
export interface Markers {
	start: string;
	end: string;
}

/**
 * Mode for agent instructions: CLI (embedded content) or MCP (reference to MCP resources)
 */
export type InstructionMode = "cli" | "mcp";

/**
 * Get HTML comment markers for wrapping content based on file type
 */
export function getMarkers(filePath: string): Markers {
	const fileName = filePath.toLowerCase();

	// For markdown files, use HTML comments
	if (fileName.endsWith(".md")) {
		return {
			start: "<!-- BACKLOG-JIRA GUIDELINES START -->",
			end: "<!-- BACKLOG-JIRA GUIDELINES END -->",
		};
	}

	// Default to HTML comments (works in most documentation formats)
	return {
		start: "<!-- BACKLOG-JIRA GUIDELINES START -->",
		end: "<!-- BACKLOG-JIRA GUIDELINES END -->",
	};
}

/**
 * Check if a file already has backlog-jira guidelines
 */
export function hasBacklogJiraGuidelines(content: string): boolean {
	const markers = getMarkers("dummy.md"); // File type doesn't matter for detection
	return content.includes(markers.start) && content.includes(markers.end);
}

/**
 * Wrap content with markers
 */
export function wrapWithMarkers(content: string, filePath: string): string {
	const markers = getMarkers(filePath);
	return `${markers.start}\n${content}\n${markers.end}`;
}

/**
 * Strip existing guideline section from content
 */
export function stripGuidelineSection(
	content: string,
	filePath: string,
): string {
	const markers = getMarkers(filePath);
	const startIndex = content.indexOf(markers.start);
	const endIndex = content.indexOf(markers.end);

	if (startIndex === -1 || endIndex === -1) {
		return content;
	}

	// Remove the section including the markers and surrounding newlines
	const before = content.substring(0, startIndex).trimEnd();
	const after = content.substring(endIndex + markers.end.length).trimStart();

	return `${before}\n\n${after}`;
}

/**
 * Get CLI mode content - comprehensive plugin guidelines
 */
export function getCliModeContent(): string {
	return `# Backlog-Jira Plugin Guidelines

## Overview

The \`backlog-jira\` plugin provides bidirectional synchronization between Backlog.md tasks and Jira issues.
It allows you to work locally with Backlog.md's task management while staying synchronized with your team's Jira project.

## Core Commands

### Initialization
\`\`\`bash
backlog-jira init           # Initialize plugin configuration
backlog-jira connect        # Verify Jira connection
backlog-jira doctor         # Check environment setup
\`\`\`

### Synchronization
\`\`\`bash
backlog-jira pull           # Pull updates from Jira to Backlog.md
backlog-jira push           # Push Backlog.md changes to Jira
backlog-jira sync           # Bidirectional sync (pull + push)
backlog-jira watch          # Continuous sync mode
\`\`\`

### Status & Configuration
\`\`\`bash
backlog-jira status         # View sync status
backlog-jira map            # Configure status mappings
backlog-jira configure      # Update configuration
backlog-jira view <task-id> # View task sync details
\`\`\`

## Configuration

The plugin stores configuration in \`.backlog-jira/config.json\`:

\`\`\`json
{
  "jira": {
    "baseUrl": "https://your-domain.atlassian.net",
    "projectKey": "PROJ",
    "issueType": "Task",
    "jqlFilter": ""
  },
  "backlog": {
    "statusMapping": {
      "To Do": ["To Do", "Open", "Backlog"],
      "In Progress": ["In Progress"],
      "Done": ["Done", "Closed", "Resolved"]
    }
  },
  "sync": {
    "conflictStrategy": "prompt",
    "enableAnnotations": false,
    "watchInterval": 60
  }
}
\`\`\`

## Authentication

Set your Jira credentials via environment variables:

\`\`\`bash
export JIRA_USER_EMAIL="your-email@example.com"
export JIRA_API_TOKEN="your-api-token"
\`\`\`

Generate an API token at: https://id.atlassian.com/manage-profile/security/api-tokens

## Workflow Integration

### Starting Work on a Task

1. **Pull latest from Jira**:
   \`\`\`bash
   backlog-jira pull
   \`\`\`

2. **Start your task using Backlog.md**:
   \`\`\`bash
   backlog task edit <id> -s "In Progress" -a @yourself
   \`\`\`

3. **Push status to Jira**:
   \`\`\`bash
   backlog-jira push
   \`\`\`

### Completing a Task

1. **Update locally**:
   \`\`\`bash
   backlog task edit <id> -s "Done"
   \`\`\`

2. **Sync with Jira**:
   \`\`\`bash
   backlog-jira push
   \`\`\`

### Continuous Sync

For active development, use watch mode:

\`\`\`bash
backlog-jira watch
\`\`\`

This will automatically sync changes every 60 seconds (configurable).

## Conflict Resolution

When conflicts occur (both sides modified), the plugin will:

- **prompt mode** (default): Ask you to choose which version to keep
- **prefer-backlog**: Always use Backlog.md version
- **prefer-jira**: Always use Jira version

Configure via:
\`\`\`bash
backlog-jira configure --conflict-strategy <strategy>
\`\`\`

## Status Mapping

The plugin maps Backlog.md task statuses to Jira issue statuses. Configure mappings with:

\`\`\`bash
backlog-jira map
\`\`\`

## Acceptance Criteria Sync

The plugin can sync acceptance criteria between Backlog.md and Jira:

- Backlog.md uses \`- [ ] #N criterion\` format
- Jira uses subtasks or checklist custom field (if available)
- Enable with: \`backlog-jira configure --enable-annotations\`

## Best Practices

1. **Always pull before pushing**: Avoid conflicts by staying up-to-date
2. **Use watch mode during active work**: Automatic sync reduces manual steps
3. **Configure status mappings**: Match your team's Jira workflow
4. **Handle conflicts promptly**: Don't let conflicting states linger
5. **Use \`backlog-jira status\`**: Check sync state before critical operations

## Troubleshooting

### Connection Issues
\`\`\`bash
backlog-jira connect  # Test connection
backlog-jira doctor   # Check environment
\`\`\`

### Sync Issues
\`\`\`bash
backlog-jira status           # View current state
backlog-jira view <task-id>   # Check specific task
\`\`\`

### Reset Configuration
\`\`\`bash
rm -rf .backlog-jira
backlog-jira init
\`\`\`

## Database

The plugin maintains a local SQLite database at \`.backlog-jira/jira-sync.db\` to track:
- Sync state for each task
- Conflict detection via content hashing
- Last sync timestamps

This database is automatically managed and should not be modified manually.`;
}

/**
 * Get MCP mode content - nudge to read MCP resources
 */
export function getMcpModeContent(): string {
	return `# Backlog-Jira Plugin Integration

## MCP Server Integration

This project uses the \`backlog-jira\` MCP server for bidirectional synchronization with Jira.

**For comprehensive documentation about the backlog-jira plugin, please read the MCP resources:**

- Check available MCP resources for detailed plugin documentation
- Resources include: configuration guides, command reference, workflow patterns, and troubleshooting
- Use MCP tools to interact with Jira: search issues, update tasks, configure mappings

## Quick Reference

### Core Commands
- \`backlog-jira init\` - Initialize configuration
- \`backlog-jira pull\` - Pull from Jira
- \`backlog-jira push\` - Push to Jira
- \`backlog-jira sync\` - Bidirectional sync
- \`backlog-jira watch\` - Continuous sync mode

### Environment Setup
\`\`\`bash
export JIRA_USER_EMAIL="your-email@example.com"
export JIRA_API_TOKEN="your-api-token"
\`\`\`

**For detailed usage, workflows, and troubleshooting, please consult the MCP resources provided by the backlog-jira server.**`;
}

/**
 * Add agent instructions to a file (CLI mode)
 */
export function addAgentInstructions(
	filePath: string,
	mode: InstructionMode = "cli",
): { success: boolean; message: string } {
	try {
		// Check if file exists
		if (!existsSync(filePath)) {
			return {
				success: false,
				message: `File not found: ${filePath}`,
			};
		}

		// Read current content
		const currentContent = readFileSync(filePath, "utf-8");

		// Get appropriate content based on mode
		const guidelinesContent =
			mode === "cli" ? getCliModeContent() : getMcpModeContent();

		// If guidelines already exist, remove them first
		let newContent = currentContent;
		if (hasBacklogJiraGuidelines(currentContent)) {
			newContent = stripGuidelineSection(currentContent, filePath);
		}

		// Add new guidelines at the beginning
		const wrappedContent = wrapWithMarkers(guidelinesContent, filePath);
		newContent = `${wrappedContent}\n\n${newContent.trimStart()}`;

		// Write back
		writeFileSync(filePath, newContent, "utf-8");

		return {
			success: true,
			message: `Successfully added ${mode.toUpperCase()} mode guidelines to ${filePath}`,
		};
	} catch (error) {
		return {
			success: false,
			message: `Error updating file: ${error instanceof Error ? error.message : String(error)}`,
		};
	}
}

/**
 * Ensure MCP guidelines are present in a file
 * This is a convenience wrapper for MCP mode
 */
export function ensureMcpGuidelines(filePath: string): {
	success: boolean;
	message: string;
} {
	return addAgentInstructions(filePath, "mcp");
}

/**
 * Switch mode between CLI and MCP
 */
export function switchInstructionMode(
	filePath: string,
	newMode: InstructionMode,
): { success: boolean; message: string } {
	return addAgentInstructions(filePath, newMode);
}
