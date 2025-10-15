import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { logger } from "../utils/logger.ts";

export interface JiraIssue {
	key: string;
	id: string;
	summary: string;
	description?: string;
	status: string;
	issueType: string;
	assignee?: string;
	reporter?: string;
	priority?: string;
	labels?: string[];
	created: string;
	updated: string;
	fields?: Record<string, unknown>;
}

export interface JiraSearchResult {
	issues: JiraIssue[];
	total: number;
	startAt: number;
	maxResults: number;
}

export interface JiraTransition {
	id: string;
	name: string;
	to: {
		id: string;
		name: string;
	};
}

/**
 * JiraClient wraps MCP Atlassian tools for Jira operations
 */
export interface JiraClientOptions {
	dockerImage?: string;
	useExternalServer?: boolean;
	serverCommand?: string;
	serverArgs?: string[];
	dockerArgs?: string[];
	fallbackToDocker?: boolean;
	silentMode?: boolean;
}

export class JiraClient {
	private client: Client | null = null;
	private dockerImage: string;
	private useExternalServer: boolean;
	private serverCommand: string;
	private serverArgs: string[];
	private dockerArgs: string[];
	private fallbackToDocker: boolean;
	private silentMode: boolean;

	constructor(options: JiraClientOptions = {}) {
		this.dockerImage = options.dockerImage || "ghcr.io/sooperset/mcp-atlassian:latest";
		this.useExternalServer = options.useExternalServer || false;
		this.serverCommand = options.serverCommand || "mcp-atlassian";
		this.serverArgs = options.serverArgs || [];
		this.dockerArgs = options.dockerArgs || [];
		this.fallbackToDocker = options.fallbackToDocker !== false; // default true
		this.silentMode = options.silentMode || false;
	}

	/**
	 * Initialize the MCP client connection
	 */
	private async ensureConnected(): Promise<Client> {
		if (this.client) {
			return this.client;
		}

		logger.debug("Initializing MCP client connection to Atlassian server");

		// Create MCP client
		this.client = new Client({
			name: "backlog-jira-client",
			version: "1.0.0",
		});

		// Validate credentials first
		const envVars = this.validateAndPrepareCredentials();

		// Try external server first if enabled
		if (this.useExternalServer) {
			try {
				const transport = await this.createExternalServerTransport(envVars);
				await this.client.connect(transport);
				logger.info("Successfully connected to external MCP Atlassian server");
				return this.client;
			} catch (error) {
				// In silent mode, only log at debug level during fallback
				if (this.silentMode) {
					logger.debug({ error }, "Failed to connect to external MCP server, will try Docker");
				} else {
					logger.warn({ error }, "Failed to connect to external MCP server");
				}
				if (!this.fallbackToDocker) {
					this.client = null;
					throw error;
				}
				if (!this.silentMode) {
					logger.info("Falling back to Docker-based MCP server");
				}
			}
		}

		// Use Docker approach (either as primary or fallback)
		try {
			const transport = this.createDockerTransport(envVars);
			await this.client.connect(transport);
			logger.info("Successfully connected to Docker-based MCP Atlassian server");
			return this.client;
		} catch (error) {
			logger.error({ error }, "Failed to connect to MCP Atlassian server");
			this.client = null;
			throw error;
		}
	}

	/**
	 * Validate credentials and prepare environment variables
	 */
	private validateAndPrepareCredentials(): Record<string, string> {
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
			logger.debug("Using Personal Access Token authentication");
		} else if (jiraUsername && jiraApiToken) {
			envVars.JIRA_USERNAME = jiraUsername;
			envVars.JIRA_API_TOKEN = jiraApiToken;
			logger.debug("Using API Token authentication");
		}

