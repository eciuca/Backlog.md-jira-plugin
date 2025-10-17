import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { JiraClientOptions } from "../integrations/jira.ts";
import { logger } from "./logger.ts";

/**
 * Get JiraClient options from config.json
 * - Reads mcp.serverArgs for Docker args (e.g., --dns, --dns-search)
 * - Reads mcp.useExternalServer/serverCommand/serverArgs for external server
 * - Reads mcp.envVars to pass extra env vars into MCP process/container
 */
export function getJiraClientOptions(): JiraClientOptions {
	try {
		const configPath = join(process.cwd(), ".backlog-jira", "config.json");
		if (!existsSync(configPath)) {
			return {} as JiraClientOptions;
		}

		const raw = readFileSync(configPath, "utf-8");
		const config = JSON.parse(raw) as {
			mcp?: {
				useExternalServer?: boolean;
				serverCommand?: string;
				serverArgs?: string[];
				fallbackToDocker?: boolean;
				envVars?: Record<string, string>;
			};
		};

		const options: JiraClientOptions = {} as JiraClientOptions;

		if (config.mcp) {
			if (config.mcp.serverArgs && Array.isArray(config.mcp.serverArgs)) {
				logger.debug(
					{ dockerArgs: config.mcp.serverArgs },
					"Using Docker args from config.json",
				);
				(options as any).dockerArgs = config.mcp.serverArgs;
			}

			if (typeof config.mcp.useExternalServer === "boolean") {
				(options as any).useExternalServer = config.mcp.useExternalServer;
			}
			if (typeof config.mcp.fallbackToDocker === "boolean") {
				(options as any).fallbackToDocker = config.mcp.fallbackToDocker;
			}
			if (typeof config.mcp.serverCommand === "string") {
				(options as any).serverCommand = config.mcp.serverCommand;
			}
			if (config.mcp.serverArgs && Array.isArray(config.mcp.serverArgs)) {
				// Reuse serverArgs for external server too (naming overlap in config)
				(options as any).serverArgs = config.mcp.serverArgs;
			}
			if (config.mcp.envVars && typeof config.mcp.envVars === "object") {
				(options as any).extraEnv = config.mcp.envVars as Record<string, string>;
			}
		}

		return options;
	} catch (error) {
		logger.warn({ error }, "Failed to read MCP config from config.json");
		return {} as JiraClientOptions;
	}
}
