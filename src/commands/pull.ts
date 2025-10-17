import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { BacklogClient, type BacklogTask } from "../integrations/backlog.ts";
import {
	JiraClient,
	type JiraClientOptions,
	type JiraIssue,
} from "../integrations/jira.ts";
import { FrontmatterStore } from "../state/store.ts";
import { getTaskFilePath, updateJiraMetadata } from "../utils/frontmatter.ts";
import { getJiraClientOptions } from "../utils/jira-config.ts";
import { logger } from "../utils/logger.ts";
import {
	computeHash,
	normalizeBacklogTask,
	normalizeJiraIssue,
	stripAcceptanceCriteriaFromDescription,
} from "../utils/normalizer.ts";
import { mapJiraPriorityToBacklog } from "../utils/priority-mapping.ts";
import { mapJiraStatusToBacklog } from "../utils/status-mapping.ts";
import { classifySyncState } from "../utils/sync-state.ts";

export interface PullOptions {
	taskIds?: string[];
	all?: boolean;
	import?: boolean;
	jql?: string;
	force?: boolean;
	dryRun?: boolean;
	verbose?: boolean;
}

export interface PullResult {
	success: boolean;
	pulled: string[];
	imported: string[];
	failed: Array<{ taskId: string; error: string }>;
	skipped: string[];
}

/**
 * Pull Jira issues to Backlog tasks
 * Updates existing mapped tasks via CLI only (no direct file writes)
 */
export async function pull(options: PullOptions = {}): Promise<PullResult> {
	// Set log level based on verbose flag
	const originalLevel = logger.level;
	if (!options.verbose) {
		logger.level = "error"; // Suppress info/debug logs in non-verbose mode
	}

	logger.info({ options }, "Starting pull operation");

	const store = new FrontmatterStore();
	const backlog = new BacklogClient();
	const jira = new JiraClient(getJiraClientOptions());

	const result: PullResult = {
		success: true,
		pulled: [],
		imported: [],
		failed: [],
		skipped: [],
	};

	try {
		// Get list of tasks to pull and issues to import
		const { mapped, unmapped } = await getTaskIds(
			options,
			backlog,
			jira,
			store,
		);

		logger.info(
			{ mappedCount: mapped.length, unmappedCount: unmapped.length },
			"Tasks to process",
		);

		// First, import unmapped issues if in import mode
		if (options.import && unmapped.length > 0) {
			logger.info({ count: unmapped.length }, "Importing unmapped issues");
			const batchSize = 10;
			for (let i = 0; i < unmapped.length; i += batchSize) {
				const batch = unmapped.slice(i, i + batchSize);
				const promises = batch.map(async (jiraKey) => {
					try {
						const taskId = await importJiraIssue(jiraKey, {
							store,
							backlog,
							jira,
							dryRun: options.dryRun || false,
						});

						result.imported.push(taskId);
						logger.info({ taskId, jiraKey }, "Successfully imported issue");
					} catch (error) {
						const errorMsg =
							error instanceof Error ? error.message : String(error);
						result.failed.push({ taskId: jiraKey, error: errorMsg });
						logger.error(
							{ jiraKey, error: errorMsg },
							"Failed to import issue",
						);
						result.success = false;
					}
				});

				await Promise.all(promises);
			}
		}

		// Then, pull mapped tasks
		if (mapped.length > 0) {
			logger.info({ count: mapped.length }, "Pulling mapped tasks");
			const batchSize = 10;
			for (let i = 0; i < mapped.length; i += batchSize) {
				const batch = mapped.slice(i, i + batchSize);
				const promises = batch.map(async (taskId) => {
					try {
						await pullTask(taskId, {
							store,
							backlog,
							jira,
							force: options.force || false,
							dryRun: options.dryRun || false,
						});

						result.pulled.push(taskId);
						logger.info({ taskId }, "Successfully pulled task");
					} catch (error) {
						const errorMsg =
							error instanceof Error ? error.message : String(error);
						result.failed.push({ taskId, error: errorMsg });
						logger.error({ taskId, error: errorMsg }, "Failed to pull task");
						result.success = false;
					}
				});

				await Promise.all(promises);
			}
		}

		store.logOperation(
			"pull",
			null,
			null,
			result.success ? "success" : "partial",
			JSON.stringify(result),
		);
	} finally {
		store.close();
		await jira.close();
		// Restore original log level
		logger.level = originalLevel;
	}

	logger.info({ result }, "Pull operation completed");
	process.exit(0);
	return result;
}