		return envVars;
	}

	/**
	 * Create transport for external MCP server
	 */
	private async createExternalServerTransport(envVars: Record<string, string>): Promise<StdioClientTransport> {
		logger.debug({ command: this.serverCommand, args: this.serverArgs }, "Connecting to external MCP server");
		
		return new StdioClientTransport({
			command: this.serverCommand,
			args: this.serverArgs,
			env: envVars,
		});
	}

	/**
	 * Create transport for Docker-based MCP server
	 */
	private createDockerTransport(envVars: Record<string, string>): StdioClientTransport {
		const dockerArgs = ["run", "-i", "-e", "JIRA_URL"];

		if (envVars.JIRA_PERSONAL_TOKEN) {
			dockerArgs.push("-e", "JIRA_PERSONAL_TOKEN");
		} else if (envVars.JIRA_USERNAME && envVars.JIRA_API_TOKEN) {
			dockerArgs.push("-e", "JIRA_USERNAME", "-e", "JIRA_API_TOKEN");
		}

		// Add custom Docker arguments (e.g., --dns, --dns-search) before the image
		if (this.dockerArgs.length > 0) {
			logger.debug({ customDockerArgs: this.dockerArgs }, "Adding custom Docker arguments");
			// Split arguments that contain spaces (e.g., "--dns 8.8.8.8" -> ["--dns", "8.8.8.8"])
			const splitArgs = this.dockerArgs.flatMap(arg => arg.split(/\s+/));
			dockerArgs.push(...splitArgs);
		}

		dockerArgs.push(this.dockerImage);

		// Log the complete Docker command for debugging
		const fullCommand = `docker ${dockerArgs.join(" ")}`;
		logger.info({ command: fullCommand, dockerArgs }, "Creating Docker-based MCP transport");
		// Only show console output if not in silent mode
		if (!this.silentMode) {
			console.log(`\n🐳 Docker command: ${fullCommand}\n`);
		}

		return new StdioClientTransport({
			command: "docker",
			args: dockerArgs,
			env: envVars,
		});
	}

	/**
	 * Close the MCP client connection
	 */
	async close(): Promise<void> {
		if (this.client) {
			await this.client.close();
			this.client = null;
			logger.debug("Closed MCP client connection");
		}
	}

	/**
	 * Call an MCP tool via MCP SDK
	 */
	private async callMcpTool(
		toolName: string,
		input: Record<string, unknown>,
	): Promise<unknown> {
		try {
			const client = await this.ensureConnected();
			logger.info({ toolName, input }, "About to call MCP tool");

			const result = await client.callTool({
				name: toolName,
				arguments: input,
			});
			logger.info(
				{ toolName, hasContent: !!result.content },
				"MCP tool returned",
			);

			// Extract the actual content from the MCP response
			const resultContent = result.content as
				| Array<{ type: string; text?: string }>
				| undefined;
			if (resultContent && resultContent.length > 0) {
				const content = resultContent[0];
				if (content.type === "text" && content.text) {
					try {
						// Try to parse as JSON
						const parsed = JSON.parse(content.text);
						logger.debug({ toolName }, "MCP tool call succeeded");
						return parsed;
					} catch {
						// Return as-is if not JSON
						return content.text;
					}
				}
			}

			// If there's structured content, use that
			if (result.structuredContent) {
				logger.debug(
					{ toolName },
					"MCP tool call succeeded with structured content",
				);
				return result.structuredContent;
			}

			logger.warn({ toolName, result }, "MCP tool returned unexpected format");
			return result;
		} catch (error) {
			logger.error({ error, toolName }, "MCP tool call failed");
			throw error;
		}
	}

	/**
	 * Test if MCP Jira tools are accessible
	 */
	async test(): Promise<boolean> {
		try {
			// Use jira_get_all_projects as a simpler connection test
			// This doesn't require a specific user identifier
			await this.callMcpTool("jira_get_all_projects", {});
			logger.debug("MCP Jira tools are accessible");
			return true;
		} catch (error) {
			logger.error({ error }, "MCP Jira tools test failed");
			return false;
		} finally {
			// Always close the connection after testing
			await this.close();
		}
	}

	/**
	 * Get all accessible Jira projects
	 */
	async getAllProjects(): Promise<
		Array<{ key: string; name: string; id: string }>
	> {
		try {
			const result = (await this.callMcpTool("jira_get_all_projects", {})) as {
				projects: Array<{
					key: string;
					name: string;
					id: string;
				}>;
			};

			logger.info({ count: result.projects.length }, "Retrieved Jira projects");
			return result.projects;
		} catch (error) {
			logger.error({ error }, "Failed to get Jira projects");
			throw error;
		}
	}

	/**
	 * Search for Jira issues using JQL
	 */
	async searchIssues(
		jql: string,
		options?: { startAt?: number; maxResults?: number; fields?: string },
	): Promise<JiraSearchResult> {
		try {
			const input: Record<string, unknown> = {
				jql,
				start_at: options?.startAt || 0,
				limit: options?.maxResults || 50,
			};

			if (options?.fields) {
				input.fields = options.fields;
			}

		const result = (await this.callMcpTool("jira_search", input)) as {
			issues: Array<Record<string, unknown>>;
			total: number;
			startAt?: number;
			start_at?: number;
			maxResults?: number;
			max_results?: number;
		};

		// Validate the result has the expected structure
		if (!result || !Array.isArray(result.issues)) {
			logger.error({ result }, "Invalid response from jira_search");
			throw new Error(
				"Invalid response from Jira API: missing or invalid 'issues' array",
			);
		}

		const issues: JiraIssue[] = result.issues.map((issue) => {
			// MCP Atlassian returns fields at top level, not nested under 'fields'
			// Handle both formats for compatibility
			const hasNestedFields = issue.fields && typeof issue.fields === "object";
			const fields = hasNestedFields ? (issue.fields as Record<string, unknown>) : issue;
			
			// Extract status
			const status = fields.status as { name: string } | { id: string; name: string } | undefined;
			const statusName = status?.name || "Unknown";
			
			// Extract issue type
			const issueType = fields.issue_type as { name: string } | undefined;
			const issueTypeName = issueType?.name || (fields.issuetype as { name: string } | undefined)?.name || "Task";
			
			// Extract assignee
			const assignee = fields.assignee as { display_name?: string; displayName?: string } | undefined;
			const assigneeName = assignee?.display_name || assignee?.displayName;
			
			// Extract reporter
			const reporter = fields.reporter as { display_name?: string; displayName?: string } | undefined;
			const reporterName = reporter?.display_name || reporter?.displayName;
			
			// Extract priority
			const priority = fields.priority as { name: string } | undefined;
			const priorityName = priority?.name;

			return {
				key: issue.key as string,
				id: issue.id as string,
				summary: fields.summary as string,
				description: fields.description as string | undefined,
				status: statusName,
				issueType: issueTypeName,
				assignee: assigneeName,
				reporter: reporterName,
				priority: priorityName,
				labels: (fields.labels as string[]) || [],
				created: fields.created as string,
				updated: fields.updated as string,
				fields: fields as Record<string, unknown>,
			};
		});

		logger.info(
			{ jql, count: issues.length, total: result.total },
			"Searched Jira issues",
		);

		return {
			issues,
			total: result.total,
			startAt: result.startAt || result.start_at || 0,
			maxResults: result.maxResults || result.max_results || 50,
		};
		} catch (error) {
			logger.error({ error, jql }, "Failed to search Jira issues");
			throw error;
		}
	}

	/**
	 * Get a specific Jira issue by key
	 */
	async getIssue(
		issueKey: string,
		options?: { fields?: string; expand?: string },
	): Promise<JiraIssue> {
		try {
			logger.info({ issueKey, options }, "getIssue called with parameters");
			const input: Record<string, unknown> = {
				issue_key: issueKey,
			};
			logger.info({ input }, "Built input object");

			if (options?.fields) {
				input.fields = options.fields;
			}
			if (options?.expand) {
				input.expand = options.expand;
			}

			const result = await this.callMcpTool("jira_get_issue", input);
			const typedResult = result as {
				key: string;
				id: string;
				summary: string;
				description?: string;
				status: { name: string; category?: string; color?: string };
				issue_type?: { name: string };
				assignee?: { display_name: string };
				reporter?: { display_name: string };
				priority?: { name: string };
				labels?: string[];
				created: string;
				updated: string;
				[key: string]: unknown;
			};

			const issue: JiraIssue = {
				key: typedResult.key,
				id: typedResult.id,
				summary: typedResult.summary,
				description: typedResult.description,
				status: typedResult.status.name,
				issueType: typedResult.issue_type?.name || "Task",
				assignee: typedResult.assignee?.display_name,
				reporter: typedResult.reporter?.display_name,
				priority: typedResult.priority?.name,
				labels: typedResult.labels || [],
				created: typedResult.created,
				updated: typedResult.updated,
				fields: typedResult as Record<string, unknown>,
			};

			logger.info({ issueKey }, "Retrieved Jira issue");
			return issue;
		} catch (error) {
			logger.error({ error, issueKey }, "Failed to get Jira issue");
			throw error;
		}
	}

	/**
	 * Update a Jira issue
	 */
	async updateIssue(
		issueKey: string,
		updates: {
			summary?: string;
			description?: string;
			assignee?: string;
			priority?: string;
			labels?: string[];
			fields?: Record<string, unknown>;
		},
	): Promise<void> {
		try {
			const fields: Record<string, unknown> = {};

			if (updates.summary) {
				fields.summary = updates.summary;
			}
			if (updates.description) {
				fields.description = updates.description;
			}
			if (updates.assignee) {
				fields.assignee = updates.assignee;
			}
			if (updates.priority) {
				fields.priority = { name: updates.priority };
			}
			if (updates.labels) {
				fields.labels = updates.labels;
			}
			if (updates.fields) {
				Object.assign(fields, updates.fields);
			}

			await this.callMcpTool("jira_update_issue", {
				issue_key: issueKey,
				fields,
			});

			logger.info({ issueKey, updates }, "Updated Jira issue");
		} catch (error) {
			logger.error({ error, issueKey, updates }, "Failed to update Jira issue");
			throw error;
		}
	}

	/**
	 * Get available transitions for an issue
	 */
	async getTransitions(issueKey: string): Promise<JiraTransition[]> {
		try {
			const result = (await this.callMcpTool("jira_get_transitions", {
				issue_key: issueKey,
			})) as {
				transitions: Array<{
					id: string;
					name: string;
					to: {
						id: string;
						name: string;
					};
				}>;
			};

			logger.debug(
				{ issueKey, count: result.transitions.length },
				"Retrieved Jira transitions",
			);
			return result.transitions;
		} catch (error) {
			logger.error({ error, issueKey }, "Failed to get Jira transitions");
			throw error;
		}
	}

	/**
	 * Transition an issue to a new status
	 */
	async transitionIssue(
		issueKey: string,
		transitionId: string,
		options?: {
			comment?: string;
			fields?: Record<string, unknown>;
		},
	): Promise<void> {
		try {
			const input: Record<string, unknown> = {
				issue_key: issueKey,
				transition_id: transitionId,
			};

			if (options?.comment) {
				input.comment = options.comment;
			}
			if (options?.fields) {
				input.fields = options.fields;
			}

			await this.callMcpTool("jira_transition_issue", input);
			logger.info({ issueKey, transitionId }, "Transitioned Jira issue");
		} catch (error) {
			logger.error(
				{ error, issueKey, transitionId },
				"Failed to transition Jira issue",
			);
			throw error;
		}
	}

	/**
	 * Add a comment to an issue
	 */
	async addComment(issueKey: string, comment: string): Promise<void> {
		try {
			await this.callMcpTool("jira_add_comment", {
				issue_key: issueKey,
				comment,
			});
			logger.info({ issueKey }, "Added comment to Jira issue");
		} catch (error) {
			logger.error({ error, issueKey }, "Failed to add comment to Jira issue");
			throw error;
		}
	}

	/**
	 * Create a new Jira issue
	 */
	async createIssue(
		projectKey: string,
		issueType: string,
		summary: string,
		options?: {
			description?: string;
			assignee?: string;
			priority?: string;
			labels?: string[];
			components?: string;
			fields?: Record<string, unknown>;
		},
	): Promise<JiraIssue> {
		try {
			const input: Record<string, unknown> = {
				project_key: projectKey,
				issue_type: issueType,
				summary,
			};

			if (options?.description) {
				input.description = options.description;
			}
			if (options?.assignee) {
				input.assignee = options.assignee;
			}
			if (options?.priority) {
				input.additional_fields = {
					...((input.additional_fields as Record<string, unknown>) || {}),
					priority: { name: options.priority },
				};
			}
			if (options?.labels) {
				input.additional_fields = {
					...((input.additional_fields as Record<string, unknown>) || {}),
					labels: options.labels,
				};
			}
			if (options?.components) {
				input.components = options.components;
			}
			if (options?.fields) {
				input.additional_fields = {
					...((input.additional_fields as Record<string, unknown>) || {}),
					...options.fields,
				};
			}

			const result = (await this.callMcpTool("jira_create_issue", input)) as {
				key: string;
				id: string;
				fields: {
					summary: string;
					description?: string;
					status: { name: string };
					issuetype: { name: string };
					created: string;
					updated: string;
					[key: string]: unknown;
				};
			};

			const issue: JiraIssue = {
				key: result.key,
				id: result.id,
				summary: result.fields.summary,
				description: result.fields.description as string | undefined,
				status: result.fields.status.name,
				issueType: result.fields.issuetype.name,
				created: result.fields.created,
				updated: result.fields.updated,
				fields: result.fields,
			};

			logger.info(
				{ issueKey: issue.key, projectKey, issueType },
				"Created Jira issue",
			);
			return issue;
		} catch (error) {
			logger.error(
				{ error, projectKey, issueType, summary },
				"Failed to create Jira issue",
			);
			throw error;
		}
	}
}
