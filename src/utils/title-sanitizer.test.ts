import { describe, expect, it } from "vitest";
import { hasUnsafeCharacters, sanitizeTitle } from "./title-sanitizer.ts";

describe("sanitizeTitle", () => {
	it("should return the same title if no unsafe characters", () => {
		const title = "Simple task title";
		expect(sanitizeTitle(title)).toBe(title);
	});

	it("should handle empty or null titles", () => {
		expect(sanitizeTitle("")).toBe("");
		expect(sanitizeTitle(null as any)).toBe(null);
		expect(sanitizeTitle(undefined as any)).toBe(undefined);
	});

	it("should replace brackets with parentheses", () => {
		expect(sanitizeTitle("Task [DEV-123] implementation")).toBe(
			"Task (DEV-123) implementation"
		);
		expect(sanitizeTitle("[JIRA-456] Fix bug")).toBe("(JIRA-456) Fix bug");
		expect(sanitizeTitle("Feature [A] and [B]")).toBe("Feature (A) and (B)");
	});

	it("should replace colons with hyphens", () => {
		expect(sanitizeTitle("Feature: Implementation")).toBe(
			"Feature - Implementation"
		);
		expect(sanitizeTitle("Bug: Critical issue")).toBe("Bug - Critical issue");
		expect(sanitizeTitle("A:B:C")).toBe("A -B -C");
	});

	it("should remove quotes", () => {
		expect(sanitizeTitle('Task "with quotes"')).toBe("Task with quotes");
		expect(sanitizeTitle("Task 'with quotes'")).toBe("Task with quotes");
		expect(sanitizeTitle(`Mixed "single' and "double" quotes`)).toBe(
			"Mixed single and double quotes"
		);
	});

	it("should remove YAML special characters", () => {
		expect(sanitizeTitle("Task #123")).toBe("Task 123");
		expect(sanitizeTitle("Feature & bug")).toBe("Feature bug");
		expect(sanitizeTitle("Task *important*")).toBe("Task important");
		expect(sanitizeTitle("Config {value}")).toBe("Config value");
		expect(sanitizeTitle("User @mention")).toBe("User mention");
		expect(sanitizeTitle("Code `snippet`")).toBe("Code snippet");
		expect(sanitizeTitle("Text > value")).toBe("Text value");
		expect(sanitizeTitle("Pipe | separator")).toBe("Pipe separator");
	});

	it("should replace newlines and carriage returns with spaces", () => {
		expect(sanitizeTitle("Line 1\nLine 2")).toBe("Line 1 Line 2");
		expect(sanitizeTitle("Line 1\r\nLine 2")).toBe("Line 1 Line 2");
		expect(sanitizeTitle("Multiple\n\n\nLines")).toBe("Multiple Lines");
	});

	it("should clean up multiple spaces", () => {
		expect(sanitizeTitle("Too    many     spaces")).toBe("Too many spaces");
		expect(sanitizeTitle("  Leading and trailing  ")).toBe(
			"Leading and trailing"
		);
	});

	it("should handle complex edge cases", () => {
		expect(
			sanitizeTitle('[JIRA-123]: "Feature" implementation (phase #1)')
		).toBe("(JIRA-123) - Feature implementation (phase 1)");

		expect(sanitizeTitle("Bug [P1]: User @john's issue with {config}")).toBe(
			"Bug (P1) - User johns issue with config"
		);

		expect(
			sanitizeTitle("Task: Fix\nmulti-line\ntitle with 'quotes'")
		).toBe("Task - Fix multi-line title with quotes");

		expect(sanitizeTitle("[DEV] Feature: A & B | C > D")).toBe(
			"(DEV) Feature - A B C D"
		);
	});

	it("should preserve safe special characters", () => {
		expect(sanitizeTitle("Task-with-hyphens")).toBe("Task-with-hyphens");
		expect(sanitizeTitle("Task_with_underscores")).toBe(
			"Task_with_underscores"
		);
		expect(sanitizeTitle("Task.with.dots")).toBe("Task.with.dots");
		expect(sanitizeTitle("Task (with) parens")).toBe("Task (with) parens");
		expect(sanitizeTitle("Task + plus")).toBe("Task + plus");
		expect(sanitizeTitle("Task = equals")).toBe("Task = equals");
	});

	it("should handle titles with only unsafe characters", () => {
		expect(sanitizeTitle("[]:\"#&*{}@`")).toBe("() -");
		expect(sanitizeTitle("###")).toBe("");
	});

	it("should handle real-world Jira titles", () => {
		// Common Jira patterns
		expect(sanitizeTitle("[PROJ-123] User Story: Implement login")).toBe(
			"(PROJ-123) User Story - Implement login"
		);

		expect(
			sanitizeTitle(
				'Bug: "Null pointer exception" in module [UserAuth]'
			)
		).toBe("Bug - Null pointer exception in module (UserAuth)");

		expect(
			sanitizeTitle("Epic: Refactor {backend} & optimize | performance")
		).toBe("Epic - Refactor backend optimize performance");

		expect(
			sanitizeTitle(
				"[P1] Critical: Fix user's @mention notification system"
			)
		).toBe("(P1) Critical - Fix users mention notification system");
	});
});

describe("hasUnsafeCharacters", () => {
	it("should detect titles with brackets", () => {
		expect(hasUnsafeCharacters("[JIRA-123]")).toBe(true);
		expect(hasUnsafeCharacters("Task ]")).toBe(true);
	});

	it("should detect titles with colons", () => {
		expect(hasUnsafeCharacters("Feature: Implementation")).toBe(true);
	});

	it("should detect titles with quotes", () => {
		expect(hasUnsafeCharacters('Task "name"')).toBe(true);
		expect(hasUnsafeCharacters("Task 'name'")).toBe(true);
		expect(hasUnsafeCharacters("Task \"name\"")).toBe(true);
	});

	it("should detect titles with YAML special characters", () => {
		expect(hasUnsafeCharacters("Task #123")).toBe(true);
		expect(hasUnsafeCharacters("Feature & Bug")).toBe(true);
		expect(hasUnsafeCharacters("Task *important*")).toBe(true);
		expect(hasUnsafeCharacters("Config {value}")).toBe(true);
		expect(hasUnsafeCharacters("User @mention")).toBe(true);
		expect(hasUnsafeCharacters("Code `snippet`")).toBe(true);
		expect(hasUnsafeCharacters("Text > value")).toBe(true);
		expect(hasUnsafeCharacters("Pipe | separator")).toBe(true);
		expect(hasUnsafeCharacters("Feature & Bug")).toBe(true);
	});

	it("should detect titles with newlines", () => {
		expect(hasUnsafeCharacters("Line 1\nLine 2")).toBe(true);
		expect(hasUnsafeCharacters("Line 1\r\nLine 2")).toBe(true);
	});

	it("should return false for safe titles", () => {
		expect(hasUnsafeCharacters("Simple task title")).toBe(false);
		expect(hasUnsafeCharacters("Task-with-hyphens")).toBe(false);
		expect(hasUnsafeCharacters("Task_with_underscores")).toBe(false);
		expect(hasUnsafeCharacters("Task (with) parens")).toBe(false);
	});
});
