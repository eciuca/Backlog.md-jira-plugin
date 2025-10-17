import { existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { logger } from "../utils/logger.ts";
import {
	getJiraMetadata,
	getTaskFilePath,
	updateJiraMetadata,
	parseFrontmatter,
} from "../utils/frontmatter.ts";
import type { Mapping, Snapshot, SyncState, OpLog } from "./store.ts";

/**
 * FrontmatterStore replaces SQLite with file-based storage
 * 
 * Storage architecture:
 * - Mappings: Stored in task frontmatter (jira_key field)
 * - Snapshots: Stored in .backlog-jira/snapshots/<backlog-id>-<side>.json
 * - Sync state: Stored in task frontmatter (jira_last_sync, jira_sync_state fields)
 * - Operations log: Stored in .backlog-jira/ops-log.jsonl
 */
export class FrontmatterStore {
	private snapshotsDir: string;
	private opsLogPath: string;

	constructor(configDir?: string) {
		const baseDir = configDir || join(process.cwd(), ".backlog-jira");
		
		// Ensure config directory exists
		if (!existsSync(baseDir)) {
			mkdirSync(baseDir, { recursive: true });
		}

		this.snapshotsDir = join(baseDir, "snapshots");
		this.opsLogPath = join(baseDir, "ops-log.jsonl");

		// Ensure snapshots directory exists
		if (!existsSync(this.snapshotsDir)) {
			mkdirSync(this.snapshotsDir, { recursive: true });
		}

		logger.debug({ baseDir, snapshotsDir: this.snapshotsDir }, "FrontmatterStore initialized");
	}

	// ===== Mapping methods =====
	// Mappings are stored in task frontmatter as jira_key field

	addMapping(backlogId: string, jiraKey: string): void {
		try {
			const filePath = getTaskFilePath(backlogId);
			updateJiraMetadata(filePath, { jiraKey });
			logger.debug({ backlogId, jiraKey }, "Added mapping");
		} catch (error) {
			logger.error({ error, backlogId, jiraKey }, "Failed to add mapping");
			throw error;
		}
	}

	getMapping(backlogId: string): Mapping | null {
		try {
			const filePath = getTaskFilePath(backlogId);
			const metadata = getJiraMetadata(filePath);
			
			if (!metadata.jiraKey) {
				return null;
			}

			// Get created/updated timestamps from file metadata
			const content = readFileSync(filePath, "utf-8");
			const { frontmatter } = parseFrontmatter(content);
			
			return {
				backlogId,
				jiraKey: metadata.jiraKey,
				createdAt: (frontmatter.created as string) || new Date().toISOString(),
				updatedAt: (frontmatter.updated as string) || new Date().toISOString(),
			};
		} catch (error) {
			// Task file not found or no mapping
			return null;
		}
	}

	getMappingByJiraKey(jiraKey: string): Mapping | null {
		try {
			// Scan all task files to find the one with this jira_key
			const tasksDir = join(process.cwd(), "backlog", "tasks");
			const files = readdirSync(tasksDir).filter(f => f.endsWith(".md"));

			for (const file of files) {
				const filePath = join(tasksDir, file);
				const content = readFileSync(filePath, "utf-8");
				const { frontmatter } = parseFrontmatter(content);

				if (frontmatter.jira_key === jiraKey) {
					// Extract task ID from filename: task-123 - Title.md
					const match = file.match(/^(task-[\d.]+)\s+-\s+/);
					if (match) {
						return {
							backlogId: match[1],
							jiraKey,
							createdAt: (frontmatter.created as string) || new Date().toISOString(),
							updatedAt: (frontmatter.updated as string) || new Date().toISOString(),
						};
					}
				}
			}

			return null;
		} catch (error) {
			logger.error({ error, jiraKey }, "Failed to get mapping by Jira key");
			return null;
		}
	}

	getAllMappings(): Map<string, string> {
		const mappings = new Map<string, string>();

		try {
			const tasksDir = join(process.cwd(), "backlog", "tasks");
			const files = readdirSync(tasksDir).filter(f => f.endsWith(".md"));

			for (const file of files) {
				const filePath = join(tasksDir, file);
				const content = readFileSync(filePath, "utf-8");
				const { frontmatter } = parseFrontmatter(content);

				if (frontmatter.jira_key) {
					// Extract task ID from filename
					const match = file.match(/^(task-[\d.]+)\s+-\s+/);
					if (match) {
						mappings.set(match[1], frontmatter.jira_key as string);
					}
				}
			}
		} catch (error) {
			logger.error({ error }, "Failed to get all mappings");
		}

		return mappings;
	}

	deleteMapping(backlogId: string): void {
		try {
			const filePath = getTaskFilePath(backlogId);
			updateJiraMetadata(filePath, { 
				jiraKey: undefined,
				jiraLastSync: undefined,
				jiraSyncState: undefined,
				jiraUrl: undefined,
			});
			logger.debug({ backlogId }, "Deleted mapping");
		} catch (error) {
			logger.error({ error, backlogId }, "Failed to delete mapping");
			throw error;
		}
	}

	// ===== Snapshot methods =====
	// Snapshots are stored as JSON files in .backlog-jira/snapshots/

	private getSnapshotPath(backlogId: string, side: "backlog" | "jira"): string {
		return join(this.snapshotsDir, `${backlogId}-${side}.json`);
	}

	setSnapshot(
		backlogId: string,
		side: "backlog" | "jira",
		hash: string,
		payload: unknown,
	): void {
		const snapshotPath = this.getSnapshotPath(backlogId, side);
		const snapshot: Snapshot = {
			backlogId,
			side,
			hash,
			payload: JSON.stringify(payload),
			updatedAt: new Date().toISOString(),
		};

		try {
			writeFileSync(snapshotPath, JSON.stringify(snapshot, null, 2), "utf-8");
			logger.debug({ backlogId, side, hash }, "Set snapshot");
		} catch (error) {
			logger.error({ error, backlogId, side }, "Failed to set snapshot");
			throw error;
		}
	}

	getSnapshot(backlogId: string, side: "backlog" | "jira"): Snapshot | null {
		const snapshotPath = this.getSnapshotPath(backlogId, side);

		if (!existsSync(snapshotPath)) {
			return null;
		}

		try {
			const content = readFileSync(snapshotPath, "utf-8");
			return JSON.parse(content) as Snapshot;
		} catch (error) {
			logger.error({ error, backlogId, side }, "Failed to get snapshot");
			return null;
		}
	}

	getSnapshots(backlogId: string): {
		backlog: Snapshot | null;
		jira: Snapshot | null;
	} {
		return {
			backlog: this.getSnapshot(backlogId, "backlog"),
			jira: this.getSnapshot(backlogId, "jira"),
		};
	}

	// ===== Sync state methods =====
	// Sync state is stored in task frontmatter

	updateSyncState(
		backlogId: string,
		updates: Partial<Omit<SyncState, "backlogId">>,
	): void {
		try {
			const filePath = getTaskFilePath(backlogId);
			const metadata = getJiraMetadata(filePath);

			updateJiraMetadata(filePath, {
				jiraKey: metadata.jiraKey,
				jiraLastSync: updates.lastSyncAt ?? metadata.jiraLastSync,
				jiraSyncState: updates.conflictState ?? metadata.jiraSyncState,
				jiraUrl: metadata.jiraUrl,
			});

			logger.debug({ backlogId, updates }, "Updated sync state");
		} catch (error) {
			logger.error({ error, backlogId, updates }, "Failed to update sync state");
			throw error;
		}
	}

	getSyncState(backlogId: string): SyncState | null {
		try {
			const filePath = getTaskFilePath(backlogId);
			const metadata = getJiraMetadata(filePath);

			return {
				backlogId,
				lastSyncAt: metadata.jiraLastSync || null,
				conflictState: metadata.jiraSyncState || null,
				strategy: null, // Not stored in frontmatter
			};
		} catch (error) {
			return null;
		}
	}

	// ===== Operations log =====
	// Operations are appended to a JSONL file

	logOperation(
		op: string,
		backlogId: string | null,
		jiraKey: string | null,
		outcome: string,
		details?: string,
	): void {
		const logEntry: OpLog = {
			id: Date.now(), // Use timestamp as ID
			ts: new Date().toISOString(),
			op,
			backlogId,
			jiraKey,
			outcome,
			details: details || null,
		};

		try {
			const line = JSON.stringify(logEntry) + "\n";
			writeFileSync(this.opsLogPath, line, { flag: "a", encoding: "utf-8" });
			logger.debug({ op, backlogId, jiraKey, outcome }, "Logged operation");
		} catch (error) {
			logger.error({ error, op }, "Failed to log operation");
			// Don't throw - logging failure shouldn't break operations
		}
	}

	getRecentOps(limit = 100): OpLog[] {
		if (!existsSync(this.opsLogPath)) {
			return [];
		}

		try {
			const content = readFileSync(this.opsLogPath, "utf-8");
			const lines = content.trim().split("\n").filter(l => l.trim());
			
			// Parse JSONL and return last N entries
			const ops = lines
				.map(line => {
					try {
						return JSON.parse(line) as OpLog;
					} catch {
						return null;
					}
				})
				.filter((op): op is OpLog => op !== null)
				.reverse() // Most recent first
				.slice(0, limit);

			return ops;
		} catch (error) {
			logger.error({ error }, "Failed to get recent ops");
			return [];
		}
	}

	// Test write access for doctor command
	testWriteAccess(): void {
		const testFile = join(this.snapshotsDir, ".write-test");
		try {
			writeFileSync(testFile, "test", "utf-8");
			readFileSync(testFile, "utf-8");
			// Clean up test file
			const { unlinkSync } = require("node:fs");
			unlinkSync(testFile);
		} catch (error) {
			logger.error({ error }, "Write access test failed");
			throw new Error("Cannot write to .backlog-jira directory");
		}
	}

	close(): void {
		// No-op for file-based storage
		logger.debug("FrontmatterStore closed (no-op)");
	}
}