/**
 * Get list of task IDs to pull
 * Returns { mapped: taskIds, unmapped: jiraKeys }
 */
async function getTaskIds(
	options: PullOptions,
	backlog: BacklogClient,
	jira: JiraClient,
	store: SyncStore,
): Promise<{ mapped: string[]; unmapped: string[] }> {
	if (options.taskIds && options.taskIds.length > 0) {
		return { mapped: options.taskIds, unmapped: [] };
	}

	if (options.all) {
		// Get all tasks that have mappings
		const mappings = store.getAllMappings();
		return { mapped: Array.from(mappings.keys()), unmapped: [] };
	}

	// Import mode: fetch Jira issues via JQL
	if (options.import) {
		return await getIssuesForImport(options, jira, store);
	}

	// Default: get tasks that need pull (changed on Jira side)
	const mappings = store.getAllMappings();
	const needsPull: string[] = [];

	for (const [taskId, jiraKey] of mappings) {
		try {
			const task = await backlog.getTask(taskId);
			const issue = await jira.getIssue(jiraKey);

			const backlogHash = computeHash(normalizeBacklogTask(task));
			const jiraHash = computeHash(normalizeJiraIssue(issue));

			const snapshots = store.getSnapshots(taskId);
			const state = classifySyncState(
				backlogHash,
				jiraHash,
				snapshots.backlog,
				snapshots.jira,
			);

			if (state.state === "NeedsPull") {
				needsPull.push(taskId);
			}
		} catch (error) {
			logger.warn({ taskId, jiraKey, error }, "Failed to check sync state");
		}
	}

	return { mapped: needsPull, unmapped: [] };
}

/**
 * Get Jira issues for import using JQL filter
 */
async function getIssuesForImport(
	options: PullOptions,
	jira: JiraClient,
	store: SyncStore,
): Promise<{ mapped: string[]; unmapped: string[] }> {
	// Get JQL from options or config
	let jql = options.jql;

	if (!jql) {
		// Try to load from config
		try {
			const configPath = join(process.cwd(), ".backlog-jira", "config.json");
			if (existsSync(configPath)) {
				const config = JSON.parse(readFileSync(configPath, "utf-8"));
				jql = config.jira?.jqlFilter;
			}
		} catch (error) {
			logger.warn({ error }, "Failed to load JQL from config");
		}
	}

	if (!jql) {
		// Default JQL: project = PROJECTKEY
		const projectKey = process.env.JIRA_PROJECT;
		if (projectKey) {
			jql = `project = ${projectKey} ORDER BY created DESC`;
		} else {
			throw new Error(
				"No JQL filter provided. Use --jql option or configure jqlFilter in config.json",
			);
		}
	}

	logger.info({ jql }, "Fetching Jira issues for import");

	// Search for issues
	const result = await jira.searchIssues(jql, { maxResults: 50 });
	logger.info(
		{ count: result.issues.length, total: result.total },
		"Found Jira issues",
	);

	// Separate mapped and unmapped issues
	const mapped: string[] = [];
	const unmapped: string[] = [];

	for (const issue of result.issues) {
		const mapping = store.getMappingByJiraKey(issue.key);
		if (mapping) {
			// Already mapped - will be pulled
			mapped.push(mapping.backlogId);
		} else {
			// Unmapped - will be imported
			unmapped.push(issue.key);
		}
	}

	logger.info(
		{ mappedCount: mapped.length, unmappedCount: unmapped.length },
		"Categorized issues for import",
	);

	return { mapped, unmapped };
}

