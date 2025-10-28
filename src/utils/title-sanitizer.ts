import { logger } from "./logger.ts";

/**
 * Characters that cause issues in YAML frontmatter:
 * - [ ] : Brackets can break YAML parsing
 * - : : Colons without quotes can be interpreted as key-value separators
 * - ' " : Quotes need careful escaping
 * - > | : YAML block scalar indicators
 * - # : Comments in YAML
 * - & * : YAML anchors and aliases
 * - { } : Flow mapping delimiters
 * - \n \r : Newlines break single-line YAML values
 * - @ ` : Special characters that may cause issues
 */

const YAML_UNSAFE_CHARS = /[\[\]:"#&*{}@`\n\r>|']/;

/**
 * Sanitize a task title to be YAML-safe
 * Removes or replaces characters that break YAML frontmatter parsing
 * 
 * @param title - The original title from Jira
 * @returns A sanitized title safe for YAML frontmatter
 */
export function sanitizeTitle(title: string): string {
	if (!title) {
		return title;
	}

	const original = title;
	
	// Replace problematic characters with safe equivalents
	let sanitized = title
		// Remove or replace brackets
		.replace(/\[/g, "(")
		.replace(/\]/g, ")")
		// Remove or escape quotes
		.replace(/['"]/g, "")
		// Replace colons with hyphens (commonly used in titles like "Feature: Implementation")
		.replace(/:/g, " -")
		// Remove YAML special characters
		.replace(/[#&*{}@`>|]/g, "")
		// Replace newlines and carriage returns with spaces
		.replace(/[\n\r]+/g, " ")
		// Clean up multiple spaces
		.replace(/\s+/g, " ")
		// Trim whitespace
		.trim();

	// Log if sanitization modified the title
	if (sanitized !== original) {
		logger.debug(
			{ original, sanitized },
			"Sanitized title for YAML compatibility"
		);
	}

	return sanitized;
}

/**
 * Check if a title contains YAML-unsafe characters
 * Useful for validation and testing
 * 
 * @param title - The title to check
 * @returns true if the title contains unsafe characters
 */
export function hasUnsafeCharacters(title: string): boolean {
	return YAML_UNSAFE_CHARS.test(title);
}
