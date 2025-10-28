import { describe, expect, it } from "bun:test";
import {
	formatAcceptanceCriteriaForJira,
	mergeDescriptionWithAc,
	stripAcceptanceCriteriaFromDescription,
} from "./normalizer.ts";

describe("mergeDescriptionWithAc", () => {
	it("should merge description with AC only", () => {
		const description = "This is the task description";
		const ac = [
			{ text: "First criterion", checked: false },
			{ text: "Second criterion", checked: true },
		];

		const result = mergeDescriptionWithAc(description, ac);

		expect(result).toContain("This is the task description");
		expect(result).toContain("Acceptance Criteria:");
		expect(result).toContain("- [ ] First criterion");
		expect(result).toContain("- [x] Second criterion");
		expect(result).not.toContain("Implementation Plan:");
		expect(result).not.toContain("Implementation Notes:");
	});

	it("should merge description with AC and implementation plan", () => {
		const description = "This is the task description";
		const ac = [{ text: "First criterion", checked: false }];
		const plan = "1. Step one\n2. Step two\n3. Step three";

		const result = mergeDescriptionWithAc(description, ac, plan);

		expect(result).toContain("This is the task description");
		expect(result).toContain("Acceptance Criteria:");
		expect(result).toContain("- [ ] First criterion");
		expect(result).toContain("Implementation Plan:");
		expect(result).toContain("1. Step one");
		expect(result).toContain("2. Step two");
		expect(result).toContain("3. Step three");
	});

	it("should merge description with AC, plan, and notes", () => {
		const description = "This is the task description";
		const ac = [{ text: "First criterion", checked: false }];
		const plan = "1. Step one\n2. Step two";
		const notes = "Implemented using pattern X\nUpdated tests";

		const result = mergeDescriptionWithAc(description, ac, plan, notes);

		expect(result).toContain("This is the task description");
		expect(result).toContain("Acceptance Criteria:");
		expect(result).toContain("- [ ] First criterion");
		expect(result).toContain("Implementation Plan:");
		expect(result).toContain("1. Step one");
		expect(result).toContain("2. Step two");
		expect(result).toContain("Implementation Notes:");
		expect(result).toContain("Implemented using pattern X");
		expect(result).toContain("Updated tests");
	});

	it("should handle empty plan and notes gracefully", () => {
		const description = "This is the task description";
		const ac = [{ text: "First criterion", checked: false }];

		const result = mergeDescriptionWithAc(description, ac, "", "");

		expect(result).toContain("This is the task description");
		expect(result).toContain("Acceptance Criteria:");
		expect(result).not.toContain("Implementation Plan:");
		expect(result).not.toContain("Implementation Notes:");
	});

	it("should handle undefined plan and notes", () => {
		const description = "This is the task description";
		const ac = [{ text: "First criterion", checked: false }];

		const result = mergeDescriptionWithAc(
			description,
			ac,
			undefined,
			undefined,
		);

		expect(result).toContain("This is the task description");
		expect(result).toContain("Acceptance Criteria:");
		expect(result).not.toContain("Implementation Plan:");
		expect(result).not.toContain("Implementation Notes:");
	});

	it("should preserve formatting with newlines", () => {
		const description = "Task description with\nmultiple lines";
		const ac = [{ text: "Criterion", checked: false }];
		const plan = "Step 1\nStep 2";
		const notes = "Note 1\nNote 2";

		const result = mergeDescriptionWithAc(description, ac, plan, notes);

		expect(result).toContain("Task description with\nmultiple lines");
		expect(result).toContain("Implementation Plan:\nStep 1\nStep 2");
		expect(result).toContain("Implementation Notes:\nNote 1\nNote 2");
	});

	it("should only include plan when notes are not provided", () => {
		const description = "Description";
		const ac = [{ text: "Criterion", checked: false }];
		const plan = "Implementation steps";

		const result = mergeDescriptionWithAc(description, ac, plan, undefined);

		expect(result).toContain("Implementation Plan:");
		expect(result).not.toContain("Implementation Notes:");
	});

	it("should only include notes when plan is not provided", () => {
		const description = "Description";
		const ac = [{ text: "Criterion", checked: false }];
		const notes = "Implementation summary";

		const result = mergeDescriptionWithAc(description, ac, undefined, notes);

		expect(result).not.toContain("Implementation Plan:");
		expect(result).toContain("Implementation Notes:");
	});
});

describe("formatAcceptanceCriteriaForJira", () => {
	it("should format AC with checkboxes", () => {
		const ac = [
			{ text: "First", checked: false },
			{ text: "Second", checked: true },
		];

		const result = formatAcceptanceCriteriaForJira(ac);

		expect(result).toContain("Acceptance Criteria:");
		expect(result).toContain("- [ ] First");
		expect(result).toContain("- [x] Second");
	});

	it("should return empty string for empty AC", () => {
		const result = formatAcceptanceCriteriaForJira([]);
		expect(result).toBe("");
	});
});

describe("stripAcceptanceCriteriaFromDescription", () => {
	it("should remove AC section from description", () => {
		const description =
			"Task description\n\nAcceptance Criteria:\n- [ ] First\n- [x] Second";

		const result = stripAcceptanceCriteriaFromDescription(description);

		expect(result).toBe("Task description");
		expect(result).not.toContain("Acceptance Criteria");
	});

	it("should handle description without AC", () => {
		const description = "Task description without AC";

		const result = stripAcceptanceCriteriaFromDescription(description);

		expect(result).toBe("Task description without AC");
	});
});
