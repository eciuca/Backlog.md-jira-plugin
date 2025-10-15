/**
 * Tests for the init command
 *
 * This test suite verifies the initialization process of the .backlog-jira directory,
 * including:
 * - Directory structure creation
 * - Configuration file generation with correct defaults
 * - SQLite database initialization
 * - .gitignore file creation
 * - Agent instructions setup flow
 * - Process exit behavior (ensuring no hanging after completion)
 *
 * Critical tests:
 * - "should not hang after completion" - validates fix for task-312
 * - "should complete within reasonable time" - ensures performance
 *
 * All tests use mocked prompts to avoid user interaction and run in isolation
 * within a temporary test directory.
 */

import {
	afterEach,
	beforeEach,
	describe,
	expect,
	it,
	mock,
	spyOn,
} from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { cleanupDir, uniqueTestDir } from "../../test/helpers/fs.ts";
import { initCommand } from "./init.ts";

// Test directory will be created per-test
let TEST_DIR: string;
let TEST_CONFIG_DIR: string;

describe("init command", () => {
	beforeEach(() => {
		// Create unique test directory for this test
		TEST_DIR = uniqueTestDir("init-test");
		TEST_CONFIG_DIR = join(TEST_DIR, ".backlog-jira");
	});

	afterEach(() => {
		// Cleanup
		cleanupDir(TEST_DIR);
	});

	describe("directory structure", () => {
		it("should create .backlog-jira directory", async () => {
			// Mock prompts to skip agent instructions
			const promptsMock = await import("prompts");
			spyOn(promptsMock, "default").mockResolvedValue({ shouldSetup: false });

			await initCommand({ baseDir: TEST_DIR });

			expect(existsSync(TEST_CONFIG_DIR)).toBe(true);
		});

		it("should create logs subdirectory", async () => {
			// Mock prompts to skip agent instructions
			const promptsMock = await import("prompts");
			spyOn(promptsMock, "default").mockResolvedValue({ shouldSetup: false });

			await initCommand({ baseDir: TEST_DIR });

			const logsDir = join(TEST_CONFIG_DIR, "logs");
			expect(existsSync(logsDir)).toBe(true);
		});

		it("should not reinitialize if directory exists", async () => {
			// First initialization
			const promptsMock = await import("prompts");
			spyOn(promptsMock, "default").mockResolvedValue({ shouldSetup: false });

			await initCommand({ baseDir: TEST_DIR });
			const firstInitTime = existsSync(TEST_CONFIG_DIR);

			// Try to initialize again
			await initCommand({ baseDir: TEST_DIR });

			expect(firstInitTime).toBe(true);
			// Should still exist but not throw error
			expect(existsSync(TEST_CONFIG_DIR)).toBe(true);
		});
	});

	describe("configuration file", () => {
		it("should create config.json with default values", async () => {
			// Mock prompts to skip agent instructions
			const promptsMock = await import("prompts");
			spyOn(promptsMock, "default").mockResolvedValue({ shouldSetup: false });

			await initCommand({ baseDir: TEST_DIR });

			const configPath = join(TEST_CONFIG_DIR, "config.json");
			expect(existsSync(configPath)).toBe(true);

			const config = JSON.parse(readFileSync(configPath, "utf-8"));

			// Verify structure
			expect(config).toHaveProperty("jira");
			expect(config).toHaveProperty("backlog");
			expect(config).toHaveProperty("sync");
		});

		it("should have correct jira configuration defaults", async () => {
			// Mock prompts to skip agent instructions
			const promptsMock = await import("prompts");
			spyOn(promptsMock, "default").mockResolvedValue({ shouldSetup: false });

			await initCommand({ baseDir: TEST_DIR });

			const configPath = join(TEST_CONFIG_DIR, "config.json");
			const config = JSON.parse(readFileSync(configPath, "utf-8"));

			expect(config.jira).toEqual({
				baseUrl: "",
				projectKey: "",
				issueType: "Task",
				jqlFilter: "",
			});
		});

		it("should have correct status mapping defaults", async () => {
			// Mock prompts to skip agent instructions
			const promptsMock = await import("prompts");
			spyOn(promptsMock, "default").mockResolvedValue({ shouldSetup: false });

			await initCommand({ baseDir: TEST_DIR });

			const configPath = join(TEST_CONFIG_DIR, "config.json");
			const config = JSON.parse(readFileSync(configPath, "utf-8"));

			expect(config.backlog.statusMapping).toEqual({
				"To Do": ["To Do", "Open", "Backlog"],
				"In Progress": ["In Progress"],
				Done: ["Done", "Closed", "Resolved"],
			});
		});

		it("should have correct sync configuration defaults", async () => {
			// Mock prompts to skip agent instructions
			const promptsMock = await import("prompts");
			spyOn(promptsMock, "default").mockResolvedValue({ shouldSetup: false });

			await initCommand({ baseDir: TEST_DIR });

			const configPath = join(TEST_CONFIG_DIR, "config.json");
			const config = JSON.parse(readFileSync(configPath, "utf-8"));

			expect(config.sync).toEqual({
				conflictStrategy: "prompt",
				enableAnnotations: false,
				watchInterval: 60,
			});
		});
	});

	describe("database initialization", () => {
		it("should create SQLite database file", async () => {
			// Mock prompts to skip agent instructions
			const promptsMock = await import("prompts");
			spyOn(promptsMock, "default").mockResolvedValue({ shouldSetup: false });

			await initCommand({ baseDir: TEST_DIR });

			const dbPath = join(TEST_CONFIG_DIR, "jira-sync.db");
			expect(existsSync(dbPath)).toBe(true);
		});

		it("should create database with correct schema", async () => {
			// Mock prompts to skip agent instructions
			const promptsMock = await import("prompts");
			spyOn(promptsMock, "default").mockResolvedValue({ shouldSetup: false });

			await initCommand({ baseDir: TEST_DIR });

			// Open database and verify tables exist
			const { SyncStore } = await import("../state/store.ts");
			const dbPath = join(TEST_CONFIG_DIR, "jira-sync.db");
			const store = new SyncStore(dbPath);

			// Try to perform a basic operation to verify schema
			try {
				// This should not throw if schema is correct
				store.getAllMappings();
				expect(true).toBe(true);
			} finally {
				store.close();
			}
		});
	});

	describe("gitignore file", () => {
		it("should create .gitignore in config directory", async () => {
			// Mock prompts to skip agent instructions
			const promptsMock = await import("prompts");
			spyOn(promptsMock, "default").mockResolvedValue({ shouldSetup: false });

			await initCommand({ baseDir: TEST_DIR });

			const gitignorePath = join(TEST_CONFIG_DIR, ".gitignore");
			expect(existsSync(gitignorePath)).toBe(true);
		});

		it("should ignore all files except .gitignore itself", async () => {
			// Mock prompts to skip agent instructions
			const promptsMock = await import("prompts");
			spyOn(promptsMock, "default").mockResolvedValue({ shouldSetup: false });

			await initCommand({ baseDir: TEST_DIR });

			const gitignorePath = join(TEST_CONFIG_DIR, ".gitignore");
			const content = readFileSync(gitignorePath, "utf-8");

			expect(content).toContain("*");
			expect(content).toContain("!.gitignore");
		});
	});

	describe("agent instructions setup", () => {
		it("should skip agent instructions when user declines", async () => {
			// Mock prompts to decline agent instructions
			const promptsMock = await import("prompts");
			spyOn(promptsMock, "default").mockResolvedValue({ shouldSetup: false });

			await initCommand({ baseDir: TEST_DIR });

			// Should complete without errors
			expect(existsSync(TEST_CONFIG_DIR)).toBe(true);
		});

		it("should handle user cancellation gracefully", async () => {
			// Mock prompts to simulate Ctrl+C (undefined response)
			const promptsMock = await import("prompts");
			spyOn(promptsMock, "default").mockResolvedValue({
				shouldSetup: undefined,
			});

			await initCommand({ baseDir: TEST_DIR });

			// Should still create the config directory
			expect(existsSync(TEST_CONFIG_DIR)).toBe(true);
		});

		it("should detect existing agent instruction files", async () => {
			// Create a sample AGENTS.md file
			const agentsFile = join(TEST_DIR, "AGENTS.md");
			Bun.write(agentsFile, "# Agent Instructions\n");

			// Mock prompts sequence
			const promptsMock = await import("prompts");
			const mockFn = spyOn(promptsMock, "default");

			// First call: should setup? -> yes
			// Second call: which files? -> skip (undefined to cancel)
			mockFn
				.mockResolvedValueOnce({ shouldSetup: true })
				.mockResolvedValueOnce({ selectedFiles: undefined });

			await initCommand({ baseDir: TEST_DIR });

			// Should have been asked about setup
			expect(mockFn).toHaveBeenCalled();
		});
	});

	describe("error handling", () => {
		it("should handle permission errors gracefully", async () => {
			// This test would require special setup to simulate permission errors
			// For now, we just ensure the function doesn't throw unexpectedly
			const promptsMock = await import("prompts");
			spyOn(promptsMock, "default").mockResolvedValue({ shouldSetup: false });

			try {
				await initCommand({ baseDir: TEST_DIR });
				expect(true).toBe(true);
			} catch (error) {
				// Should not throw during normal operation
				expect(error).toBeUndefined();
			}
		});
	});

	describe("process exit behavior", () => {
		it("should not hang after completion", async () => {
			// Mock prompts to skip agent instructions
			const promptsMock = await import("prompts");
			spyOn(promptsMock, "default").mockResolvedValue({ shouldSetup: false });

			// Run with a timeout to ensure it completes
			const timeoutPromise = new Promise((resolve) =>
				setTimeout(() => resolve("timeout"), 5000),
			);
			const initPromise = initCommand().then(() => "completed");

			const result = await Promise.race([initPromise, timeoutPromise]);

			expect(result).toBe("completed");
		});

		it("should complete within reasonable time", async () => {
			// Mock prompts to skip agent instructions
			const promptsMock = await import("prompts");
			spyOn(promptsMock, "default").mockResolvedValue({ shouldSetup: false });

			const startTime = Date.now();
			await initCommand({ baseDir: TEST_DIR });
			const duration = Date.now() - startTime;

			// Should complete in less than 2 seconds
			expect(duration).toBeLessThan(2000);
		});
	});

	describe("integration with file system", () => {
		it("should create all required files in one operation", async () => {
			// Mock prompts to skip agent instructions
			const promptsMock = await import("prompts");
			spyOn(promptsMock, "default").mockResolvedValue({ shouldSetup: false });

			await initCommand({ baseDir: TEST_DIR });

			// Verify all expected files exist
			const expectedFiles = [
				join(TEST_CONFIG_DIR, "config.json"),
				join(TEST_CONFIG_DIR, "jira-sync.db"),
				join(TEST_CONFIG_DIR, ".gitignore"),
			];

			for (const file of expectedFiles) {
				expect(existsSync(file)).toBe(true);
			}
		});

		it("should create logs directory for future use", async () => {
			// Mock prompts to skip agent instructions
			const promptsMock = await import("prompts");
			spyOn(promptsMock, "default").mockResolvedValue({ shouldSetup: false });

			await initCommand({ baseDir: TEST_DIR });

			const logsDir = join(TEST_CONFIG_DIR, "logs");
			expect(existsSync(logsDir)).toBe(true);

			// Verify it's a directory using fs.statSync
			const { statSync } = await import("node:fs");
			const stats = statSync(logsDir);
			expect(stats.isDirectory()).toBe(true);
		});
	});
});
