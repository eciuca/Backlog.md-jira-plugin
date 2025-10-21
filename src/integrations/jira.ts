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
	extraEnv?: Record<string, string>;
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
	private extraEnv: Record<string, string>;

	constructor(options: JiraClientOptions = {}) {
		this.dockerImage =
			options.dockerImage || "ghcr.io/sooperset/mcp-atlassian:latest";
		this.useExternalServer = options.useExternalServer || false;
		this.serverCommand = options.serverCommand || "mcp-atlassian";
		this.serverArgs = options.serverArgs || [];
		this.dockerArgs = options.dockerArgs || [];
		this.fallbackToDocker = options.fallbackToDocker !== false; // default true
		this.silentMode = options.silentMode || false;
		this.extraEnv = options.extraEnv || {};
		// In silent mode, ask the MCP server to reduce its own logs if supported
		if (this.silentMode) {
			const defaults: Record<string, string> = {
				LOG_LEVEL: "CRITICAL",
				MCP_LOG_LEVEL: "CRITICAL",
				FASTMCP_LOG_LEVEL: "CRITICAL",
				MCP_ATLASSIAN_LOG_LEVEL: "CRITICAL",
				PYTHONLOGLEVEL: "CRITICAL",
			};
			for (const [k, v] of Object.entries(defaults)) {
				if (!(k in this.extraEnv)) this.extraEnv[k] = v;
			}
		}
	}

	/**
	 * Initialize the MCP client connection
	 */
	private async ensureConnected(): Promise<Client> {
		if (this.client) {
			return this.client;
		}

		if (!this.silentMode) {
			logger.debug("Initializing MCP client connection to Atlassian server");
		}

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
				// Wait for server initialization to complete
				await this.waitForServerReady();
				if (!this.silentMode) {
					logger.info(
						"Successfully connected to external MCP Atlassian server",
					);
				}
				return this.client;
			} catch (error) {
				// In silent mode, only log at debug level during fallback
				if (this.silentMode) {
					logger.debug(
						{ error },
						"Failed to connect to external MCP server, will try Docker",
					);
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
			// Wait for server initialization to complete
			await this.waitForServerReady();
			if (!this.silentMode) {
				logger.info(
					"Successfully connected to Docker-based MCP Atlassian server",
				);
			}
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
			// Merge any extra env vars from configuration (e.g., proxies)
			...this.extraEnv,
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
	private async createExternalServerTransport(
		envVars: Record<string, string>,
	): Promise<StdioClientTransport> {
		logger.debug(
			{ command: this.serverCommand, args: this.serverArgs },
			"Connecting to external MCP server",
		);

		return new StdioClientTransport({
			command: this.serverCommand,
			args: this.serverArgs,
			env: envVars,
		});
	}

	/**
	 * Create transport for Docker-based MCP server
	 */
	private createDockerTransport(
		envVars: Record<string, string>,
	): StdioClientTransport {
		const dockerArgs = ["run", "-i", "-e", "JIRA_URL"];

		if (envVars.JIRA_PERSONAL_TOKEN) {
			dockerArgs.push("-e", "JIRA_PERSONAL_TOKEN");
		} else if (envVars.JIRA_USERNAME && envVars.JIRA_API_TOKEN) {
			dockerArgs.push("-e", "JIRA_USERNAME", "-e", "JIRA_API_TOKEN");
		}

		// Pass through any extra environment variables to the container
		for (const key of Object.keys(this.extraEnv)) {
			// Avoid duplicating credentials already handled above
			if (["JIRA_URL", "JIRA_PERSONAL_TOKEN", "JIRA_USERNAME", "JIRA_API_TOKEN"].includes(key)) {
				continue;
			}
			dockerArgs.push("-e", key);
		}

		// Add custom Docker arguments (e.g., --dns, --dns-search) before the image
		if (this.dockerArgs.length > 0) {
			logger.debug(
				{ customDockerArgs: this.dockerArgs },
				"Adding custom Docker arguments",
			);
			// Split arguments that contain spaces (e.g., "--dns 8.8.8.8" -> ["--dns", "8.8.8.8"])
			const splitArgs = this.dockerArgs.flatMap((arg) => arg.split(/\s+/));
			dockerArgs.push(...splitArgs);
		}

		dockerArgs.push(this.dockerImage);

		// Log the complete Docker command for debugging
		if (!this.silentMode) {
			const fullCommand = `docker ${dockerArgs.join(" ")}`;
			logger.info(
				{ command: fullCommand, dockerArgs },
				"Creating Docker-based MCP transport",
			);
		}

		return new StdioClientTransport({
			command: "docker",
			args: dockerArgs,
			env: envVars,
		});
	}

	/**
	 * Wait for MCP server to be fully initialized
	 * This prevents -32602 errors from requests sent before initialization completes
	 */
	private async waitForServerReady(): Promise<void> {
		const maxRetries = 10;
		const retryDelay = 500; // ms

		for (let i = 0; i < maxRetries; i++) {
			try {
				// Try to list tools as a health check
				if (this.client) {
					await this.client.listTools();
					logger.debug("MCP server is ready");
					return;
				}
			} catch (error) {
				const errorMessage = error instanceof Error ? error.message : String(error);
				if (errorMessage.includes("-32602") || errorMessage.includes("before initialization")) {
					logger.debug(
						{ attempt: i + 1, maxRetries },
						"Waiting for MCP server initialization",
					);
					await new Promise((resolve) => setTimeout(resolve, retryDelay));
					continue;
				}
				// Other errors should propagate
				throw error;
			}
		}

		throw new Error(
			"MCP server failed to complete initialization after multiple retries",
		);
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
			if (!this.silentMode) {
				logger.info({ toolName, input }, "About to call MCP tool");
			}

			const result = await client.callTool({
				name: toolName,
				arguments: input,
			});
			if (!this.silentMode) {
				logger.info(
					{ toolName, hasContent: !!result.content },
					"MCP tool returned",
				);
			}

			// Check if result indicates an error (isError flag)
			if (result.isError) {
				const errorText = this.extractErrorText(result.content);
				if (this.silentMode) {
					logger.debug({ toolName, error: errorText }, "MCP tool returned error");
				} else {
					logger.error({ toolName, error: errorText, resultContent: result.content }, "MCP tool returned error");
				}
				
				// Check if this is a proxy/JSON error
				if (errorText.includes("Expecting value") || errorText.includes("JSONDecodeError")) {
					throw new Error(
						`Proxy authentication required: The MCP server is receiving HTML instead of JSON from Jira.\n` +
						`This typically happens when your corporate proxy requires browser-based authentication.\n` +
						`\nTo resolve this:\n` +
						`1. Open your browser and navigate to your Jira URL: ${process.env.JIRA_URL || "(not set)"}\n` +
						`2. Complete the proxy authentication/login\n` +
						`3. Try the command again\n` +
						`\nOriginal error: ${errorText}`,
					);
				}

				// Generic tool error (often hides proxy/HTML issues). Provide guidance.
				if (errorText.startsWith("Error calling tool")) {
					throw new Error(
						`MCP tool ${toolName} failed with a server-side error.\n` +
						`This can happen if Jira returned HTML (e.g., proxy login page) instead of JSON.\n` +
						`Try: backlog-jira mcp start --debug to inspect logs, and consider adding HTTP(S)_PROXY/NO_PROXY to .backlog-jira/config.json -> mcp.envVars.\n` +
						`If you're behind a corporate proxy, authenticate in the browser to ${process.env.JIRA_URL || "your Jira URL"} first.\n` +
						`Original error: ${errorText}`,
					);
				}
				
				throw new Error(`MCP tool ${toolName} failed: ${errorText}`);
			}

			// Extract the actual content from the MCP response
			const resultContent = result.content as
				| Array<{ type: string; text?: string }>
				| undefined;
			if (resultContent && resultContent.length > 0) {
				const content = resultContent[0];
				if (content.type === "text" && content.text) {
					// Check if the text content is an error message or proxy redirect
					if (this.isErrorResponse(content.text)) {
						const errorMsg = this.formatErrorMessage(content.text, toolName);
						logger.error({ toolName, response: content.text }, "MCP tool returned error string");
						throw new Error(errorMsg);
					}

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

			if (this.silentMode) {
				logger.debug({ toolName }, "MCP tool returned unexpected format");
			} else {
				logger.warn({ toolName, result }, "MCP tool returned unexpected format");
			}
			return result;
		} catch (error) {
			// Enhance error message for common issues
			const errorMessage = error instanceof Error ? error.message : String(error);
			const errorString = String(error);
			
			// Check for MCP initialization errors
			if (errorMessage.includes("-32602") || errorMessage.includes("Invalid request parameters")) {
				if (this.silentMode) {
					logger.debug(
						{ error: errorMessage, toolName },
						"MCP tool call failed: Server not initialized (likely starting up)",
					);
				} else {
					logger.error(
						{ error, toolName },
						"MCP tool call failed: Server not initialized. This may indicate the MCP server is still starting up.",
					);
				}
				throw new Error(
					`MCP error -32602: Invalid request parameters. The MCP server may not be fully initialized yet. Tool: ${toolName}`,
				);
			}
			
			// Check for proxy/JSON parsing errors
			if (
				errorMessage.includes("Expecting value") ||
				errorMessage.includes("JSONDecodeError") ||
				errorString.includes("Expecting value: line 1 column 1")
			) {
				const proxyError = new Error(
					`Proxy authentication required: The MCP server is receiving HTML instead of JSON from Jira.\n` +
					`This typically happens when your corporate proxy requires browser-based authentication.\n` +
					`\nTo resolve this:\n` +
					`1. Open your browser and navigate to your Jira URL: ${process.env.JIRA_URL || "(not set)"}\n` +
					`2. Complete the proxy authentication/login\n` +
					`3. Try the command again\n` +
					`\nAlternatively, configure proxy settings or DNS to bypass authentication for the Docker container.\n` +
					`\nOriginal error: ${errorMessage}`,
				);
			if (this.silentMode) {
				logger.debug({ error: proxyError.message, toolName }, "Proxy authentication required");
			} else {
				logger.error({ error: proxyError, toolName }, "Proxy authentication required");
			}
			throw proxyError;
			}
			
			if (this.silentMode) {
				logger.debug({ error: errorMessage, toolName }, "MCP tool call failed");
			} else {
				logger.error({ error, toolName }, "MCP tool call failed");
			}
			throw error;
		}
	}

	/**
	 * Check if a text response is an error message or proxy redirect
	 */
	private isErrorResponse(text: string): boolean {
		const lowerText = text.toLowerCase();
		
		// Check for proxy/HTML login page indicators
		const isHtmlResponse = 
			lowerText.includes("<html") ||
			lowerText.includes("<!doctype") ||
			lowerText.includes("<head>") ||
			lowerText.includes("<body>");
			
		const isProxyLogin = 
			lowerText.includes("login") && isHtmlResponse ||
			lowerText.includes("authentication required") ||
			lowerText.includes("proxy authentication") ||
			lowerText.includes("sign in") && isHtmlResponse;
		
		// Check for standard error indicators
		const isStandardError = 
			lowerText.includes("error") ||
			lowerText.includes("failed") ||
			lowerText.includes("exception") ||
			lowerText.startsWith("expecting value:");
		
		return isProxyLogin || isHtmlResponse || isStandardError;
	}

	/**
	 * Extract error text from MCP response content
	 */
	private extractErrorText(
		content:
			| Array<{ type: string; text?: string }>
			| undefined,
	): string {
		if (!content || content.length === 0) {
			return "Unknown error";
		}
		const firstContent = content[0];
		const text = firstContent.text || "Unknown error";
		return text.trim();
	}
	
	/**
	 * Format error message with specific guidance for common issues
	 */
	private formatErrorMessage(errorText: string, toolName: string): string {
		const lowerText = errorText.toLowerCase();
		
		// Detect proxy/HTML login page
		if (
			(lowerText.includes("<html") || lowerText.includes("<!doctype")) &&
			(lowerText.includes("login") || lowerText.includes("sign in") || lowerText.includes("authentication"))
		) {
			return (
				`Proxy authentication required: The MCP server is being redirected to a login page.\n` +
				`This typically happens when your corporate proxy requires browser-based authentication.\n` +
				`\nTo resolve this:\n` +
				`1. Open your browser and navigate to your Jira URL\n` +
				`2. Complete the proxy authentication/login\n` +
				`3. Try the command again\n` +
				`\nAlternatively, configure proxy settings to bypass authentication for the Docker container.`
			);
		}
		
		// Detect JSON parsing errors (likely HTML response)
		if (lowerText.includes("expecting value") && lowerText.includes("line 1 column 1")) {
			return (
				`Invalid JSON response from Jira API (received HTML instead of JSON).\n` +
				`This often indicates:\n` +
				`1. Proxy authentication is required (login in browser first)\n` +
				`2. The Jira URL is incorrect or unreachable\n` +
				`3. Network/DNS configuration issues\n` +
				`\nCurrent tool: ${toolName}`
			);
		}
		
		// Default error message
		return `MCP tool ${toolName} failed: ${errorText}`;
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
				const hasNestedFields =
					issue.fields && typeof issue.fields === "object";
				const fields = hasNestedFields
					? (issue.fields as Record<string, unknown>)
					: issue;

				// Extract status
				const status = fields.status as
					| { name: string }
					| { id: string; name: string }
					| undefined;
				const statusName = status?.name || "Unknown";

				// Extract issue type
				const issueType = fields.issue_type as { name: string } | undefined;
				const issueTypeName =
					issueType?.name ||
					(fields.issuetype as { name: string } | undefined)?.name ||
					"Task";

				// Extract assignee
				const assignee = fields.assignee as
					| { display_name?: string; displayName?: string }
					| undefined;
				const assigneeName = assignee?.display_name || assignee?.displayName;

				// Extract reporter
				const reporter = fields.reporter as
					| { display_name?: string; displayName?: string }
					| undefined;
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
			
			// Validate response structure
			if (typeof result !== "object" || result === null) {
				logger.error({ result, issueKey }, "Invalid response from jira_get_issue: not an object");
				throw new Error(
					`Invalid response from jira_get_issue for ${issueKey}: expected object, got ${typeof result}`,
				);
			}

			const typedResult = result as {
				key?: string;
				id?: string;
				summary?: string;
				description?: string;
				status?: { name?: string; category?: string; color?: string } | null;
				issue_type?: { name?: string } | null;
				assignee?: { display_name?: string } | null;
				reporter?: { display_name?: string } | null;
				priority?: { name?: string } | null;
				labels?: string[];
				created?: string;
				updated?: string;
				[key: string]: unknown;
			};

			// Validate required fields
			if (!typedResult.key || !typedResult.id) {
				logger.error({ result: typedResult, issueKey }, "Invalid response: missing key or id");
				throw new Error(
					`Invalid response from jira_get_issue for ${issueKey}: missing required fields (key, id)`,
				);
			}

			const issue: JiraIssue = {
				key: typedResult.key,
				id: typedResult.id,
				summary: typedResult.summary || "",
				description: typedResult.description,
				status: typedResult.status?.name || "Unknown",
				issueType: typedResult.issue_type?.name || "Task",
				assignee: typedResult.assignee?.display_name,
				reporter: typedResult.reporter?.display_name,
				priority: typedResult.priority?.name,
				labels: typedResult.labels || [],
				created: typedResult.created || "",
				updated: typedResult.updated || "",
				fields: typedResult as Record<string, unknown>,
			};

			logger.info({ issueKey }, "Retrieved Jira issue");
			return issue;
		} catch (error) {
			if (this.silentMode) {
				logger.debug({ issueKey, err: error instanceof Error ? error.message : String(error) }, "Failed to get Jira issue");
			} else {
				logger.error({ error, issueKey }, "Failed to get Jira issue");
			}
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
			if (this.silentMode) {
				logger.debug({ issueKey, err: error instanceof Error ? error.message : String(error) }, "Failed to update Jira issue");
			} else {
				logger.error({ error, issueKey, updates }, "Failed to update Jira issue");
			}
			throw error;
		}
	}

	/**
	 * Get available transitions for an issue
	 */
	async getTransitions(issueKey: string): Promise<JiraTransition[]> {
		try {
			const result = await this.callMcpTool("jira_get_transitions", {
				issue_key: issueKey,
			});

			// Handle different response formats from MCP server
			let transitions: Array<{
				id: string | number;
				name: string;
				to?: {
					id: string;
					name: string;
				};
			}>;

			if (Array.isArray(result)) {
				// MCP server returns a plain array
				transitions = result;
			} else if (result && typeof result === 'object' && 'transitions' in result) {
				// Alternative format with transitions wrapper
				transitions = (result as { transitions: typeof transitions }).transitions;
			} else {
				logger.error({ result, issueKey }, "Unexpected response format from jira_get_transitions");
				throw new Error(`Invalid response format from jira_get_transitions for ${issueKey}`);
			}

			// Map to JiraTransition format, providing placeholder 'to' field if missing
			const mapped: JiraTransition[] = transitions.map((t) => {
				return {
					id: String(t.id),
					name: t.name,
					to: t.to || {
						id: "",
						name: "", // Will be matched by transition name instead
					},
				};
			});

			logger.debug(
				{ issueKey, count: mapped.length, transitions: mapped },
				"Retrieved Jira transitions",
			);
			return mapped;
		} catch (error) {
			if (this.silentMode) {
				logger.debug({ issueKey, err: error instanceof Error ? error.message : String(error) }, "Failed to get Jira transitions");
			} else {
				logger.error({ error, issueKey }, "Failed to get Jira transitions");
			}
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
			if (this.silentMode) {
				logger.debug({ issueKey, transitionId, err: error instanceof Error ? error.message : String(error) }, "Failed to transition Jira issue");
			} else {
				logger.error(
					{ error, issueKey, transitionId },
					"Failed to transition Jira issue",
				);
			}
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
	 * Search for Jira users by name or email
	 */
	async searchUsers(query: string): Promise<Array<{
		displayName: string;
		emailAddress?: string;
		accountId: string;
	}>> {
		try {
			// Use jira_search_user MCP tool with CQL query
			const cql = `user.fullname ~ "${query.replace(/"/g, '\\"')}"`;
			const result = (await this.callMcpTool("jira_search_user", {
				query: cql,
				limit: 10,
			})) as {
				results: Array<{
					user: {
						displayName: string;
						emailAddress?: string;
						accountId: string;
					};
				}>;
			};

			logger.debug(
				{ query, count: result.results.length },
				"Searched Jira users",
			);
			return result.results.map(r => r.user);
		} catch (error) {
			logger.error({ error, query }, "Failed to search Jira users");
			throw error;
		}
	}

	/**
	 * Resolve a user identifier (displayName, email, or accountId) to a Jira account ID
	 * This handles cases where the mapping config stores displayNames or emails instead of account IDs
	 */
	async resolveUserToAccountId(userIdentifier: string): Promise<string | null> {
		try {
			// If it looks like an account ID already (format: 557058:xxx or 5-digit string), return it
			if (/^[0-9a-f]{24}$/.test(userIdentifier) || /^[0-9]{5,}:[a-f0-9-]+$/.test(userIdentifier)) {
				logger.debug({ userIdentifier }, "User identifier appears to be an account ID already");
				return userIdentifier;
			}

			// Try to search for the user
			const users = await this.searchUsers(userIdentifier);
			
			if (users.length === 0) {
				logger.warn({ userIdentifier }, "No Jira user found matching identifier");
				return null;
			}

			// If we get an exact match by displayName or email, use that
			const exactMatch = users.find(
				u => u.displayName === userIdentifier || u.emailAddress === userIdentifier
			);
			
			if (exactMatch) {
				logger.debug(
					{ userIdentifier, accountId: exactMatch.accountId },
					"Resolved user identifier to account ID (exact match)"
				);
				return exactMatch.accountId;
			}

			// Otherwise, take the first result (fuzzy match)
			const firstMatch = users[0];
			logger.debug(
				{ userIdentifier, accountId: firstMatch.accountId, displayName: firstMatch.displayName },
				"Resolved user identifier to account ID (first match)"
			);
			return firstMatch.accountId;
		} catch (error) {
			logger.error({ error, userIdentifier }, "Failed to resolve user to account ID");
			return null;
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

		const result = await this.callMcpTool("jira_create_issue", input);

		// Validate response structure
		if (!result || typeof result !== "object") {
			logger.error({ result, projectKey, issueType }, "Invalid response from jira_create_issue: not an object");
			throw new Error(
				`Invalid response from jira_create_issue: expected object, got ${typeof result}`,
			);
		}

		const typedResult = result as {
			key?: string;
			id?: string;
			fields?: {
				summary?: string;
				description?: string;
				status?: { name?: string };
				issuetype?: { name?: string };
				created?: string;
				updated?: string;
				[key: string]: unknown;
			};
		};

		// Validate required fields
		if (!typedResult.key || !typedResult.id) {
			logger.error({ result: typedResult, projectKey }, "Invalid response: missing key or id");
			throw new Error(
				`Invalid response from jira_create_issue: missing required fields (key, id)`,
			);
		}

		if (!typedResult.fields) {
			logger.error({ result: typedResult, projectKey }, "Invalid response: missing fields object");
			throw new Error(
				`Invalid response from jira_create_issue: missing fields object`,
			);
		}

		const issue: JiraIssue = {
			key: typedResult.key,
			id: typedResult.id,
			summary: typedResult.fields.summary || summary, // Fallback to input summary
			description: typedResult.fields.description as string | undefined,
			status: typedResult.fields.status?.name || "Unknown",
			issueType: typedResult.fields.issuetype?.name || issueType, // Fallback to input issueType
			created: typedResult.fields.created || new Date().toISOString(),
			updated: typedResult.fields.updated || new Date().toISOString(),
			fields: typedResult.fields,
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
