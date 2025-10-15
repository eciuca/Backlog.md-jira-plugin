import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

/**
 * Creates a unique temporary directory for test isolation.
 *
 * @param prefix - Optional prefix for the directory name (e.g., test file name)
 * @returns Absolute path to the created temporary directory
 *
 * @example
 * const testDir = uniqueTestDir('init-test');
 * // Returns: /tmp/init-test-1234567890-abc123/
 */
export function uniqueTestDir(prefix = "test"): string {
	const timestamp = Date.now();
	const random = Math.random().toString(36).substring(2, 8);
	const dirPrefix = join(tmpdir(), `${prefix}-${timestamp}-${random}-`);
	return mkdtempSync(dirPrefix);
}

/**
 * Writes a JSON object to a file.
 * Creates parent directories if they don't exist.
 *
 * @param filePath - Path to the JSON file
 * @param data - Object to serialize as JSON
 */
export function writeJson(filePath: string, data: unknown): void {
	const dir = join(filePath, "..");
	mkdirSync(dir, { recursive: true });
	writeFileSync(filePath, JSON.stringify(data, null, 2), "utf-8");
}

/**
 * Recursively removes a directory and all its contents.
 * Safe to call even if directory doesn't exist.
 *
 * @param dirPath - Path to the directory to remove
 */
export function cleanupDir(dirPath: string): void {
	try {
		rmSync(dirPath, { recursive: true, force: true });
	} catch (error) {
		// Ignore errors - directory might not exist or already cleaned up
	}
}
