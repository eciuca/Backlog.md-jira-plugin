import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { stdin as input, stdout as output } from "node:process";
import * as readline from "node:readline/promises";
import chalk from "chalk";
import type { Command } from "commander";
import { JiraClient } from "../integrations/jira.ts";
import { getJiraClientOptions } from "../utils/jira-config.ts";
import { logger } from "../utils/logger.ts";
import { getAssigneeMappingDescription } from "../utils/assignee-mapping.ts";

/**
 * Show current assignee mappings
 */
async function showMappings(): Promise<void> {
	console.log(chalk.bold.cyan("\n📋 Current Assignee Mappings\n"));
	console.log(getAssigneeMappingDescription());
	console.log();
}

/**
 * Add a new assignee mapping
 */
async function addMapping(
	backlogUser: string,
	jiraUser: string,
	options: { force?: boolean } = {},
): Promise<void> {
	const configPath = join(process.cwd(), ".backlog-jira", "config.json");

	if (!existsSync(configPath)) {
		console.error(chalk.red("❌ Configuration not found"));
		console.log(chalk.gray("   Run 'backlog-jira init' first"));
		process.exit(1);
	}

	// Read current config
	const content = readFileSync(configPath, "utf-8");
	const config = JSON.parse(content);

	// Initialize backlog config if needed
	if (!config.backlog) {
		config.backlog = {};
	}

	if (!config.backlog.assigneeMapping) {
		config.backlog.assigneeMapping = {};
	}

	// Remove @ prefix from backlog user if present
	const cleanBacklogUser = backlogUser.startsWith("@")
		? backlogUser.substring(1)
		: backlogUser;

	// Check if mapping already exists
	const existingMapping = config.backlog.assigneeMapping[cleanBacklogUser];
	if (existingMapping && !options.force) {
		console.error(
			chalk.red(
				`❌ Mapping for @${cleanBacklogUser} already exists: ${existingMapping}`,
			),
		);
		console.log(chalk.gray("   Use --force to overwrite"));
		process.exit(1);
	}

	// Add/update mapping
	config.backlog.assigneeMapping[cleanBacklogUser] = jiraUser;

	// Write back to config
	writeFileSync(configPath, JSON.stringify(config, null, 2));

	console.log(chalk.green(`✓ Added mapping: @${cleanBacklogUser} → ${jiraUser}`));
	logger.info(
		{ backlogUser: cleanBacklogUser, jiraUser },
		"Added assignee mapping",
	);
}

/**
 * Remove an assignee mapping
 */
async function removeMapping(backlogUser: string): Promise<void> {
	const configPath = join(process.cwd(), ".backlog-jira", "config.json");

	if (!existsSync(configPath)) {
		console.error(chalk.red("❌ Configuration not found"));
		console.log(chalk.gray("   Run 'backlog-jira init' first"));
		process.exit(1);
	}

	// Read current config
	const content = readFileSync(configPath, "utf-8");
	const config = JSON.parse(content);

	// Remove @ prefix if present
	const cleanBacklogUser = backlogUser.startsWith("@")
		? backlogUser.substring(1)
		: backlogUser;

	// Check both explicit and auto-discovered mappings
	const explicitMapping = config.backlog?.assigneeMapping?.[cleanBacklogUser];
	const autoMapping = config.backlog?.autoMappedAssignees?.[cleanBacklogUser];

	if (!explicitMapping && !autoMapping) {
		console.error(chalk.red(`❌ No mapping found for @${cleanBacklogUser}`));
		process.exit(1);
	}

	// Remove from appropriate section
	let jiraUser: string;
	if (explicitMapping) {
		jiraUser = explicitMapping;
		delete config.backlog.assigneeMapping[cleanBacklogUser];
		console.log(chalk.green(`✓ Removed explicit mapping: @${cleanBacklogUser} → ${jiraUser}`));
	} else {
		jiraUser = autoMapping;
		delete config.backlog.autoMappedAssignees[cleanBacklogUser];
		console.log(chalk.green(`✓ Removed auto-discovered mapping: @${cleanBacklogUser} → ${jiraUser}`));
	}

	// Write back to config
	writeFileSync(configPath, JSON.stringify(config, null, 2));

	logger.info(
		{ backlogUser: cleanBacklogUser, jiraUser },
		"Removed assignee mapping",
	);
}

/**
 * Promote an auto-discovered mapping to an explicit mapping
 */
async function promoteMapping(backlogUser: string): Promise<void> {
	const configPath = join(process.cwd(), ".backlog-jira", "config.json");

	if (!existsSync(configPath)) {
		console.error(chalk.red("❌ Configuration not found"));
		console.log(chalk.gray("   Run 'backlog-jira init' first"));
		process.exit(1);
	}

	// Read current config
	const content = readFileSync(configPath, "utf-8");
	const config = JSON.parse(content);

	// Remove @ prefix if present
	const cleanBacklogUser = backlogUser.startsWith("@")
		? backlogUser.substring(1)
		: backlogUser;

	// Check if there's an auto-discovered mapping
	const autoMapping = config.backlog?.autoMappedAssignees?.[cleanBacklogUser];

	if (!autoMapping) {
		console.error(
			chalk.red(
				`❌ No auto-discovered mapping found for @${cleanBacklogUser}`,
			),
		);
		process.exit(1);
	}

	// Initialize backlog config if needed
	if (!config.backlog) {
		config.backlog = {};
	}
	if (!config.backlog.assigneeMapping) {
		config.backlog.assigneeMapping = {};
	}

	// Move from auto-discovered to explicit
	config.backlog.assigneeMapping[cleanBacklogUser] = autoMapping;
	delete config.backlog.autoMappedAssignees[cleanBacklogUser];

	// Write back to config
	writeFileSync(configPath, JSON.stringify(config, null, 2));

	console.log(
		chalk.green(
			`✓ Promoted auto-discovered mapping to explicit: @${cleanBacklogUser} → ${autoMapping}`,
		),
	);
	logger.info(
		{ backlogUser: cleanBacklogUser, jiraUser: autoMapping },
		"Promoted auto-discovered mapping to explicit",
	);
}

