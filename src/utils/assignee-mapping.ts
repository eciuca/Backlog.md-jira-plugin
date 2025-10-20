import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { logger } from "./logger.ts";

export interface AssigneeMappingConfig {
	// Maps Backlog assignee identifiers (@username) to Jira user identifiers
	backlogToJira: Record<string, string>;

	// Maps Jira user identifiers back to Backlog assignee format
	jiraToBacklog: Record<string, string>;

	// Automatic name-based mappings (for transparency)
	autoMapped?: Record<string, string>;
}

/**
 * Load assignee mapping configuration from .backlog-jira/config.json
 */
export function loadAssigneeMapping(): AssigneeMappingConfig {
	try {
		const configPath = join(process.cwd(), ".backlog-jira", "config.json");
		const content = readFileSync(configPath, "utf-8");
		const config = JSON.parse(content);

		// Extract assignee mapping from config
		const backlogToJira = config.backlog?.assigneeMapping || {};
		const autoMapped = config.backlog?.autoMappedAssignees || {};

		// Build reverse mapping (Jira → Backlog)
		const jiraToBacklog: Record<string, string> = {};
		
		// Add explicit mappings
		for (const [backlogUser, jiraUser] of Object.entries(backlogToJira)) {
			if (typeof jiraUser === "string") {
				jiraToBacklog[jiraUser.toLowerCase()] = backlogUser;
			}
		}
		
		// Add auto-mapped entries to reverse mapping too
		for (const [backlogUser, jiraUser] of Object.entries(autoMapped)) {
			if (typeof jiraUser === "string") {
				// Auto-mapped entries should not override explicit mappings
				const jiraLower = jiraUser.toLowerCase();
				if (!jiraToBacklog[jiraLower]) {
					jiraToBacklog[jiraLower] = backlogUser;
				}
			}
		}

		return {
			backlogToJira,
			jiraToBacklog,
			autoMapped: autoMapped as Record<string, string>,
		};
	} catch (error) {
		logger.warn(
			{ error },
			"Failed to load assignee mapping config, using empty mappings",
		);
		return {
			backlogToJira: {},
			jiraToBacklog: {},
			autoMapped: {},
		};
	}
}

/**
 * Map a Backlog assignee to a Jira user identifier
 * 
 * @param backlogAssignee - Backlog assignee in format @username
 * @returns Jira user identifier or null if no mapping exists
 */
export function mapBacklogAssigneeToJira(
	backlogAssignee: string,
): string | null {
	const mapping = loadAssigneeMapping();
	
	// Remove @ prefix if present
	const cleanAssignee = backlogAssignee.startsWith("@")
		? backlogAssignee.substring(1)
		: backlogAssignee;

	// Check explicit mapping first
	const explicitMapping = mapping.backlogToJira[cleanAssignee];
	if (explicitMapping) {
		return explicitMapping;
	}

	// Check auto-mapped entries
	const autoMapping = mapping.autoMapped?.[cleanAssignee];
	if (autoMapping) {
		return autoMapping;
	}

	return null;
}

/**
 * Map a Jira user identifier to a Backlog assignee format
 * 
 * @param jiraUser - Jira user identifier (email, accountId, or display name)
 * @returns Backlog assignee in @username format or null if no mapping exists
 */
export function mapJiraUserToBacklog(jiraUser: string): string | null {
	const mapping = loadAssigneeMapping();
	
	// Try case-insensitive lookup
	const jiraLower = jiraUser.toLowerCase();
	const backlogUser = mapping.jiraToBacklog[jiraLower];
	
	if (backlogUser) {
		// Ensure @ prefix
		return backlogUser.startsWith("@") ? backlogUser : `@${backlogUser}`;
	}

	return null;
}

/**
 * Get a human-readable description of assignee mappings
 */
export function getAssigneeMappingDescription(): string {
	const mapping = loadAssigneeMapping();

	const lines: string[] = [
		"Assignee Mapping Configuration:",
		"",
		"Explicit Mappings (Backlog → Jira):",
	];

	const explicitCount = Object.keys(mapping.backlogToJira).length;
	if (explicitCount === 0) {
		lines.push("  (none configured)");
	} else {
		for (const [backlogUser, jiraUser] of Object.entries(mapping.backlogToJira)) {
			lines.push(`  @${backlogUser} → ${jiraUser}`);
		}
	}

	lines.push("");
	lines.push("Automatic Mappings (discovered from sync):");
	
	const autoCount = Object.keys(mapping.autoMapped || {}).length;
	if (autoCount === 0) {
		lines.push("  (none discovered yet)");
	} else {
		for (const [backlogUser, jiraUser] of Object.entries(mapping.autoMapped || {})) {
			lines.push(`  @${backlogUser} → ${jiraUser}`);
		}
	}

	return lines.join("\n");
}

/**
 * Calculate string similarity using Levenshtein distance
 * Returns a score from 0 (completely different) to 1 (identical)
 */
