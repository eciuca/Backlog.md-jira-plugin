import { logger } from "./logger.ts";

/**
 * Valid Backlog.md priority values
 */
export type BacklogPriority = "high" | "medium" | "low";

/**
 * Map Jira priority to Backlog.md priority
 * Jira priorities: Highest, High, Medium, Low, Lowest, Critical, Blocker, Major, Minor, Trivial
 * Backlog priorities: high, medium, low
 */
export function mapJiraPriorityToBacklog(
	jiraPriority: string | undefined,
): BacklogPriority | undefined {
	if (!jiraPriority) {
		return undefined;
	}

	const normalized = jiraPriority.toLowerCase().trim();

	// Map Jira priority names to Backlog priority values
	const priorityMap: Record<string, BacklogPriority> = {
		// Standard Jira priorities
		highest: "high",
		high: "high",
		medium: "medium",
		low: "low",
		lowest: "low",
		// Alternate priority names
		critical: "high",
		blocker: "high",
		major: "medium",
		minor: "low",
		trivial: "low",
	};

	const mapped = priorityMap[normalized];

	if (!mapped) {
		logger.warn(
			{ jiraPriority },
			`Unknown Jira priority "${jiraPriority}", defaulting to medium`,
		);
		return "medium";
	}

	logger.debug(
		{ jiraPriority, backlogPriority: mapped },
		"Mapped Jira priority to Backlog",
	);

	return mapped;
}

/**
 * Map Backlog.md priority to Jira priority
 * Uses standard Jira priority names: High, Medium, Low
 */
export function mapBacklogPriorityToJira(
	backlogPriority: string | undefined,
): string | undefined {
	if (!backlogPriority) {
		return undefined;
	}

	const normalized = backlogPriority.toLowerCase().trim();

	// Map Backlog priority to standard Jira priority names
	const priorityMap: Record<string, string> = {
		high: "High",
		medium: "Medium",
		low: "Low",
	};

	const mapped = priorityMap[normalized];

	if (!mapped) {
		logger.warn(
			{ backlogPriority },
			`Unknown Backlog priority "${backlogPriority}", defaulting to Medium`,
		);
		return "Medium";
	}

	logger.debug(
		{ backlogPriority, jiraPriority: mapped },
		"Mapped Backlog priority to Jira",
	);

	return mapped;
}
