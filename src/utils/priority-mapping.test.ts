import { describe, expect, test } from "bun:test";
import {
	mapBacklogPriorityToJira,
	mapJiraPriorityToBacklog,
} from "./priority-mapping.ts";

describe("mapJiraPriorityToBacklog", () => {
	test("maps standard Jira priorities correctly", () => {
		expect(mapJiraPriorityToBacklog("Highest")).toBe("high");
		expect(mapJiraPriorityToBacklog("High")).toBe("high");
		expect(mapJiraPriorityToBacklog("Medium")).toBe("medium");
		expect(mapJiraPriorityToBacklog("Low")).toBe("low");
		expect(mapJiraPriorityToBacklog("Lowest")).toBe("low");
	});

	test("maps alternate Jira priority names correctly", () => {
		expect(mapJiraPriorityToBacklog("Critical")).toBe("high");
		expect(mapJiraPriorityToBacklog("Blocker")).toBe("high");
		expect(mapJiraPriorityToBacklog("Major")).toBe("medium");
		expect(mapJiraPriorityToBacklog("Minor")).toBe("low");
		expect(mapJiraPriorityToBacklog("Trivial")).toBe("low");
	});

	test("handles case-insensitive input", () => {
		expect(mapJiraPriorityToBacklog("HIGHEST")).toBe("high");
		expect(mapJiraPriorityToBacklog("medium")).toBe("medium");
		expect(mapJiraPriorityToBacklog("MiNoR")).toBe("low");
	});

	test("handles whitespace in input", () => {
		expect(mapJiraPriorityToBacklog("  High  ")).toBe("high");
		expect(mapJiraPriorityToBacklog(" Minor ")).toBe("low");
	});

	test("returns undefined for undefined input", () => {
		expect(mapJiraPriorityToBacklog(undefined)).toBeUndefined();
	});

	test("defaults to medium for unknown priority values", () => {
		expect(mapJiraPriorityToBacklog("Unknown")).toBe("medium");
		expect(mapJiraPriorityToBacklog("P1")).toBe("medium");
		expect(mapJiraPriorityToBacklog("Urgent")).toBe("medium");
	});
});

describe("mapBacklogPriorityToJira", () => {
	test("maps Backlog priorities to standard Jira names", () => {
		expect(mapBacklogPriorityToJira("high")).toBe("High");
		expect(mapBacklogPriorityToJira("medium")).toBe("Medium");
		expect(mapBacklogPriorityToJira("low")).toBe("Low");
	});

	test("handles case-insensitive input", () => {
		expect(mapBacklogPriorityToJira("HIGH")).toBe("High");
		expect(mapBacklogPriorityToJira("Medium")).toBe("Medium");
		expect(mapBacklogPriorityToJira("LOW")).toBe("Low");
	});

	test("handles whitespace in input", () => {
		expect(mapBacklogPriorityToJira("  high  ")).toBe("High");
		expect(mapBacklogPriorityToJira(" low ")).toBe("Low");
	});

	test("returns undefined for undefined input", () => {
		expect(mapBacklogPriorityToJira(undefined)).toBeUndefined();
	});

	test("defaults to Medium for unknown priority values", () => {
		expect(mapBacklogPriorityToJira("unknown")).toBe("Medium");
		expect(mapBacklogPriorityToJira("critical")).toBe("Medium");
	});
});
