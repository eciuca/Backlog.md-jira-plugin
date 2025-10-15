import { existsSync, mkdirSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import chalk from "chalk";
import prompts from "prompts";
import { SyncStore } from "../state/store.ts";
import {
	type InstructionMode,
	addAgentInstructions,
} from "../utils/agent-instructions.ts";
import { logger } from "../utils/logger.ts";

export interface JiraConfig {
	jira: {
		baseUrl: string;
		projectKey: string;
		issueType: string;
		jqlFilter: string;
	};
	backlog: {
		statusMapping: Record<string, string[]>;
	};
	sync: {
		conflictStrategy: "prompt" | "prefer-backlog" | "prefer-jira";
		enableAnnotations: boolean;
		watchInterval: number;
	};
	mcp?: {
		serverArgs?: string[];
		envVars?: Record<string, string>;
	};
}

export interface InitCommandOptions {
	baseDir?: string;
}

export async function initCommand(
	options: InitCommandOptions = {},
): Promise<void> {
	const baseDir = options.baseDir || process.cwd();
	const configDir = join(baseDir, ".backlog-jira");

	// Check if already initialized
	if (existsSync(configDir)) {
		logger.warn(
			".backlog-jira/ already exists. Use 'backlog-jira config' to modify settings.",
		);
		return;
	}

	// Bootstrap directory structure
	mkdirSync(join(configDir, "logs"), { recursive: true });

	// Create default configuration
	const config: JiraConfig = {
		jira: {
			baseUrl: "",
			projectKey: "",
			issueType: "Task",
			jqlFilter: "",
		},
		backlog: {
			statusMapping: {
				"To Do": ["To Do", "Open", "Backlog"],
				"In Progress": ["In Progress"],
				Done: ["Done", "Closed", "Resolved"],
			},
		},
		sync: {
			conflictStrategy: "prompt",
			enableAnnotations: false,
			watchInterval: 60,
		},
	};

	const configPath = join(configDir, "config.json");
	writeFileSync(configPath, JSON.stringify(config, null, 2));

	// Initialize SQLite database
	const dbPath = join(configDir, "jira-sync.db");
	const store = new SyncStore(dbPath);
	store.close();

	// Create .gitignore
	const gitignorePath = join(configDir, ".gitignore");
	writeFileSync(
		gitignorePath,
		`# Ignore all files in .backlog-jira/
*
!.gitignore
`,
	);

	// Agent instructions setup
	await setupAgentInstructions(baseDir);

	logger.info("");
	logger.info("✓ Initialized .backlog-jira/ configuration");
	logger.info(`  - Config: ${configPath}`);
	logger.info(`  - Database: ${join(configDir, "jira-sync.db")}`);
	logger.info(`  - Logs: ${join(configDir, "logs/")}`);
	logger.info("");
	logger.info("Next steps:");
	logger.info(
		"  1. Edit .backlog-jira/config.json with your Jira project settings",
	);
	logger.info("  2. Run 'backlog-jira connect' to verify connections");
	logger.info("  3. Run 'backlog-jira doctor' to check environment setup");
}

/**
 * Setup agent instructions for agent instruction files (AGENTS.md, CLAUDE.md, etc.)
 */
async function setupAgentInstructions(projectRoot: string): Promise<void> {
	console.log(chalk.bold.cyan("\n🤖 Agent Instructions Setup\n"));
	console.log(
		chalk.gray(
			"Would you like to add backlog-jira plugin guidelines to your agent instruction files?\n",
		),
	);

	const response = await prompts({
		type: "confirm",
		name: "shouldSetup",
		message: "Add plugin guidelines to agent instruction files?",
		initial: true,
	});

	// Handle user cancellation (Ctrl+C)
	if (response.shouldSetup === undefined) {
		logger.info("Setup cancelled.");
		return;
	}

	const shouldSetup = response.shouldSetup;

	if (!shouldSetup) {
		logger.info(
			"Skipping agent instructions setup. You can add them later manually.",
		);
		return;
	}

	// Find agent instruction files in the project root
	const commonAgentFiles = [
		"AGENTS.md",
		"CLAUDE.md",
		"CURSOR.md",
		"AI.md",
		".cursorrules",
		".github/AGENTS.md",
	];

	const existingFiles = commonAgentFiles
		.map((file) => join(projectRoot, file))
		.filter((filePath) => existsSync(filePath));

	if (existingFiles.length === 0) {
		console.log(
			chalk.yellow(
				"No agent instruction files found in project root (AGENTS.md, CLAUDE.md, etc.)",
			),
		);
		console.log(
			chalk.gray(
				"Create an agent instruction file first, then re-run initialization.",
			),
		);
		return;
	}

	// Select files to update
	console.log(
		chalk.green(`\nFound ${existingFiles.length} agent instruction file(s):\n`),
	);

	const filesResponse = await prompts({
		type: "multiselect",
		name: "selectedFiles",
		message: "Select files to update:",
		choices: existingFiles.map((filePath) => ({
			title: filePath.replace(`${projectRoot}/`, ""),
			value: filePath,
			selected: true,
		})),
		min: 1,
		instructions: false,
	});

	// Handle user cancellation (Ctrl+C)
	if (filesResponse.selectedFiles === undefined) {
		logger.info("Setup cancelled.");
		return;
	}

	const selectedFiles = filesResponse.selectedFiles;

	if (selectedFiles.length === 0) {
		logger.info("No files selected. Skipping agent instructions setup.");
		return;
	}

	// Select instruction mode
	console.log(chalk.cyan("\nChoose how agent instructions should be added:\n"));
	console.log(
		chalk.gray("  CLI Mode: Embeds comprehensive plugin guidelines directly"),
	);
	console.log(
		chalk.gray("  MCP Mode: Adds a short nudge to read MCP resources\n"),
	);

	const modeResponse = await prompts({
		type: "select",
		name: "mode",
		message: "Select instruction mode:",
		choices: [
			{
				title:
					"CLI Mode - Embedded guidelines (recommended for CLI-only usage)",
				value: "cli",
				description: "Add comprehensive documentation directly to the file",
			},
			{
				title:
					"MCP Mode - Reference to MCP resources (recommended if using MCP server)",
				value: "mcp",
				description: "Add a short reference to read MCP resources for details",
			},
		],
		initial: 0,
	});

	// Handle user cancellation (Ctrl+C)
	if (modeResponse.mode === undefined) {
		logger.info("Setup cancelled.");
		return;
	}

	const mode = modeResponse.mode as InstructionMode;

	// Apply instructions to selected files
	console.log(
		chalk.cyan(
			`\nAdding ${mode.toUpperCase()} mode instructions to ${selectedFiles.length} file(s)...\n`,
		),
	);

	for (const filePath of selectedFiles) {
		const fileName = filePath.replace(`${projectRoot}/`, "");
		const result = addAgentInstructions(filePath, mode);

		if (result.success) {
			console.log(chalk.green(`  ✓ ${fileName}`));
		} else {
			console.log(chalk.red(`  ✗ ${fileName}: ${result.message}`));
		}
	}

	console.log(
		chalk.green(
			`\n✓ Agent instructions updated successfully in ${mode.toUpperCase()} mode`,
		),
	);
	console.log(
		chalk.gray(
			"  Guidelines are wrapped with HTML comment markers for easy updates.",
		),
	);
	console.log(
		chalk.gray(
			"  Re-run 'backlog-jira init' to switch modes or update guidelines.",
		),
	);

	// Optional: Commit changes to git
	await offerGitCommit(selectedFiles, mode);
}

/**
 * Offer to commit agent instruction changes to git
 */
async function offerGitCommit(
	files: string[],
	mode: InstructionMode,
): Promise<void> {
	// Check if we're in a git repository
	const { exec } = await import("node:child_process");
	const { promisify } = await import("node:util");
	const execAsync = promisify(exec);
	const projectRoot = files[0] ? join(files[0], "..") : process.cwd();

	try {
		// Check if git is available and we're in a git repo
		await execAsync("git rev-parse --git-dir", { cwd: projectRoot });
	} catch {
		// Not a git repository or git not available
		return;
	}

	// Check if there are unstaged changes in the modified files
	const relativeFiles = files.map((f) => f.replace(`${projectRoot}/`, ""));

	try {
		// Check status of modified files
		const { stdout: statusOutput } = await execAsync(
			`git status --porcelain ${relativeFiles.join(" ")}`,
			{ cwd: projectRoot },
		);

		if (!statusOutput.trim()) {
			// No changes to commit
			return;
		}

		console.log(chalk.cyan("\n💾 Git Commit\n"));

		const commitResponse = await prompts({
			type: "confirm",
			name: "shouldCommit",
			message: "Commit agent instruction changes to git?",
			initial: false,
		});

		// Handle user cancellation (Ctrl+C)
		if (commitResponse.shouldCommit === undefined) {
			return;
		}

		const shouldCommit = commitResponse.shouldCommit;

		if (!shouldCommit) {
			return;
		}

		// Stage the files
		await execAsync(`git add ${relativeFiles.join(" ")}`, {
			cwd: projectRoot,
		});

		// Commit with a descriptive message
		const commitMessage = `chore: add backlog-jira ${mode.toUpperCase()} guidelines to agent instructions

Updated files:
${relativeFiles.map((f) => `- ${f}`).join("\n")}

Mode: ${mode.toUpperCase()}
Added via: backlog-jira init`;

		await execAsync(`git commit -m ${JSON.stringify(commitMessage)}`, {
			cwd: projectRoot,
		});

		console.log(chalk.green("✓ Changes committed to git"));
	} catch (error) {
		logger.debug({ error }, "Git commit failed");
		console.log(chalk.yellow("⚠️  Could not commit changes automatically"));
		console.log(chalk.gray("  You can commit the changes manually later."));
	}
}