/**
 * Pull a single Jira issue to Backlog task
 */
async function pullTask(
	taskId: string,
	context: {
		store: SyncStore;
		backlog: BacklogClient;
		jira: JiraClient;
		force: boolean;
		dryRun: boolean;
	},
): Promise<void> {
	const { store, backlog, jira, force, dryRun } = context;

	// Get mapping
	const mapping = store.getMapping(taskId);
	logger.info({ taskId, mapping }, "Retrieved mapping from store");
	if (!mapping) {
		throw new Error(`No Jira mapping found for task ${taskId}`);
	}

	// Get current state
	const task = await backlog.getTask(taskId);
	logger.info(
		{ mappingJiraKey: mapping.jiraKey, mappingKeys: Object.keys(mapping) },
		"Accessing mapping.jiraKey",
	);
	const issue = await jira.getIssue(mapping.jiraKey);

	const backlogHash = computeHash(normalizeBacklogTask(task));
	const jiraHash = computeHash(normalizeJiraIssue(issue));

	// Check sync state unless force is enabled
	if (!force) {
		const snapshots = store.getSnapshots(taskId);
		const state = classifySyncState(
			backlogHash,
			jiraHash,
			snapshots.backlog,
			snapshots.jira,
		);

		if (state.state === "Conflict") {
			throw new Error(
				`Conflict detected. Use --force to override or run 'backlog-jira sync' to resolve`,
			);
		}

		if (state.state === "InSync") {
			logger.info({ taskId }, "Task already in sync, skipping");
			return;
		}
	}

	// Build CLI updates from Jira issue
	// Extract project key from Jira issue key (format: PROJECT-123)
	const projectKey = issue.key.split("-")[0];
	const updates = buildBacklogUpdates(issue, task, projectKey);

	if (dryRun) {
		logger.info({ taskId, updates }, "DRY RUN: Would update Backlog task");
	} else {
		// Apply updates via Backlog CLI
		if (Object.keys(updates).length > 0) {
			await backlog.updateTask(taskId, updates);
		}

		// Update snapshots with freshly updated data
		const updatedTask = await backlog.getTask(taskId);
		const syncedHash = computeHash(normalizeJiraIssue(issue));
		store.setSnapshot(
			taskId,
			"backlog",
			syncedHash,
			normalizeBacklogTask(updatedTask),
		);
		store.setSnapshot(taskId, "jira", syncedHash, normalizeJiraIssue(issue));

		store.updateSyncState(taskId, {
			lastSyncAt: new Date().toISOString(),
		});

		// Update frontmatter with Jira metadata
		try {
			const filePath = getTaskFilePath(taskId);
			const jiraUrl = process.env.JIRA_URL
				? `${process.env.JIRA_URL}/browse/${mapping.jiraKey}`
				: undefined;

			updateJiraMetadata(filePath, {
				jiraKey: mapping.jiraKey,
				jiraUrl,
				jiraLastSync: new Date().toISOString(),
				jiraSyncState: "InSync",
			});

			logger.debug(
				{ taskId, jiraKey: mapping.jiraKey },
				"Updated frontmatter with Jira metadata",
			);
		} catch (error) {
			logger.error(
				{ taskId, error },
				"Failed to update frontmatter, but pull was successful",
			);
		}

		logger.info(
			{ taskId, jiraKey: mapping.jiraKey },
			"Updated Backlog task from Jira",
		);
	}
}

/**
 * Build Backlog CLI updates from Jira issue
 * Returns updates compatible with BacklogClient.updateTask()
 */
