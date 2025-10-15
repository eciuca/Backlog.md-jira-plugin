import { spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import chalk from "chalk";
import type { Command } from "commander";
import { logger } from "../utils/logger.ts";
import type { JiraConfig } from "./init.ts";

export interface McpConfig {
	serverCommand?: string;
	serverArgs?: string[];
	fallbackToDocker?: boolean;
	useExternalServer?: boolean;
	dnsServers?: string[];
	dnsSearchDomains?: string[];
}

export interface ExtendedJiraConfig extends JiraConfig {
	mcp?: McpConfig;
}

export interface McpStartOptions {
	debug?: boolean;
	verbose?: boolean;
	dnsServers?: string[];
	dnsSearchDomains?: string[];
}

/**
 * Register MCP command group with the CLI program
 */
export function registerMcpCommand(program: Command): void {
	const mcpCommand = program
		.command("mcp")
		.description("MCP Atlassian server management");

	mcpCommand
		.command("start")
		.description("Start MCP Atlassian server using plugin configuration")
		.option("--debug", "Print startup info and debug output")
		.option("-v, --verbose", "Display docker commands being executed")
		.option(
			"--dns-servers <servers...>",
			"DNS server IPs for the MCP server process (e.g., 8.8.8.8 1.1.1.1)",
		)
		.option(
			"--dns-search-domains <domains...>",
			"DNS search domains for the MCP server process (e.g., company.com internal.local)",
		)
		.action(async (options: McpStartOptions) => {
			try {
				await mcpStartCommand(options);
			} catch (error) {
				console.error(
					"Error:",
					error instanceof Error ? error.message : String(error),
				);
				process.exit(1);
			}
		});
}

/**
 * Start MCP Atlassian server command implementation
 */
export async function mcpStartCommand(
	options: McpStartOptions = {},
): Promise<void> {
	if (options.debug) {
		console.log(chalk.cyan("🚀 Starting MCP Atlassian server..."));
		console.log(chalk.gray("Debug mode enabled\n"));
	}

	// Validate environment variables
	const envVars = validateAndPrepareCredentials(options.debug);

	// Load configuration
	const config = loadMcpConfiguration(options.debug);

	// Merge DNS options from CLI flags and config
	const dnsServers = options.dnsServers || config.dnsServers || [];
	const dnsSearchDomains =
		options.dnsSearchDomains || config.dnsSearchDomains || [];

	if (options.debug && (dnsServers.length > 0 || dnsSearchDomains.length > 0)) {
		console.log(chalk.yellow("DNS Configuration:"));
		if (dnsServers.length > 0) {
			console.log(chalk.gray(`  Servers: ${dnsServers.join(", ")}`));
		}
		if (dnsSearchDomains.length > 0) {
			console.log(
				chalk.gray(`  Search domains: ${dnsSearchDomains.join(", ")}`),
			);
		}
		console.log();
	}

	// Try external server first if configured
	if (config.useExternalServer !== false) {
		try {
			await startExternalServer(
				config,
				envVars,
				dnsServers,
				dnsSearchDomains,
				options.debug,
			);
			return;
		} catch (error) {
			if (options.debug) {
				console.log(
					chalk.yellow(
						"External server failed:",
						error instanceof Error ? error.message : String(error),
					),
				);
			}

			if (!config.fallbackToDocker) {
				throw error;
			}

			if (options.debug) {
				console.log(chalk.yellow("Falling back to Docker...\n"));
			}
		}
	}

	// Use Docker approach (either as primary or fallback)
	await startDockerServer(
		config,
		envVars,
		dnsServers,
		dnsSearchDomains,
		options.debug,
		options.verbose,
	);
}

/**
 * Validate credentials and prepare environment variables
 */
function validateAndPrepareCredentials(
	debug?: boolean,
): Record<string, string> {
	const jiraUrl = process.env.JIRA_URL;
	const jiraUsername = process.env.JIRA_EMAIL || process.env.JIRA_USERNAME;
	const jiraApiToken = process.env.JIRA_API_TOKEN;
	const jiraPersonalToken = process.env.JIRA_PERSONAL_TOKEN;

	if (!jiraUrl) {
		throw new Error("Missing JIRA_URL environment variable.");
	}

	// Support both authentication methods
	const hasApiTokenAuth = jiraUsername && jiraApiToken;
	const hasPersonalTokenAuth = jiraPersonalToken;

	if (!hasApiTokenAuth && !hasPersonalTokenAuth) {
		throw new Error(
			"Missing required Jira credentials. Please set either:\n" +
				"  - For Jira Cloud: JIRA_URL, JIRA_EMAIL (or JIRA_USERNAME), and JIRA_API_TOKEN\n" +
				"  - For Jira Server/Data Center: JIRA_URL and JIRA_PERSONAL_TOKEN",
		);
	}

	const envVars: Record<string, string> = {
		...process.env,
		JIRA_URL: jiraUrl,
	};

	if (hasPersonalTokenAuth && jiraPersonalToken) {
		envVars.JIRA_PERSONAL_TOKEN = jiraPersonalToken;
		if (debug) {
			console.log(chalk.green("✓ Using Personal Access Token authentication"));
		}
	} else if (jiraUsername && jiraApiToken) {
		envVars.JIRA_USERNAME = jiraUsername;
		envVars.JIRA_API_TOKEN = jiraApiToken;
		if (debug) {
			console.log(chalk.green("✓ Using API Token authentication"));
		}
	}

	return envVars;
}

/**
 * Load MCP configuration from .backlog-jira/config.json
 */
function loadMcpConfiguration(debug?: boolean): McpConfig {
	const configDir = join(process.cwd(), ".backlog-jira");
	const configPath = join(configDir, "config.json");

	const defaultConfig: McpConfig = {
		serverCommand: "mcp-atlassian",
		serverArgs: [],
		fallbackToDocker: true,
		useExternalServer: true,
		dnsServers: [],
		dnsSearchDomains: [],
	};

	if (!existsSync(configPath)) {
		if (debug) {
			console.log(chalk.yellow("⚠ No config.json found, using defaults"));
		}
		return defaultConfig;
	}

	try {
		const configContent = readFileSync(configPath, "utf-8");
		const config = JSON.parse(configContent) as ExtendedJiraConfig;

		const mcpConfig = {
			...defaultConfig,
			...config.mcp,
		};

		if (debug) {
			console.log(chalk.green("✓ Loaded configuration from config.json"));
			console.log(chalk.gray(`  Server command: ${mcpConfig.serverCommand}`));
			console.log(
				chalk.gray(
					`  Server args: [${mcpConfig.serverArgs?.join(", ") || ""}]`,
				),
			);
			console.log(
				chalk.gray(`  Use external server: ${mcpConfig.useExternalServer}`),
			);
			console.log(
				chalk.gray(`  Fallback to Docker: ${mcpConfig.fallbackToDocker}`),
			);
		}

		return mcpConfig;
	} catch (error) {
		if (debug) {
			console.log(
				chalk.yellow(
					`⚠ Failed to load config: ${error instanceof Error ? error.message : String(error)}`,
				),
			);
			console.log(chalk.yellow("Using default configuration"));
		}
		return defaultConfig;
	}
}

/**
 * Start external MCP server
 */
async function startExternalServer(
	config: McpConfig,
	envVars: Record<string, string>,
	dnsServers: string[],
	dnsSearchDomains: string[],
	debug?: boolean,
): Promise<void> {
	const serverCommand = config.serverCommand || "mcp-atlassian";
	const serverArgs = config.serverArgs || [];

	if (debug) {
		console.log(chalk.blue("Starting external MCP server:"));
		console.log(chalk.gray(`  Command: ${serverCommand}`));
		console.log(chalk.gray(`  Args: [${serverArgs.join(", ")}]`));
	}

	// Apply DNS configuration if specified
	const processEnv = applyDnsConfiguration(
		envVars,
		dnsServers,
		dnsSearchDomains,
		debug,
	);

	return new Promise((resolve, reject) => {
		const child = spawn(serverCommand, serverArgs, {
			stdio: ["pipe", "pipe", "pipe"],
			env: processEnv,
		});

		// Handle startup errors
		child.on("error", (error) => {
			reject(new Error(`Failed to start external server: ${error.message}`));
		});

		child.on("spawn", () => {
			if (debug) {
				console.log(chalk.green("✓ External server spawned successfully"));
			}
		});

		// Setup stdio forwarding
		process.stdin.pipe(child.stdin);
		child.stdout.pipe(process.stdout);
		child.stderr.pipe(process.stderr);

		// Handle process termination
		child.on("close", (code, signal) => {
			if (debug) {
				console.log(
					chalk.yellow(`MCP server closed with code ${code}, signal ${signal}`),
				);
			}
			process.exit(code || 0);
		});

		// Handle parent process signals
		process.on("SIGINT", () => {
			if (debug) {
				console.log(chalk.yellow("Received SIGINT, terminating MCP server..."));
			}
			child.kill("SIGINT");
		});

		process.on("SIGTERM", () => {
			if (debug) {
				console.log(
					chalk.yellow("Received SIGTERM, terminating MCP server..."),
				);
			}
			child.kill("SIGTERM");
		});

		// Print success message
		console.log(chalk.green("MCP Atlassian server started (stdio)"));
		resolve();
	});
}

/**
 * Start Docker-based MCP server
 */
async function startDockerServer(
	config: McpConfig,
	envVars: Record<string, string>,
	dnsServers: string[],
	dnsSearchDomains: string[],
	debug?: boolean,
	verbose?: boolean,
): Promise<void> {
	const dockerImage = "ghcr.io/sooperset/mcp-atlassian:latest";
	const dockerArgs = ["run", "--rm", "-i"];

	// Add environment variables
	dockerArgs.push("-e", "JIRA_URL");
	if (envVars.JIRA_PERSONAL_TOKEN) {
		dockerArgs.push("-e", "JIRA_PERSONAL_TOKEN");
	} else if (envVars.JIRA_USERNAME && envVars.JIRA_API_TOKEN) {
		dockerArgs.push("-e", "JIRA_USERNAME", "-e", "JIRA_API_TOKEN");
	}

	// Add DNS configuration to Docker if specified
	if (dnsServers.length > 0) {
		for (const server of dnsServers) {
			dockerArgs.push("--dns", server);
		}
	}

	if (dnsSearchDomains.length > 0) {
		dockerArgs.push("--dns-search", dnsSearchDomains.join(","));
	}

	dockerArgs.push(dockerImage);

	if (debug) {
		console.log(chalk.blue("Starting Docker MCP server:"));
		console.log(chalk.gray(`  Image: ${dockerImage}`));
		console.log(chalk.gray(`  Args: [${dockerArgs.join(", ")}]`));
	}

	// Log docker command if verbose mode is enabled
	if (verbose) {
		logDockerCommand("docker", dockerArgs);
	}

	return new Promise((resolve, reject) => {
		const child = spawn("docker", dockerArgs, {
			stdio: ["pipe", "pipe", "pipe"],
			env: envVars,
		});

		// Handle startup errors
		child.on("error", (error) => {
			reject(new Error(`Failed to start Docker server: ${error.message}`));
		});

		child.on("spawn", () => {
			if (debug) {
				console.log(chalk.green("✓ Docker server spawned successfully"));
			}
		});

		// Setup stdio forwarding
		process.stdin.pipe(child.stdin);
		child.stdout.pipe(process.stdout);
		child.stderr.pipe(process.stderr);

		// Handle process termination
		child.on("close", (code, signal) => {
			if (debug) {
				console.log(
					chalk.yellow(
						`Docker MCP server closed with code ${code}, signal ${signal}`,
					),
				);
			}
			process.exit(code || 0);
		});

		// Handle parent process signals
		process.on("SIGINT", () => {
			if (debug) {
				console.log(
					chalk.yellow("Received SIGINT, terminating Docker server..."),
				);
			}
			child.kill("SIGINT");
		});

		process.on("SIGTERM", () => {
			if (debug) {
				console.log(
					chalk.yellow("Received SIGTERM, terminating Docker server..."),
				);
			}
			child.kill("SIGTERM");
		});

		// Print success message
		console.log(chalk.green("MCP Atlassian server started (stdio)"));
		resolve();
	});
}

/**
 * Apply DNS configuration to environment variables
 *
 * Note: This is a simplified approach. Real DNS configuration depends on the OS and
 * may require additional system-level changes or containerization for full isolation.
 * This implementation documents the limitation while providing basic environment setup.
 */
function applyDnsConfiguration(
	envVars: Record<string, string>,
	dnsServers: string[],
	dnsSearchDomains: string[],
	debug?: boolean,
): Record<string, string> {
	const result = { ...envVars };

	// Add DNS environment variables that some applications may respect
	if (dnsServers.length > 0) {
		result.DNS_SERVERS = dnsServers.join(",");
		result.NAMESERVER = dnsServers[0]; // Primary nameserver

		if (debug) {
			console.log(chalk.yellow("DNS Configuration Applied:"));
			console.log(
				chalk.gray(
					`  Environment variable DNS_SERVERS set to: ${result.DNS_SERVERS}`,
				),
			);
			console.log(
				chalk.gray(
					"  Note: DNS changes depend on application support and OS configuration",
				),
			);
		}
	}

	if (dnsSearchDomains.length > 0) {
		result.DNS_SEARCH_DOMAINS = dnsSearchDomains.join(",");

		if (debug) {
			console.log(
				chalk.gray(
					`  Environment variable DNS_SEARCH_DOMAINS set to: ${result.DNS_SEARCH_DOMAINS}`,
				),
			);
		}
	}

	if (debug && (dnsServers.length > 0 || dnsSearchDomains.length > 0)) {
		console.log(
			chalk.yellow(
				"  Limitation: Full DNS resolution changes may require system-level configuration",
			),
		);
		console.log(
			chalk.yellow("  or running within a container with custom DNS settings."),
		);
		console.log();
	}

	return result;
}

/**
 * Log docker command to stderr for debugging/transparency
 * @param command - The docker command (typically "docker")
 * @param args - Array of command arguments
 */
function logDockerCommand(command: string, args: string[]): void {
	const fullCommand = `${command} ${args.join(" ")}`;
	console.error(chalk.cyan("[VERBOSE] Docker command:"));
	console.error(chalk.gray(fullCommand));
	console.error();
}
