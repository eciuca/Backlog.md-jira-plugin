import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import prompts from "prompts";
import chalk from "chalk";
import { JiraClient } from "../integrations/jira.ts";
import { logger } from "../utils/logger.ts";
import type { JiraConfig } from "./init.ts";

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
export async function configureCommand(
	options: ConfigureOptions = {},
): Promise<void> {
	if (options.nonInteractive) {
		console.log(chalk.yellow("Non-interactive mode is not yet implemented."));
		console.log("Please use environment variables for CI/CD setup:");
		console.log("  - JIRA_URL");
		console.log(
			"  - JIRA_EMAIL (for Cloud) or JIRA_PERSONAL_TOKEN (for Server)",
		);
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

	const instanceTypeResponse = await prompts({
		type: "select",
		name: "instanceType",
		message: "What type of Jira instance are you using?",
		choices: [
			{
				title: "Jira Cloud (atlassian.net)",
				value: "cloud",
				description: "Cloud-hosted Jira from Atlassian",
			},
			{
				title: "Jira Server / Data Center (self-hosted)",
				value: "server",
				description: "Self-hosted Jira installation",
			},
		],
	});

	if (!instanceTypeResponse.instanceType) {
		console.log(chalk.yellow("\n✗ Configuration cancelled.\n"));
		process.exit(0);
	}

	const instanceType = instanceTypeResponse.instanceType as "cloud" | "server";

	// Step 2: Jira URL
	console.log(chalk.bold.green("\n\nStep 2: Jira URL"));
	console.log(chalk.gray("Enter your Jira instance URL.\n"));

	let jiraUrl = "";
	let urlValid = false;

	while (!urlValid) {
		const urlResponse = await prompts({
			type: "text",
			name: "url",
			message: "Jira URL:",
			initial:
				instanceType === "cloud"
					? "https://your-domain.atlassian.net"
					: "https://jira.yourcompany.com",
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

		if (!urlResponse.url) {
			console.log(chalk.yellow("\n✗ Configuration cancelled.\n"));
			process.exit(0);
		}

		jiraUrl = urlResponse.url;

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
		console.log(
			chalk.cyan(
				"  1. Go to https://id.atlassian.com/manage-profile/security/api-tokens",
			),
		);
		console.log(chalk.cyan("  2. Click 'Create API token'"));
		console.log(chalk.cyan("  3. Copy the generated token\n"));

		const emailResponse = await prompts({
			type: "text",
			name: "email",
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

		if (!emailResponse.email) {
			console.log(chalk.yellow("\n✗ Configuration cancelled.\n"));
			process.exit(0);
		}

		jiraEmail = emailResponse.email;

		const tokenResponse = await prompts({
			type: "password",
			name: "token",
			message: "API token:",
			validate: (value) => {
				if (!value || value.trim() === "") {
					return "API token is required";
				}
				return true;
			},
		});

		if (!tokenResponse.token) {
			console.log(chalk.yellow("\n✗ Configuration cancelled.\n"));
			process.exit(0);
		}

		jiraApiToken = tokenResponse.token;
	} else {
		console.log(
			chalk.gray(
				"For Jira Server/Data Center, you need a Personal Access Token.\n",
			),
		);
		console.log(chalk.cyan("To create a Personal Access Token:"));
		console.log(chalk.cyan("  1. Go to your Jira profile settings"));
		console.log(chalk.cyan("  2. Navigate to 'Personal Access Tokens'"));
		console.log(
			chalk.cyan("  3. Create a new token with appropriate permissions\n"),
		);

		const patResponse = await prompts({
			type: "password",
			name: "pat",
			message: "Personal Access Token:",
			validate: (value) => {
				if (!value || value.trim() === "") {
					return "Personal Access Token is required";
				}
				return true;
			},
		});

		if (!patResponse.pat) {
			console.log(chalk.yellow("\n✗ Configuration cancelled.\n"));
			process.exit(0);
		}

	jiraPersonalToken = patResponse.pat;
	}

	// Step 4: MCP Server Configuration (Optional)
	console.log(chalk.bold.green("\n\nStep 4: MCP Server Configuration (Optional)"));
	console.log(
		chalk.gray(
			"Configure additional arguments and environment variables for the MCP server.\n",
		),
	);

	const mcpEnvVars: Record<string, string> = {};
	const mcpServerArgs: string[] = [];

	// First ask about server arguments
	const useMcpArgsResponse = await prompts({
		type: "confirm",
		name: "useMcpArgs",
		message: "Do you want to configure MCP server arguments (e.g., Docker options like --dns)?",
		initial: false,
	});

	if (useMcpArgsResponse.useMcpArgs === undefined) {
		console.log(chalk.yellow("\n✗ Configuration cancelled.\n"));
		process.exit(0);
	}

	if (useMcpArgsResponse.useMcpArgs) {
		console.log(chalk.cyan("\nEnter server arguments one by one."));
		console.log(chalk.gray("Examples: --dns 8.8.8.8, --dns-search company.com"));
		console.log(chalk.gray("Leave empty to finish.\n"));

		let addingArgs = true;
		while (addingArgs) {
			const argResponse = await prompts({
				type: "text",
				name: "arg",
				message: "Server argument:",
			});

			if (argResponse.arg === undefined) {
				console.log(chalk.yellow("\n✗ Configuration cancelled.\n"));
				process.exit(0);
			}

			const arg = argResponse.arg.trim();

			// Empty arg means done
			if (arg === "") {
				addingArgs = false;
				continue;
			}

			mcpServerArgs.push(arg);
			console.log(chalk.green(`  ✓ Added argument: ${arg}\n`));
		}

		if (mcpServerArgs.length > 0) {
			console.log(chalk.cyan("\nConfigured server arguments:"));
			for (const arg of mcpServerArgs) {
				console.log(chalk.gray(`  ${arg}`));
			}
			console.log();
		}
	}

	// Then ask about environment variables
	const useMcpEnvResponse = await prompts({
		type: "confirm",
		name: "useMcpEnv",
		message: "Do you want to configure additional MCP server environment variables?",
		initial: false,
	});

	if (useMcpEnvResponse.useMcpEnv === undefined) {
		console.log(chalk.yellow("\n✗ Configuration cancelled.\n"));
		process.exit(0);
	}

	if (useMcpEnvResponse.useMcpEnv) {
		console.log(chalk.cyan("\nEnter key-value pairs for environment variables."));
		console.log(chalk.gray("Leave the key empty to finish.\n"));

		let addingVars = true;
		while (addingVars) {
			const keyResponse = await prompts({
				type: "text",
				name: "key",
				message: "Environment variable name:",
				validate: (value) => {
					// Empty means done
					if (value.trim() === "") {
						return true;
					}
					// Check for valid env var name
					if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(value)) {
						return "Invalid variable name. Use only letters, numbers, and underscores.";
					}
					// Check if already exists
					if (mcpEnvVars[value]) {
						return "This variable already exists.";
					}
					return true;
				},
			});

			if (keyResponse.key === undefined) {
				console.log(chalk.yellow("\n✗ Configuration cancelled.\n"));
				process.exit(0);
			}

			const key = keyResponse.key.trim();

			// Empty key means done
			if (key === "") {
				addingVars = false;
				continue;
			}

			const valueResponse = await prompts({
				type: "text",
				name: "value",
				message: `Value for ${key}:`,
				validate: (value) => {
					if (value === undefined || value === null) {
						return "Value is required";
					}
					return true;
				},
			});

			if (valueResponse.value === undefined) {
				console.log(chalk.yellow("\n✗ Configuration cancelled.\n"));
				process.exit(0);
			}

			mcpEnvVars[key] = valueResponse.value;
			console.log(chalk.green(`  ✓ Added ${key}\n`));
		}

		if (Object.keys(mcpEnvVars).length > 0) {
			console.log(chalk.cyan("\nConfigured environment variables:"));
			for (const [key, value] of Object.entries(mcpEnvVars)) {
				console.log(chalk.gray(`  ${key}: ${"*".repeat(Math.min(value.length, 20))}`));
			}
			console.log();
		}
	}

	// Step 5: Test connection
	console.log(chalk.bold.green("\n\nStep 5: Testing Connection"));
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
		process.env.JIRA_PERSONAL_TOKEN = undefined;
	} else {
		process.env.JIRA_PERSONAL_TOKEN = jiraPersonalToken;
		process.env.JIRA_EMAIL = undefined;
		process.env.JIRA_API_TOKEN = undefined;
	}

	// Apply MCP environment variables for testing
	for (const [key, value] of Object.entries(mcpEnvVars)) {
		process.env[key] = value;
	}

	let connectionOk = false;
	let availableProjects: JiraProjectInfo[] = [];

	try {
		// Pass MCP server arguments to JiraClient for testing
		const jiraClient = new JiraClient({
			dockerArgs: mcpServerArgs,
		});
		connectionOk = await jiraClient.test();

		if (connectionOk) {
			console.log(chalk.green("✓ Connection successful!\n"));

			// Fetch available projects
			try {
				// Create a new client for fetching projects since test() closes the connection
				const projectsClient = new JiraClient({
					dockerArgs: mcpServerArgs,
				});
				const projects = await projectsClient.getAllProjects();
				availableProjects = projects;
				await projectsClient.close();
			} catch (error) {
				console.log(chalk.yellow("⚠ Could not fetch projects list"));
				logger.debug({ error }, "Failed to fetch projects");
			}
		} else {
			console.log(
				chalk.red("✗ Connection failed. Please check your credentials.\n"),
			);
			// Restore original environment
			Object.assign(process.env, originalEnv);
			process.exit(1);
		}
	} catch (error) {
		console.log(chalk.red("✗ Connection failed:"));
		console.log(
			chalk.red(
				`  ${error instanceof Error ? error.message : String(error)}\n`,
			),
		);
		// Restore original environment
		Object.assign(process.env, originalEnv);
		process.exit(1);
	}

	// Step 6: Project selection
	console.log(chalk.bold.green("\nStep 6: Project Selection"));
	console.log(chalk.gray("Select or enter the Jira project key.\n"));

	let projectKey = "";

	if (availableProjects.length > 0) {
		const projectChoices = availableProjects.map((p) => ({
			name: `${p.key} - ${p.name}`,
			value: p.key,
		}));

		projectChoices.push({
			name: "Enter manually",
			value: "___manual___",
		});

		const projectChoiceResponse = await prompts({
			type: "select",
			name: "choice",
			message: "Select your project:",
			choices: projectChoices.map((c) => ({
				title: c.name,
				value: c.value,
			})),
		});

		if (!projectChoiceResponse.choice) {
			console.log(chalk.yellow("\n✗ Configuration cancelled.\n"));
			process.exit(0);
		}

		const projectChoice = projectChoiceResponse.choice;

		if (projectChoice === "___manual___") {
			const keyResponse = await prompts({
				type: "text",
				name: "key",
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

			if (!keyResponse.key) {
				console.log(chalk.yellow("\n✗ Configuration cancelled.\n"));
				process.exit(0);
			}

			projectKey = keyResponse.key;
		} else {
			projectKey = projectChoice;
		}
	} else {
		const keyResponse = await prompts({
			type: "text",
			name: "key",
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

		if (!keyResponse.key) {
			console.log(chalk.yellow("\n✗ Configuration cancelled.\n"));
			process.exit(0);
		}

		projectKey = keyResponse.key;
	}

	projectKey = projectKey.trim().toUpperCase();

	// Step 7: Issue type
	console.log(chalk.bold.green("\n\nStep 7: Issue Type"));
	console.log(chalk.gray("What type of issues should be synced?\n"));

	// TODO: In the future, we could fetch available issue types from the project
	const issueTypeResponse = await prompts({
		type: "select",
		name: "issueType",
		message: "Default issue type:",
		choices: [
			{ title: "Task", value: "Task" },
			{ title: "Story", value: "Story" },
			{ title: "Bug", value: "Bug" },
			{ title: "Epic", value: "Epic" },
			{ title: "Other (enter manually)", value: "___manual___" },
		],
	});

	if (!issueTypeResponse.issueType) {
		 console.log(chalk.yellow("\n✗ Configuration cancelled.\n"));
			process.exit(0);
	}

	const issueType = issueTypeResponse.issueType;

	let finalIssueType = issueType;
	if (issueType === "___manual___") {
		const typeResponse = await prompts({
			type: "text",
			name: "type",
			message: "Issue type name:",
			validate: (value) => {
				if (!value || value.trim() === "") {
					return "Issue type is required";
				}
				return true;
			},
		});

		if (!typeResponse.type) {
			console.log(chalk.yellow("\n✗ Configuration cancelled.\n"));
			process.exit(0);
		}

		finalIssueType = typeResponse.type;
	}

	// Step 8: JQL Filter (optional)
	console.log(chalk.bold.green("\n\nStep 8: JQL Filter (Optional)"));
	console.log(
		chalk.gray("Add a JQL filter to limit which issues are synced.\n"),
	);

	const jqlFilterResponse = await prompts({
		type: "confirm",
		name: "useJqlFilter",
		message: "Do you want to add a JQL filter?",
		initial: false,
	});

	if (jqlFilterResponse.useJqlFilter === undefined) {
		console.log(chalk.yellow("\n✗ Configuration cancelled.\n"));
		process.exit(0);
	}

	let jqlFilter = "";
	if (jqlFilterResponse.useJqlFilter) {
		const filterResponse = await prompts({
			type: "text",
			name: "filter",
			message: "JQL filter (e.g., labels = 'sync' AND status != Done):",
			initial: "",
		});

		if (filterResponse.filter === undefined) {
			console.log(chalk.yellow("\n✗ Configuration cancelled.\n"));
			process.exit(0);
		}

		jqlFilter = filterResponse.filter;
	}

	// Step 9: Status mapping
	console.log(chalk.bold.green("\n\nStep 9: Status Mapping"));
	console.log(chalk.gray("Map Backlog.md statuses to Jira statuses.\n"));

	const mappingResponse = await prompts({
		type: "confirm",
		name: "useCustomMapping",
		message: "Customize status mapping? (default mapping will be used if No)",
		initial: false,
	});

	if (mappingResponse.useCustomMapping === undefined) {
		console.log(chalk.yellow("\n✗ Configuration cancelled.\n"));
		process.exit(0);
	}

	const useCustomMapping = mappingResponse.useCustomMapping;

	const statusMapping: Record<string, string[]> = {
		"To Do": ["To Do", "Open", "Backlog"],
		"In Progress": ["In Progress"],
		Done: ["Done", "Closed", "Resolved"],
	};

	if (useCustomMapping) {
		console.log(chalk.cyan("\nDefault mapping:"));
		console.log(chalk.gray("  To Do → To Do, Open, Backlog"));
		console.log(chalk.gray("  In Progress → In Progress"));
		console.log(chalk.gray("  Done → Done, Closed, Resolved\n"));

		// TODO: Could make this more interactive in the future
		console.log(
			chalk.yellow(
				"Note: Using default mapping for now. Edit .backlog-jira/config.json to customize.",
			),
		);
	}

	// Step 10: Conflict resolution strategy
	console.log(chalk.bold.green("\n\nStep 10: Conflict Resolution Strategy"));
	console.log(chalk.gray("How should conflicts be handled during sync?\n"));

	const conflictStrategyResponse = await prompts({
		type: "select",
		name: "strategy",
		message: "Conflict resolution strategy:",
		choices: [
			{
				title: "Prompt (ask for each conflict)",
				value: "prompt",
				description: "Interactive resolution for each conflict",
			},
			{
				title: "Prefer Backlog",
				value: "prefer-backlog",
				description: "Automatically use Backlog version when conflicts occur",
			},
			{
				title: "Prefer Jira",
				value: "prefer-jira",
				description: "Automatically use Jira version when conflicts occur",
			},
		],
		initial: 0,
	});

	if (!conflictStrategyResponse.strategy) {
		console.log(chalk.yellow("\n✗ Configuration cancelled.\n"));
		process.exit(0);
	}

	const conflictStrategy = conflictStrategyResponse.strategy as
		| "prompt"
		| "prefer-backlog"
		| "prefer-jira";

	// Step 11: Save configuration
	console.log(chalk.bold.green("\n\nStep 11: Save Configuration"));
	console.log(chalk.gray("Review and save your configuration.\n"));

	// Display configuration summary
	console.log(chalk.bold.cyan("Configuration Summary:"));
	console.log(chalk.gray("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"));
	console.log(
		`  Instance Type: ${instanceType === "cloud" ? "Jira Cloud" : "Jira Server/Data Center"}`,
	);
	console.log(`  Jira URL:      ${jiraUrl}`);
	if (instanceType === "cloud") {
		console.log(`  Email:         ${jiraEmail}`);
		console.log(
			`  API Token:     ${"*".repeat(Math.min(jiraApiToken.length, 20))}`,
		);
	} else {
		console.log(
			`  PAT:           ${"*".repeat(Math.min(jiraPersonalToken.length, 20))}`,
		);
	}
	console.log(`  Project Key:   ${projectKey}`);
	console.log(`  Issue Type:    ${finalIssueType}`);
	console.log(`  JQL Filter:    ${jqlFilter || "(none)"}`);
	console.log(`  Conflict:      ${conflictStrategy}`);
	console.log(chalk.gray("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n"));

	const confirmSaveResponse = await prompts({
		type: "confirm",
		name: "confirmSave",
		message: "Save this configuration?",
		initial: true,
	});

	if (
		confirmSaveResponse.confirmSave === undefined ||
		!confirmSaveResponse.confirmSave
	) {
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

	// Add MCP configuration if server args or env vars were configured
	if (mcpServerArgs.length > 0 || Object.keys(mcpEnvVars).length > 0) {
		config.mcp = {};
		if (mcpServerArgs.length > 0) {
			config.mcp.serverArgs = mcpServerArgs;
		}
		if (Object.keys(mcpEnvVars).length > 0) {
			config.mcp.envVars = mcpEnvVars;
		}
	}

	writeFileSync(configPath, JSON.stringify(config, null, 2));
	console.log(chalk.green(`✓ Configuration saved to ${configPath}`));

	// Ask about .env file
	const saveToEnvResponse = await prompts({
		type: "confirm",
		name: "saveToEnv",
		message: "Save credentials to .env file?",
		initial: true,
	});

	if (saveToEnvResponse.saveToEnv === undefined) {
		console.log(chalk.yellow("\n✗ Configuration cancelled.\n"));
		process.exit(0);
	}

	const saveToEnv = saveToEnvResponse.saveToEnv;

	if (saveToEnv) {
		const envPath = join(process.cwd(), ".env");
		let envContent = "";

		if (existsSync(envPath)) {
			// Read existing .env and preserve non-JIRA variables
			const existingContent = readFileSync(envPath, "utf-8");
			const lines = existingContent.split("\n");
			const filteredLines = lines.filter((line) => {
				const trimmed = line.trim();
				return !trimmed.startsWith("JIRA_") && trimmed !== "";
			});
			if (filteredLines.length > 0) {
				envContent = `${filteredLines.join("\n")}\n\n`;
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

		// Add MCP environment variables if configured
		if (Object.keys(mcpEnvVars).length > 0) {
			envContent += "\n# MCP Server Environment Variables\n";
			for (const [key, value] of Object.entries(mcpEnvVars)) {
				envContent += `${key}=${value}\n`;
			}
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
			console.log(
				chalk.yellow(
					"   Your credentials may be committed to version control!",
				),
			);

			const addToGitignoreResponse = await prompts({
				type: "confirm",
				name: "addToGitignore",
				message: "Add .env to .gitignore?",
				initial: true,
			});

			if (addToGitignoreResponse.addToGitignore === undefined) {
				console.log(chalk.yellow("\n✗ Configuration cancelled.\n"));
				process.exit(0);
			}

			if (addToGitignoreResponse.addToGitignore) {
				const newGitignore = `${gitignoreContent + (gitignoreContent.endsWith("\n") ? "" : "\n")}.env\n`;
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
			"# Ignore all files in .backlog-jira/\n*\n!.gitignore\n",
		);
	}

	// Success!
	console.log(chalk.bold.green("\n✓ Configuration complete!\n"));
	console.log(chalk.cyan("Next steps:"));
	console.log(
		chalk.gray("  1. Run 'backlog-jira connect' to verify connections"),
	);
	console.log(
		chalk.gray("  2. Run 'backlog-jira doctor' to check environment setup"),
	);
	console.log(
		chalk.gray("  3. Start syncing with 'backlog-jira sync --all'\n"),
	);

	// Restore original environment (keeping the new values)
	// This ensures the process continues with the new configuration

	// Exit cleanly to return control to the terminal
	// Without this, the prompts library keeps stdin open and the terminal hangs
	process.exit(0);
}