function buildBacklogUpdates(
	issue: JiraIssue,
	currentTask: BacklogTask,
	projectKey?: string,
): {
	title?: string;
	description?: string;
	status?: string;
	assignee?: string;
	labels?: string[];
	priority?: string;
	addAc?: string[];
	removeAc?: number[];
	checkAc?: number[];
	uncheckAc?: number[];
} {
	const updates: Record<string, unknown> = {};

	// Summary -> Title
	if (issue.summary !== currentTask.title) {
		updates.title = issue.summary;
	}

	// Description (without AC section - AC synced separately)
	const cleanJiraDesc = stripAcceptanceCriteriaFromDescription(
		issue.description || "",
	);
	const cleanTaskDesc = stripAcceptanceCriteriaFromDescription(
		currentTask.description || "",
	);

	if (cleanJiraDesc !== cleanTaskDesc) {
		updates.description = cleanJiraDesc;
	}

	// Status (needs mapping from Jira status to Backlog status)
	if (issue.status !== currentTask.status) {
		updates.status = mapJiraStatusToBacklog(issue.status, projectKey);
		logger.debug(
			{
				taskId: currentTask.id,
				from: currentTask.status,
				to: updates.status,
				jiraStatus: issue.status,
			},
			"Mapped Jira status to Backlog status",
		);
	}

	// Assignee
	if (issue.assignee && issue.assignee !== currentTask.assignee) {
		updates.assignee = issue.assignee;
	}

	// Labels
	if (
		issue.labels &&
		JSON.stringify(issue.labels) !== JSON.stringify(currentTask.labels)
	) {
		updates.labels = issue.labels;
	}

	// Priority (needs mapping from Jira priority to Backlog priority)
	if (issue.priority) {
		const mappedPriority = mapJiraPriorityToBacklog(issue.priority, projectKey);
		if (mappedPriority && mappedPriority !== currentTask.priority) {
			updates.priority = mappedPriority;
			logger.debug(
				{
					taskId: currentTask.id,
					from: currentTask.priority,
					to: mappedPriority,
					jiraPriority: issue.priority,
					projectKey,
				},
				"Mapped Jira priority to Backlog priority",
			);
		}
	}

	// Acceptance Criteria synchronization
	const acUpdates = syncAcceptanceCriteria(issue, currentTask);
	if (acUpdates.addAc && acUpdates.addAc.length > 0) {
		updates.addAc = acUpdates.addAc;
	}
	if (acUpdates.removeAc && acUpdates.removeAc.length > 0) {
		updates.removeAc = acUpdates.removeAc;
	}
	if (acUpdates.checkAc && acUpdates.checkAc.length > 0) {
		updates.checkAc = acUpdates.checkAc;
	}
	if (acUpdates.uncheckAc && acUpdates.uncheckAc.length > 0) {
		updates.uncheckAc = acUpdates.uncheckAc;
	}

	return updates;
}

/**
 * Sync acceptance criteria from Jira to Backlog
 * Returns operations needed to align Backlog AC with Jira AC
 */
function syncAcceptanceCriteria(
	issue: JiraIssue,
	currentTask: BacklogTask,
): {
	addAc?: string[];
	removeAc?: number[];
	checkAc?: number[];
	uncheckAc?: number[];
} {
	// Extract AC from Jira description
	const jiraAc = normalizeJiraIssue(issue).acceptanceCriteria;
	const backlogAc = currentTask.acceptanceCriteria || [];

	// If AC are identical, no sync needed
	if (JSON.stringify(jiraAc) === JSON.stringify(backlogAc)) {
		return {};
	}

	const addAc: string[] = [];
	const removeAc: number[] = [];
	const checkAc: number[] = [];
	const uncheckAc: number[] = [];

	// Simple approach: If AC lists are different, replace entirely
	// Remove all existing AC and add new ones
	if (
		jiraAc.length !== backlogAc.length ||
		JSON.stringify(jiraAc) !== JSON.stringify(backlogAc)
	) {
		// Remove all existing AC (in reverse order to avoid index issues)
		for (let i = backlogAc.length; i > 0; i--) {
			removeAc.push(i);
		}

		// Add all Jira AC
		for (const ac of jiraAc) {
			addAc.push(ac.text);
		}

		// Note: The checked state will be handled after AC are added
		// We'll need to check the ones that should be checked
		for (let i = 0; i < jiraAc.length; i++) {
			if (jiraAc[i].checked) {
				// AC indices are 1-based, and they'll be added in order
				checkAc.push(i + 1);
			}
		}
	}

	logger.debug(
		{
			taskId: currentTask.id,
			jiraAcCount: jiraAc.length,
			backlogAcCount: backlogAc.length,
			operations: {
				addAc: addAc.length,
				removeAc: removeAc.length,
				checkAc: checkAc.length,
			},
		},
		"Syncing acceptance criteria from Jira",
	);

	return { addAc, removeAc, checkAc, uncheckAc };
}

