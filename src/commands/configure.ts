import { confirm, input, password, select } from "@inquirer/prompts";
import chalk from "chalk";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { JiraConfig } from "./init.ts";
import { JiraClient } from "../integrations/jira.ts";
import { logger } from "../utils/logger.ts";

interface ConfigureOptions {
	nonInteractive?: boolean;
}

interface JiraProjectInfo {
	key: string;
	name: string;
	id: string;
}

/**
 * Interactive wizard to configure Jira connection settings
 */
export async function configureCommand(options: ConfigureOptions = {}): Promise<void> {
	if (options.nonInteractive) {
		console.log(chalk.yellow("Non-interactive mode is not yet implemented."));
		console.log("Please use environment variables for CI/CD setup:");
		console.log("  - JIRA_URL");
		console.log("  - JIRA_EMAIL (for Cloud) or JIRA_PERSONAL_TOKEN (for Server)");
		console.log("  - JIRA_API_TOKEN (for Cloud)");
		process.exit(1);
	}

	console.log(chalk.bold.cyan("\n🔧 Jira Configuration Wizard\n"));
	console.log(chalk.gray("Let's set up your Jira connection step by step.\n"));

	const configDir = join(process.cwd(), ".backlog-jira");

	// Create config directory if it doesn't exist
	if (!existsSync(configDir)) {
		console.log(chalk.yellow("Creating .backlog-jira/ directory...\n"));
		mkdirSync(join(configDir, "logs"), { recursive: true });
	}

	// Step 1: Jira instance type
	console.log(chalk.bold.green("Step 1: Jira Instance Type"));
	console.log(chalk.gray("Select your Jira deployment type.\n"));

	const instanceType = await select<"cloud" | "server">({
		message: "What type of Jira instance are you using?",
		choices: [
			{
				name: "Jira Cloud (atlassian.net)",
				value: "cloud",
				description: "Cloud-hosted Jira from Atlassian",
			},
			{
				name: "Jira Server / Data Center (self-hosted)",
				value: "server",
				description: "Self-hosted Jira installation",
			},
		],
	});

	// Step 2: Jira URL
	console.log(chalk.bold.green("\n\nStep 2: Jira URL"));
	console.log(chalk.gray("Enter your Jira instance URL.\n"));

	let jiraUrl = "";
	let urlValid = false;

	while (!urlValid) {
		jiraUrl = await input({
			message: "Jira URL:",
			default: instanceType === "cloud" ? "https://your-domain.atlassian.net" : "https://jira.yourcompany.com",
			validate: (value) => {
				if (!value || value.trim() === "") {
					return "URL is required";
				}
				if (!value.startsWith("http://") && !value.startsWith("https://")) {
					return "URL must start with http:// or https://";
				}
				if (instanceType === "cloud" && !value.includes("atlassian.net")) {
					return "Cloud URL should contain 'atlassian.net'";
				}
				return true;
			},
		});

		// Remove trailing slash
		jiraUrl = jiraUrl.trim().replace(/\/$/, "");

		// Validate URL format
		try {
			new URL(jiraUrl);
			urlValid = true;
		} catch {
			console.log(chalk.red("Invalid URL format. Please try again.\n"));
		}
	}

	// Step 3: Credentials
	console.log(chalk.bold.green("\n\nStep 3: Authentication"));
	
	let jiraEmail = "";
	let jiraApiToken = "";
	let jiraPersonalToken = "";

	if (instanceType === "cloud") {
		console.log(chalk.gray("For Jira Cloud, you need an API token.\n"));
		console.log(chalk.cyan("To create an API token:"));
		console.log(chalk.cyan("  1. Go to https://id.atlassian.com/manage-profile/security/api-tokens"));
		console.log(chalk.cyan("  2. Click 'Create API token'"));
		console.log(chalk.cyan("  3. Copy the generated token\n"));

		jiraEmail = await input({
			message: "Jira account email:",
			validate: (value) => {
				if (!value || value.trim() === "") {
					return "Email is required";
				}
				if (!value.includes("@")) {
					return "Please enter a valid email address";
				}
				return true;
			},
		});

		jiraApiToken = await password({
			message: "API token:",
			mask: "*",
			validate: (value) => {
				if (!value || value.trim() === "") {
					return "API token is required";
				}
				return true;
			},
		});
	} else {
		console.log(chalk.gray("For Jira Server/Data Center, you need a Personal Access Token.\n"));
		console.log(chalk.cyan("To create a Personal Access Token:"));
		console.log(chalk.cyan("  1. Go to your Jira profile settings"));
		console.log(chalk.cyan("  2. Navigate to 'Personal Access Tokens'"));
		console.log(chalk.cyan("  3. Create a new token with appropriate permissions\n"));

		jiraPersonalToken = await password({
			message: "Personal Access Token:",
			mask: "*",
			validate: (value) => {
				if (!value || value.trim() === "") {
					return "Personal Access Token is required";
				}
				return true;
			},
		});
	}

	// Step 4: Test connection
	console.log(chalk.bold.green("\n\nStep 4: Testing Connection"));
	console.log(chalk.gray("Validating credentials by connecting to Jira...\n"));

	// Temporarily set environment variables for testing
	const originalEnv = {
		JIRA_URL: process.env.JIRA_URL,
		JIRA_EMAIL: process.env.JIRA_EMAIL,
		JIRA_API_TOKEN: process.env.JIRA_API_TOKEN,
		JIRA_PERSONAL_TOKEN: process.env.JIRA_PERSONAL_TOKEN,
	};

	process.env.JIRA_URL = jiraUrl;
	if (instanceType === "cloud") {
		process.env.JIRA_EMAIL = jiraEmail;
		process.env.JIRA_API_TOKEN = jiraApiToken;
		delete process.env.JIRA_PERSONAL_TOKEN;
	} else {
		process.env.JIRA_PERSONAL_TOKEN = jiraPersonalToken;
		delete process.env.JIRA_EMAIL;
		delete process.env.JIRA_API_TOKEN;
	}

	let connectionOk = false;
	let availableProjects: JiraProjectInfo[] = [];

	try {
		const jiraClient = new JiraClient();
		connectionOk = await jiraClient.test();

		if (connectionOk) {
			console.log(chalk.green("✓ Connection successful!\n"));

			// Fetch available projects
			try {
				// Create a new client for fetching projects since test() closes the connection
				const projectsClient = new JiraClient();
				const projects = await projectsClient.getAllProjects();
				availableProjects = projects;
				await projectsClient.close();
			} catch (error) {
				console.log(chalk.yellow("⚠ Could not fetch projects list"));
				logger.debug({ error }, "Failed to fetch projects");
			}
		} else {
			console.log(chalk.red("✗ Connection failed. Please check your credentials.\n"));
			// Restore original environment
			Object.assign(process.env, originalEnv);
			process.exit(1);
		}
	} catch (error) {
		console.log(chalk.red("✗ Connection failed:"));
		console.log(chalk.red(`  ${error instanceof Error ? error.message : String(error)}\n`));
		// Restore original environment
		Object.assign(process.env, originalEnv);
		process.exit(1);
	}

	// Step 5: Project selection
	console.log(chalk.bold.green("\nStep 5: Project Selection"));
	console.log(chalk.gray("Select or enter the Jira project key.\n"));

	let projectKey = "";

	if (availableProjects.length > 0) {
		const projectChoices = availableProjects.map(p => ({
			name: `${p.key} - ${p.name}`,
			value: p.key,
		}));

		projectChoices.push({
			name: "Enter manually",
			value: "___manual___",
		});

		const projectChoice = await select({
			message: "Select your project:",
			choices: projectChoices,
			pageSize: 10,
		});

		if (projectChoice === "___manual___") {
			projectKey = await input({
				message: "Project key (e.g., PROJ, DEV):",
				validate: (value) => {
					if (!value || value.trim() === "") {
						return "Project key is required";
					}
					if (!/^[A-Z][A-Z0-9]*$/.test(value.trim())) {
						return "Project key should be uppercase letters and numbers";
					}
					return true;
				},
			});
		} else {
			projectKey = projectChoice;
		}
	} else {
		projectKey = await input({
			message: "Project key (e.g., PROJ, DEV):",
			validate: (value) => {
				if (!value || value.trim() === "") {
					return "Project key is required";
				}
				if (!/^[A-Z][A-Z0-9]*$/.test(value.trim())) {
					return "Project key should be uppercase letters and numbers";
				}
				return true;
			},
		});
	}

	projectKey = projectKey.trim().toUpperCase();

	// Step 6: Issue type
	console.log(chalk.bold.green("\n\nStep 6: Issue Type"));
	console.log(chalk.gray("What type of issues should be synced?\n"));

	// TODO: In the future, we could fetch available issue types from the project
	const issueType = await select({
		message: "Default issue type:",
		choices: [
			{ name: "Task", value: "Task" },
			{ name: "Story", value: "Story" },
			{ name: "Bug", value: "Bug" },
			{ name: "Epic", value: "Epic" },
			{ name: "Other (enter manually)", value: "___manual___" },
		],
	});

	let finalIssueType = issueType;
	if (issueType === "___manual___") {
		finalIssueType = await input({
			message: "Issue type name:",
			validate: (value) => {
				if (!value || value.trim() === "") {
					return "Issue type is required";
				}
				return true;
			},
		});
	}

	// Step 7: JQL Filter (optional)
	console.log(chalk.bold.green("\n\nStep 7: JQL Filter (Optional)"));
	console.log(chalk.gray("Add a JQL filter to limit which issues are synced.\n"));

	const useJqlFilter = await confirm({
		message: "Do you want to add a JQL filter?",
		default: false,
	});

	let jqlFilter = "";
	if (useJqlFilter) {
		jqlFilter = await input({
			message: "JQL filter (e.g., labels = 'sync' AND status != Done):",
			default: "",
		});
	}

	// Step 8: Status mapping
	console.log(chalk.bold.green("\n\nStep 8: Status Mapping"));
	console.log(chalk.gray("Map Backlog.md statuses to Jira statuses.\n"));

	const useCustomMapping = await confirm({
		message: "Customize status mapping? (default mapping will be used if No)",
		default: false,
	});

	let statusMapping: Record<string, string[]> = {
		"To Do": ["To Do", "Open", "Backlog"],
		"In Progress": ["In Progress"],
		"Done": ["Done", "Closed", "Resolved"],
	};

	if (useCustomMapping) {
		console.log(chalk.cyan("\nDefault mapping:"));
		console.log(chalk.gray("  To Do → To Do, Open, Backlog"));
		console.log(chalk.gray("  In Progress → In Progress"));
		console.log(chalk.gray("  Done → Done, Closed, Resolved\n"));

		// TODO: Could make this more interactive in the future
		console.log(chalk.yellow("Note: Using default mapping for now. Edit .backlog-jira/config.json to customize."));
	}

	// Step 9: Conflict resolution strategy
	console.log(chalk.bold.green("\n\nStep 9: Conflict Resolution Strategy"));
	console.log(chalk.gray("How should conflicts be handled during sync?\n"));

	const conflictStrategy = await select<"prompt" | "prefer-backlog" | "prefer-jira">({
		message: "Conflict resolution strategy:",
		choices: [
			{
				name: "Prompt (ask for each conflict)",
				value: "prompt",
				description: "Interactive resolution for each conflict",
			},
			{
				name: "Prefer Backlog",
				value: "prefer-backlog",
				description: "Automatically use Backlog version when conflicts occur",
			},
			{
				name: "Prefer Jira",
				value: "prefer-jira",
				description: "Automatically use Jira version when conflicts occur",
			},
		],
		default: "prompt",
	});

	// Step 10: Save configuration
	console.log(chalk.bold.green("\n\nStep 10: Save Configuration"));
	console.log(chalk.gray("Review and save your configuration.\n"));

	// Display configuration summary
	console.log(chalk.bold.cyan("Configuration Summary:"));
	console.log(chalk.gray("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"));
	console.log(`  Instance Type: ${instanceType === "cloud" ? "Jira Cloud" : "Jira Server/Data Center"}`);
	console.log(`  Jira URL:      ${jiraUrl}`);
	if (instanceType === "cloud") {
		console.log(`  Email:         ${jiraEmail}`);
		console.log(`  API Token:     ${"*".repeat(Math.min(jiraApiToken.length, 20))}`);
	} else {
		console.log(`  PAT:           ${"*".repeat(Math.min(jiraPersonalToken.length, 20))}`);
	}
	console.log(`  Project Key:   ${projectKey}`);
	console.log(`  Issue Type:    ${finalIssueType}`);
	console.log(`  JQL Filter:    ${jqlFilter || "(none)"}`);
	console.log(`  Conflict:      ${conflictStrategy}`);
	console.log(chalk.gray("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n"));

	const confirmSave = await confirm({
		message: "Save this configuration?",
		default: true,
	});

	if (!confirmSave) {
		console.log(chalk.yellow("\n✗ Configuration cancelled.\n"));
		// Restore original environment
		Object.assign(process.env, originalEnv);
		process.exit(0);
	}

	// Save to config.json
	const configPath = join(configDir, "config.json");
	const config: JiraConfig = {
		jira: {
			baseUrl: jiraUrl,
			projectKey,
			issueType: finalIssueType,
			jqlFilter,
		},
		backlog: {
			statusMapping,
		},
		sync: {
			conflictStrategy,
			enableAnnotations: false,
			watchInterval: 60,
		},
	};

	writeFileSync(configPath, JSON.stringify(config, null, 2));
	console.log(chalk.green(`✓ Configuration saved to ${configPath}`));

	// Ask about .env file
	const saveToEnv = await confirm({
		message: "Save credentials to .env file?",
		default: true,
	});

	if (saveToEnv) {
		const envPath = join(process.cwd(), ".env");
		let envContent = "";

		if (existsSync(envPath)) {
			// Read existing .env and preserve non-JIRA variables
			const existingContent = readFileSync(envPath, "utf-8");
			const lines = existingContent.split("\n");
			const filteredLines = lines.filter(line => {
				const trimmed = line.trim();
				return !trimmed.startsWith("JIRA_") && trimmed !== "";
			});
			if (filteredLines.length > 0) {
				envContent = filteredLines.join("\n") + "\n\n";
			}
		}

		envContent += "# Jira Configuration\n";
		envContent += `JIRA_URL=${jiraUrl}\n`;
		if (instanceType === "cloud") {
			envContent += `JIRA_EMAIL=${jiraEmail}\n`;
			envContent += `JIRA_API_TOKEN=${jiraApiToken}\n`;
		} else {
			envContent += `JIRA_PERSONAL_TOKEN=${jiraPersonalToken}\n`;
		}

		writeFileSync(envPath, envContent);
		console.log(chalk.green(`✓ Credentials saved to ${envPath}`));

		// Check .gitignore
		const gitignorePath = join(process.cwd(), ".gitignore");
		let gitignoreContent = "";
		
		if (existsSync(gitignorePath)) {
			gitignoreContent = readFileSync(gitignorePath, "utf-8");
		}

		if (!gitignoreContent.includes(".env")) {
			console.log(chalk.yellow("\n⚠️  WARNING: .env is not in .gitignore"));
			console.log(chalk.yellow("   Your credentials may be committed to version control!"));
			
			const addToGitignore = await confirm({
				message: "Add .env to .gitignore?",
				default: true,
			});

			if (addToGitignore) {
				const newGitignore = gitignoreContent + (gitignoreContent.endsWith("\n") ? "" : "\n") + ".env\n";
				writeFileSync(gitignorePath, newGitignore);
				console.log(chalk.green("✓ Added .env to .gitignore"));
			}
		}
	}

	// Create .gitignore for .backlog-jira if it doesn't exist
	const backlogGitignorePath = join(configDir, ".gitignore");
	if (!existsSync(backlogGitignorePath)) {
		writeFileSync(
			backlogGitignorePath,
			`# Ignore all files in .backlog-jira/\n*\n!.gitignore\n`,
		);
	}

	// Success!
	console.log(chalk.bold.green("\n✓ Configuration complete!\n"));
	console.log(chalk.cyan("Next steps:"));
	console.log(chalk.gray("  1. Run 'backlog-jira connect' to verify connections"));
	console.log(chalk.gray("  2. Run 'backlog-jira doctor' to check environment setup"));
	console.log(chalk.gray("  3. Start syncing with 'backlog-jira sync --all'\n"));

	// Restore original environment (keeping the new values)
	// This ensures the process continues with the new configuration
}