function calculateSimilarity(str1: string, str2: string): number {
	const s1 = str1.toLowerCase();
	const s2 = str2.toLowerCase();
	
	const len1 = s1.length;
	const len2 = s2.length;
	
	// Create matrix
	const matrix: number[][] = [];
	for (let i = 0; i <= len1; i++) {
		matrix[i] = [i];
	}
	for (let j = 0; j <= len2; j++) {
		matrix[0][j] = j;
	}
	
	// Calculate Levenshtein distance
	for (let i = 1; i <= len1; i++) {
		for (let j = 1; j <= len2; j++) {
			const cost = s1[i - 1] === s2[j - 1] ? 0 : 1;
			matrix[i][j] = Math.min(
				matrix[i - 1][j] + 1,      // deletion
				matrix[i][j - 1] + 1,      // insertion
				matrix[i - 1][j - 1] + cost // substitution
			);
		}
	}
	
	const distance = matrix[len1][len2];
	const maxLen = Math.max(len1, len2);
	
	// Convert distance to similarity score (0-1)
	return maxLen === 0 ? 1 : 1 - (distance / maxLen);
}

/**
 * Attempt to find a matching Backlog assignee for a Jira user based on name similarity
 * 
 * @param jiraDisplayName - Jira user's display name (e.g., "John Doe")
 * @param backlogAssignees - List of available Backlog assignees (e.g., ["@john", "@jane"])
 * @param minSimilarity - Minimum similarity threshold (default: 0.6)
 * @returns Best matching Backlog assignee or null if no good match found
 */
export function findBestAssigneeMatch(
	jiraDisplayName: string,
	backlogAssignees: string[],
	minSimilarity = 0.6,
): { assignee: string; score: number } | null {
	if (!jiraDisplayName || backlogAssignees.length === 0) {
		return null;
	}
	
	let bestMatch: { assignee: string; score: number } | null = null;
	
	for (const backlogAssignee of backlogAssignees) {
		// Remove @ prefix for comparison
		const cleanAssignee = backlogAssignee.startsWith("@")
			? backlogAssignee.substring(1)
			: backlogAssignee;
		
		// Calculate similarity
		const score = calculateSimilarity(jiraDisplayName, cleanAssignee);
		
		if (score >= minSimilarity && (!bestMatch || score > bestMatch.score)) {
			bestMatch = { assignee: backlogAssignee, score };
		}
	}
	
	return bestMatch;
}

/**
 * Save an auto-discovered assignee mapping to config.json
 * Updates the autoMappedAssignees section without overwriting explicit mappings
 * 
 * @param backlogAssignee - Backlog assignee identifier (e.g., "@john")
 * @param jiraUser - Jira user identifier (displayName, email, or accountId)
 */
export function saveAutoDiscoveredMapping(
	backlogAssignee: string,
	jiraUser: string,
): void {
	try {
		const configPath = join(process.cwd(), ".backlog-jira", "config.json");
		const content = readFileSync(configPath, "utf-8");
		const config = JSON.parse(content);
		
		// Ensure backlog section exists
		if (!config.backlog) {
			config.backlog = {};
		}
		
		// Ensure autoMappedAssignees exists
		if (!config.backlog.autoMappedAssignees) {
			config.backlog.autoMappedAssignees = {};
		}
		
		// Remove @ prefix for storage (consistent with explicit mappings)
		const cleanBacklogAssignee = backlogAssignee.startsWith("@")
			? backlogAssignee.substring(1)
			: backlogAssignee;
		
		// Only save if not already explicitly mapped
		const hasExplicitMapping = config.backlog.assigneeMapping?.[cleanBacklogAssignee];
		if (hasExplicitMapping) {
			logger.debug(
				{ backlogAssignee: cleanBacklogAssignee, jiraUser },
				"Skipping auto-mapping - explicit mapping already exists",
			);
			return;
		}
		
		// Save the auto-discovered mapping
		config.backlog.autoMappedAssignees[cleanBacklogAssignee] = jiraUser;
		
		// Write back to config file with pretty formatting
		writeFileSync(configPath, JSON.stringify(config, null, 2), "utf-8");
		
		logger.info(
			{ backlogAssignee: cleanBacklogAssignee, jiraUser },
			"Auto-discovered assignee mapping saved to config.json",
		);
	} catch (error) {
		logger.error(
			{ error, backlogAssignee, jiraUser },
			"Failed to save auto-discovered mapping",
		);
	}
}

/**
 * Auto-discover and save assignee mapping if a good match is found
 * 
 * @param jiraDisplayName - Jira user's display name
 * @param backlogAssignees - List of available Backlog assignees
 * @returns The matched Backlog assignee or null if no match found
 */
export function autoDiscoverAndSaveMapping(
	jiraDisplayName: string,
	backlogAssignees: string[],
): string | null {
	const match = findBestAssigneeMatch(jiraDisplayName, backlogAssignees);
	
	if (match) {
		logger.info(
			{ 
				jiraDisplayName,
				backlogAssignee: match.assignee,
				similarityScore: match.score.toFixed(2),
			},
			"Auto-discovered assignee mapping based on name similarity",
		);
		
		// Save the mapping
		saveAutoDiscoveredMapping(match.assignee, jiraDisplayName);
		
		return match.assignee;
	}
	
	return null;
}
