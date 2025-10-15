import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { JiraClientOptions } from "../integrations/jira.ts";
import { logger } from "./logger.ts";

/**
 * Get JiraClient options from config.json
 * Reads mcp.serverArgs from .backlog-jira/config.json if available
 */
export function getJiraClientOptions(): JiraClientOptions {
	try {
		const configPath = join(process.cwd(), ".backlog-jira", "config.json");
		if (existsSync(configPath)) {
			const config = JSON.parse(readFileSync(configPath, "utf-8"));
			if (config.mcp?.serverArgs) {
				logger.debug(
					{ dockerArgs: config.mcp.serverArgs },
					"Using Docker args from config.json",
				);
				return { dockerArgs: config.mcp.serverArgs };
			}
		}
	} catch (error) {
		logger.warn({ error }, "Failed to read MCP config from config.json");
	}
	return {};
}
