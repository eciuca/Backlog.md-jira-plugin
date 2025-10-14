import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
	type InstructionMode,
	addAgentInstructions,
	ensureMcpGuidelines,
	getCliModeContent,
	getMarkers,
	getMcpModeContent,
	hasBacklogJiraGuidelines,
	stripGuidelineSection,
	switchInstructionMode,
	wrapWithMarkers,
} from "./agent-instructions.ts";

const TEST_DIR = join(process.cwd(), ".test-agent-instructions");

describe("agent-instructions", () => {
	beforeEach(() => {
		// Create test directory
		mkdirSync(TEST_DIR, { recursive: true });
	});

	afterEach(() => {
		// Clean up test directory
		rmSync(TEST_DIR, { recursive: true, force: true });
	});

	describe("getMarkers", () => {
		it("should return HTML comment markers for markdown files", () => {
			const markers = getMarkers("test.md");
			expect(markers.start).toBe("<!-- BACKLOG-JIRA GUIDELINES START -->");
			expect(markers.end).toBe("<!-- BACKLOG-JIRA GUIDELINES END -->");
		});

		it("should return HTML comment markers for uppercase .MD extension", () => {
			const markers = getMarkers("TEST.MD");
			expect(markers.start).toBe("<!-- BACKLOG-JIRA GUIDELINES START -->");
			expect(markers.end).toBe("<!-- BACKLOG-JIRA GUIDELINES END -->");
		});

		it("should return HTML comment markers for non-markdown files", () => {
			const markers = getMarkers("test.txt");
			expect(markers.start).toBe("<!-- BACKLOG-JIRA GUIDELINES START -->");
			expect(markers.end).toBe("<!-- BACKLOG-JIRA GUIDELINES END -->");
		});
	});

	describe("hasBacklogJiraGuidelines", () => {
		it("should return true when both markers are present", () => {
			const content = `Some content
<!-- BACKLOG-JIRA GUIDELINES START -->
Guidelines here
<!-- BACKLOG-JIRA GUIDELINES END -->
More content`;
			expect(hasBacklogJiraGuidelines(content)).toBe(true);
		});

		it("should return false when markers are missing", () => {
			const content = "Some content without markers";
			expect(hasBacklogJiraGuidelines(content)).toBe(false);
		});

		it("should return false when only start marker is present", () => {
			const content = `Some content
<!-- BACKLOG-JIRA GUIDELINES START -->
Guidelines here`;
			expect(hasBacklogJiraGuidelines(content)).toBe(false);
		});

		it("should return false when only end marker is present", () => {
			const content = `Guidelines here
<!-- BACKLOG-JIRA GUIDELINES END -->
More content`;
			expect(hasBacklogJiraGuidelines(content)).toBe(false);
		});
	});

	describe("wrapWithMarkers", () => {
		it("should wrap content with appropriate markers", () => {
			const content = "Test guidelines";
			const wrapped = wrapWithMarkers(content, "test.md");

			expect(wrapped).toContain("<!-- BACKLOG-JIRA GUIDELINES START -->");
			expect(wrapped).toContain("Test guidelines");
			expect(wrapped).toContain("<!-- BACKLOG-JIRA GUIDELINES END -->");
		});

		it("should preserve content exactly as provided", () => {
			const content = "Line 1\nLine 2\n\nLine 4";
			const wrapped = wrapWithMarkers(content, "test.md");

			expect(wrapped).toContain("Line 1\nLine 2\n\nLine 4");
		});
	});

	describe("stripGuidelineSection", () => {
		it("should remove guidelines section from content", () => {
			const content = `Header content

<!-- BACKLOG-JIRA GUIDELINES START -->
Guidelines content
Multiple lines
<!-- BACKLOG-JIRA GUIDELINES END -->

Footer content`;

			const stripped = stripGuidelineSection(content, "test.md");

			expect(stripped).not.toContain("Guidelines content");
			expect(stripped).not.toContain("Multiple lines");
			expect(stripped).not.toContain("<!-- BACKLOG-JIRA GUIDELINES START -->");
			expect(stripped).not.toContain("<!-- BACKLOG-JIRA GUIDELINES END -->");
			expect(stripped).toContain("Header content");
			expect(stripped).toContain("Footer content");
		});

		it("should return content unchanged if no markers present", () => {
			const content = "Original content without markers";
			const result = stripGuidelineSection(content, "test.md");

			expect(result).toBe(content);
		});

		it("should handle content with only start marker", () => {
			const content = `Header
<!-- BACKLOG-JIRA GUIDELINES START -->
Guidelines`;

			const result = stripGuidelineSection(content, "test.md");
			expect(result).toBe(content);
		});

		it("should preserve spacing between remaining sections", () => {
			const content = `Header

<!-- BACKLOG-JIRA GUIDELINES START -->
Guidelines
<!-- BACKLOG-JIRA GUIDELINES END -->

Footer`;

			const stripped = stripGuidelineSection(content, "test.md");

			// Should have proper spacing
			expect(stripped).toBe("Header\n\nFooter");
		});
	});

	describe("getCliModeContent", () => {
		it("should return non-empty CLI mode content", () => {
			const content = getCliModeContent();
			expect(content.length).toBeGreaterThan(0);
		});

		it("should contain key sections", () => {
			const content = getCliModeContent();
			expect(content).toContain("# Backlog-Jira Plugin Guidelines");
			expect(content).toContain("## Core Commands");
			expect(content).toContain("## Configuration");
			expect(content).toContain("## Authentication");
			expect(content).toContain("## Workflow Integration");
		});

		it("should contain backlog-jira commands", () => {
			const content = getCliModeContent();
			expect(content).toContain("backlog-jira init");
			expect(content).toContain("backlog-jira pull");
			expect(content).toContain("backlog-jira push");
			expect(content).toContain("backlog-jira sync");
		});
	});

	describe("getMcpModeContent", () => {
		it("should return non-empty MCP mode content", () => {
			const content = getMcpModeContent();
			expect(content.length).toBeGreaterThan(0);
		});

		it("should contain MCP-specific guidance", () => {
			const content = getMcpModeContent();
			expect(content).toContain("MCP");
			expect(content).toContain("resources");
		});

		it("should be significantly shorter than CLI mode", () => {
			const cliContent = getCliModeContent();
			const mcpContent = getMcpModeContent();
			expect(mcpContent.length).toBeLessThan(cliContent.length / 2);
		});
	});

	describe("addAgentInstructions", () => {
		it("should add CLI guidelines to a new file", () => {
			const testFile = join(TEST_DIR, "AGENTS.md");
			writeFileSync(testFile, "# Original Content\n\nSome text here.");

			const result = addAgentInstructions(testFile, "cli");

			expect(result.success).toBe(true);
			const content = readFileSync(testFile, "utf-8");
			expect(hasBacklogJiraGuidelines(content)).toBe(true);
			expect(content).toContain("Original Content");
		});

		it("should add MCP guidelines to a new file", () => {
			const testFile = join(TEST_DIR, "CLAUDE.md");
			writeFileSync(testFile, "# Original Content");

			const result = addAgentInstructions(testFile, "mcp");

			expect(result.success).toBe(true);
			const content = readFileSync(testFile, "utf-8");
			expect(hasBacklogJiraGuidelines(content)).toBe(true);
			expect(content).toContain("MCP");
		});

		it("should be idempotent - multiple runs don't duplicate content", () => {
			const testFile = join(TEST_DIR, "AGENTS.md");
			writeFileSync(testFile, "# Original");

			// First run
			addAgentInstructions(testFile, "cli");
			const firstContent = readFileSync(testFile, "utf-8");
			const firstLength = firstContent.length;

			// Second run
			addAgentInstructions(testFile, "cli");
			const secondContent = readFileSync(testFile, "utf-8");
			const secondLength = secondContent.length;

			// Third run
			addAgentInstructions(testFile, "cli");
			const thirdContent = readFileSync(testFile, "utf-8");
			const thirdLength = thirdContent.length;

			// Length should stabilize after first addition
			expect(secondLength).toBe(firstLength);
			expect(thirdLength).toBe(firstLength);

			// Should only have one set of markers
			const markerCount = (
				secondContent.match(/<!-- BACKLOG-JIRA GUIDELINES START -->/g) || []
			).length;
			expect(markerCount).toBe(1);
		});

		it("should preserve user content outside markers", () => {
			const testFile = join(TEST_DIR, "AGENTS.md");
			const originalContent = `# My Project
			
My custom instructions here.

## Another Section

More custom content.`;

			writeFileSync(testFile, originalContent);

			addAgentInstructions(testFile, "cli");
			const content = readFileSync(testFile, "utf-8");

			expect(content).toContain("My custom instructions here");
			expect(content).toContain("More custom content");
		});

		it("should return error for non-existent file", () => {
			const testFile = join(TEST_DIR, "nonexistent.md");
			const result = addAgentInstructions(testFile, "cli");

			expect(result.success).toBe(false);
			expect(result.message).toContain("File not found");
		});
	});

	describe("mode switching", () => {
		it("should allow switching from CLI to MCP mode", () => {
			const testFile = join(TEST_DIR, "AGENTS.md");
			writeFileSync(testFile, "# Original");

			// Add CLI mode
			addAgentInstructions(testFile, "cli");
			let content = readFileSync(testFile, "utf-8");
			expect(content).toContain("Backlog-Jira Plugin Guidelines");
			expect(content).toContain("## Configuration");

			// Switch to MCP mode
			switchInstructionMode(testFile, "mcp");
			content = readFileSync(testFile, "utf-8");
			expect(content).toContain("MCP");
			expect(content).not.toContain("## Configuration"); // CLI-specific section
			expect(content).toContain("Original"); // Preserved content
		});

		it("should allow switching from MCP to CLI mode", () => {
			const testFile = join(TEST_DIR, "CLAUDE.md");
			writeFileSync(testFile, "# Original");

			// Add MCP mode
			addAgentInstructions(testFile, "mcp");
			let content = readFileSync(testFile, "utf-8");
			const initialMcpLength = content.length;

			// Switch to CLI mode
			switchInstructionMode(testFile, "cli");
			content = readFileSync(testFile, "utf-8");
			expect(content).toContain("## Configuration");
			expect(content.length).toBeGreaterThan(initialMcpLength);
			expect(content).toContain("Original");
		});
	});

	describe("ensureMcpGuidelines", () => {
		it("should be a convenience wrapper for MCP mode", () => {
			const testFile = join(TEST_DIR, "CLAUDE.md");
			writeFileSync(testFile, "# Original");

			const result = ensureMcpGuidelines(testFile);

			expect(result.success).toBe(true);
			const content = readFileSync(testFile, "utf-8");
			expect(content).toContain("MCP");
		});
	});

	describe("complex scenarios", () => {
		it("should handle multiple mode switches without data loss", () => {
			const testFile = join(TEST_DIR, "AGENTS.md");
			const userContent = `# My Project

## Custom Section 1

User content here.

## Custom Section 2

More user content.`;

			writeFileSync(testFile, userContent);

			// CLI -> MCP -> CLI -> MCP
			addAgentInstructions(testFile, "cli");
			switchInstructionMode(testFile, "mcp");
			switchInstructionMode(testFile, "cli");
			switchInstructionMode(testFile, "mcp");

			const finalContent = readFileSync(testFile, "utf-8");

			// User content should still be there
			expect(finalContent).toContain("Custom Section 1");
			expect(finalContent).toContain("Custom Section 2");
			expect(finalContent).toContain("User content here");
			expect(finalContent).toContain("More user content");

			// Should be in MCP mode
			expect(finalContent).toContain("MCP");

			// Should only have one set of markers
			const markerCount = (
				finalContent.match(/<!-- BACKLOG-JIRA GUIDELINES START -->/g) || []
			).length;
			expect(markerCount).toBe(1);
		});
	});
});