/**
 * Import a Jira issue as a new Backlog task
 * Creates task, maps it, and syncs initial data
 */
async function importJiraIssue(
	jiraKey: string,
	context: {
		store: SyncStore;
		backlog: BacklogClient;
		jira: JiraClient;
		dryRun: boolean;
	},
): Promise<string> {
	const { store, backlog, jira, dryRun } = context;

	// Get Jira issue
	const issue = await jira.getIssue(jiraKey);
	logger.info({ jiraKey, summary: issue.summary }, "Importing Jira issue");

	// Extract and normalize acceptance criteria from description
	const normalized = normalizeJiraIssue(issue);
	const acceptanceCriteria = normalized.acceptanceCriteria;
	const cleanDescription = stripAcceptanceCriteriaFromDescription(
		issue.description || "",
	);

	// Extract project key for status mapping
	const projectKey = issue.key.split("-")[0];

	if (dryRun) {
		logger.info(
			{
				jiraKey,
				title: issue.summary,
				status: mapJiraStatusToBacklog(issue.status, projectKey),
				assignee: issue.assignee,
				acCount: acceptanceCriteria.length,
			},
			"DRY RUN: Would import Jira issue",
		);
		return `dry-run-${jiraKey}`;
	}

	// Create Backlog task
	const taskId = await backlog.createTask({
		title: issue.summary,
		description: cleanDescription,
		status: mapJiraStatusToBacklog(issue.status, projectKey),
		assignee: issue.assignee,
		labels: issue.labels,
		priority: issue.priority,
		// Add acceptance criteria during creation
		ac: acceptanceCriteria.map((ac) => ac.text),
	});

	logger.info({ taskId, jiraKey }, "Created Backlog task from Jira issue");

	// If AC have checked states, update them
	const checkedIndices = acceptanceCriteria
		.map((ac, idx) => (ac.checked ? idx + 1 : -1))
		.filter((idx) => idx > 0);

	if (checkedIndices.length > 0) {
		await backlog.updateTask(taskId, {
			checkAc: checkedIndices,
		});
		logger.debug(
			{ taskId, checkedIndices },
			"Updated acceptance criteria checked states",
		);
	}

	// Create mapping
	store.addMapping(taskId, jiraKey);
	logger.info({ taskId, jiraKey }, "Created mapping");

	// Set initial snapshots
	const task = await backlog.getTask(taskId);
	const syncedHash = computeHash(normalizeJiraIssue(issue));
	store.setSnapshot(taskId, "backlog", syncedHash, normalizeBacklogTask(task));
	store.setSnapshot(taskId, "jira", syncedHash, normalizeJiraIssue(issue));

	store.updateSyncState(taskId, {
		lastSyncAt: new Date().toISOString(),
	});

	// Update frontmatter with Jira metadata
	try {
		const filePath = getTaskFilePath(taskId);
		const jiraUrl = process.env.JIRA_URL
			? `${process.env.JIRA_URL}/browse/${jiraKey}`
			: undefined;

		updateJiraMetadata(filePath, {
			jiraKey,
			jiraUrl,
			jiraLastSync: new Date().toISOString(),
			jiraSyncState: "InSync",
		});

		logger.debug({ taskId, jiraKey }, "Updated frontmatter with Jira metadata");
	} catch (error) {
		logger.error(
			{ taskId, error },
			"Failed to update frontmatter, but import was successful",
		);
	}

	logger.info({ taskId, jiraKey }, "Successfully imported Jira issue");
	return taskId;
}