/**
 * Interactive mapping wizard
 */
async function interactiveMapping(): Promise<void> {
	const rl = readline.createInterface({ input, output });
	const jira = new JiraClient(getJiraClientOptions());

	try {
		console.log(chalk.bold.cyan("\n🔗 Interactive Assignee Mapping\n"));
		console.log(
			chalk.gray("Let's map Backlog assignees to Jira user identifiers.\n"),
		);

		// Get Backlog user
		const backlogUser = await rl.question(
			"Backlog assignee (e.g., @john.doe): ",
		);
		if (!backlogUser || backlogUser.trim() === "") {
			console.log(chalk.yellow("Cancelled"));
			return;
		}

		const cleanBacklogUser = backlogUser.startsWith("@")
			? backlogUser.substring(1)
			: backlogUser;

		console.log(
			chalk.gray(
				"\nSearching for Jira users (this may take a moment)...\n",
			),
		);

		// Search for Jira users by name
		const users = await jira.searchUsers(cleanBacklogUser);

		if (users.length === 0) {
			console.log(
				chalk.yellow(
					`No Jira users found matching "${cleanBacklogUser}"`,
				),
			);
			console.log(
				chalk.gray("\nYou can add the mapping manually with:"),
			);
			console.log(
				chalk.cyan(
					`  backlog-jira map-assignees add @${cleanBacklogUser} <jira-user-id>`,
				),
			);
			return;
		}

		// Show candidates
		console.log(chalk.bold("Found Jira users:\n"));
		users.forEach((user, idx) => {
			console.log(
				`[${idx + 1}] ${user.displayName} (${user.emailAddress || user.accountId})`,
			);
		});
		console.log("[0] Cancel");

		const choice = await rl.question("\nSelect user number: ");
		const idx = Number.parseInt(choice, 10);

		if (idx === 0 || Number.isNaN(idx)) {
			console.log(chalk.yellow("Cancelled"));
			return;
		}

		if (idx < 1 || idx > users.length) {
			console.log(chalk.red("Invalid selection"));
			return;
		}

		const selectedUser = users[idx - 1];
		const jiraUserId = selectedUser.emailAddress || selectedUser.accountId;

		// Add mapping
		await addMapping(cleanBacklogUser, jiraUserId, { force: false });
	} catch (error) {
		logger.error({ error }, "Interactive mapping failed");
		console.error(chalk.red(`Error: ${error}`));
		throw error;
	} finally {
		rl.close();
		try { await jira.close(); } catch {}
	}
}

/**
 * Register map-assignees command with CLI
 */
export function registerMapAssigneesCommand(program: Command): void {
	const mapAssigneesCmd = program
		.command("map-assignees")
		.description("Manage Backlog ↔ Jira assignee mappings");

	mapAssigneesCmd
		.command("show")
		.alias("list")
		.description("Show current assignee mappings")
		.action(async () => {
			try {
				await showMappings();
			} catch (error) {
				logger.error({ error }, "Show mappings failed");
				console.error(chalk.red(`Error: ${error}`));
				process.exit(1);
			}
		});

	mapAssigneesCmd
		.command("add")
		.description("Add an assignee mapping")
		.argument("<backlog-user>", "Backlog assignee (e.g., @john.doe)")
		.argument(
			"<jira-user>",
			"Jira user identifier (email, accountId, or display name)",
		)
		.option("--force", "Overwrite existing mapping")
		.action(
			async (
				backlogUser: string,
				jiraUser: string,
				options: { force?: boolean },
			) => {
				try {
					await addMapping(backlogUser, jiraUser, options);
				} catch (error) {
					logger.error({ error }, "Add mapping failed");
					console.error(chalk.red(`Error: ${error}`));
					process.exit(1);
				}
			},
		);

	mapAssigneesCmd
		.command("remove")
		.alias("rm")
		.description("Remove an assignee mapping")
		.argument("<backlog-user>", "Backlog assignee (e.g., @john.doe)")
		.action(async (backlogUser: string) => {
			try {
				await removeMapping(backlogUser);
			} catch (error) {
				logger.error({ error }, "Remove mapping failed");
				console.error(chalk.red(`Error: ${error}`));
				process.exit(1);
			}
		});

	mapAssigneesCmd
		.command("promote")
		.description(
			"Promote an auto-discovered mapping to an explicit mapping (approve)",
		)
		.argument("<backlog-user>", "Backlog assignee (e.g., @john.doe)")
		.action(async (backlogUser: string) => {
			try {
				await promoteMapping(backlogUser);
			} catch (error) {
				logger.error({ error }, "Promote mapping failed");
				console.error(chalk.red(`Error: ${error}`));
				process.exit(1);
			}
		});

	mapAssigneesCmd
		.command("interactive")
		.alias("i")
		.description("Interactively map assignees")
		.action(async () => {
			try {
				await interactiveMapping();
			} catch (error) {
				logger.error({ error }, "Interactive mapping failed");
				console.error(chalk.red(`Error: ${error}`));
				process.exit(1);
			}
		});
}
