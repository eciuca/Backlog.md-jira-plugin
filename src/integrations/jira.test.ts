import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test";
import { JiraClient, type JiraClientOptions } from "./jira.ts";

describe("JiraClient", () => {
	describe("searchIssues", () => {
		it("should search issues with correct parameters", async () => {
			const client = new JiraClient();

			const mockResult = {
				issues: [
					{
						key: "PROJ-1",
						id: "10001",
						fields: {
							summary: "Test Issue",
							description: "Test description",
							status: { name: "To Do" },
							issuetype: { name: "Task" },
							assignee: { displayName: "Alice" },
							reporter: { displayName: "Bob" },
							priority: { name: "High" },
							labels: ["backend", "bug"],
							created: "2025-01-01T10:00:00.000Z",
							updated: "2025-01-02T15:30:00.000Z",
						},
					},
				],
				total: 1,
				startAt: 0,
				maxResults: 50,
			};

			const callMcpToolMock = mock(() => Promise.resolve(mockResult));
			(client as unknown as { callMcpTool: unknown }).callMcpTool =
				callMcpToolMock;

			const result = await client.searchIssues("project = PROJ", {
				maxResults: 10,
			});

			expect(callMcpToolMock).toHaveBeenCalledWith("jira_search", {
				jql: "project = PROJ",
				start_at: 0,
				limit: 10,
			});

			expect(result.issues).toHaveLength(1);
			expect(result.issues[0]).toMatchObject({
				key: "PROJ-1",
				summary: "Test Issue",
				status: "To Do",
				assignee: "Alice",
				priority: "High",
			});
		});
	});

	describe("getIssue", () => {
		it("should get issue with correct parameters", async () => {
			const client = new JiraClient();

			// Mock the MCP tool response - it returns fields at the top level, not nested
			const mockResult = {
				key: "PROJ-1",
				id: "10001",
				summary: "Test Issue",
				description: "Test description",
				status: { name: "To Do" },
				issue_type: { name: "Task" },
				created: "2025-01-01T10:00:00.000Z",
				updated: "2025-01-02T15:30:00.000Z",
			};

			const callMcpToolMock = mock(() => Promise.resolve(mockResult));
			(client as unknown as { callMcpTool: unknown }).callMcpTool =
				callMcpToolMock;

			const issue = await client.getIssue("PROJ-1");

			expect(callMcpToolMock).toHaveBeenCalledWith("jira_get_issue", {
				issue_key: "PROJ-1",
			});

			expect(issue).toMatchObject({
				key: "PROJ-1",
				summary: "Test Issue",
				status: "To Do",
			});
		});
	});

	describe("updateIssue", () => {
		it("should update issue with correct parameters", async () => {
			const client = new JiraClient();

			const callMcpToolMock = mock(() => Promise.resolve({}));
			(client as unknown as { callMcpTool: unknown }).callMcpTool =
				callMcpToolMock;

			await client.updateIssue("PROJ-1", {
				summary: "New Summary",
				description: "New description",
				assignee: "alice",
				priority: "High",
				labels: ["backend", "api"],
			});

			expect(callMcpToolMock).toHaveBeenCalledWith("jira_update_issue", {
				issue_key: "PROJ-1",
				fields: {
					summary: "New Summary",
					description: "New description",
					assignee: "alice",
					priority: { name: "High" },
					labels: ["backend", "api"],
				},
			});
		});
	});

	describe("getTransitions", () => {
		it("should get transitions with correct parameters", async () => {
			const client = new JiraClient();

			const mockResult = {
				transitions: [
					{
						id: "11",
						name: "To Do",
						to: {
							id: "1",
							name: "To Do",
						},
					},
					{
						id: "21",
						name: "In Progress",
						to: {
							id: "2",
							name: "In Progress",
						},
					},
				],
			};

			const callMcpToolMock = mock(() => Promise.resolve(mockResult));
			(client as unknown as { callMcpTool: unknown }).callMcpTool =
				callMcpToolMock;

			const transitions = await client.getTransitions("PROJ-1");

			expect(callMcpToolMock).toHaveBeenCalledWith("jira_get_transitions", {
				issue_key: "PROJ-1",
			});

			expect(transitions).toHaveLength(2);
			expect(transitions[0]).toMatchObject({
				id: "11",
				name: "To Do",
			});
		});
	});

	describe("transitionIssue", () => {
		it("should transition issue with correct parameters", async () => {
			const client = new JiraClient();

			const callMcpToolMock = mock(() => Promise.resolve({}));
			(client as unknown as { callMcpTool: unknown }).callMcpTool =
				callMcpToolMock;

			await client.transitionIssue("PROJ-1", "21", {
				comment: "Moving to In Progress",
			});

			expect(callMcpToolMock).toHaveBeenCalledWith("jira_transition_issue", {
				issue_key: "PROJ-1",
				transition_id: "21",
				comment: "Moving to In Progress",
			});
		});
	});

	describe("createIssue", () => {
		it("should create issue with correct parameters", async () => {
			const client = new JiraClient();

			const mockResult = {
				key: "PROJ-2",
				id: "10002",
				fields: {
					summary: "New Issue",
					description: "New description",
					status: { name: "To Do" },
					issuetype: { name: "Task" },
					created: "2025-01-03T10:00:00.000Z",
					updated: "2025-01-03T10:00:00.000Z",
				},
			};

			const callMcpToolMock = mock(() => Promise.resolve(mockResult));
			(client as unknown as { callMcpTool: unknown }).callMcpTool =
				callMcpToolMock;

			const issue = await client.createIssue("PROJ", "Task", "New Issue", {
				description: "New description",
				assignee: "alice",
				priority: "High",
				labels: ["backend"],
			});

			expect(callMcpToolMock).toHaveBeenCalledWith("jira_create_issue", {
				project_key: "PROJ",
				issue_type: "Task",
				summary: "New Issue",
				description: "New description",
				assignee: "alice",
				additional_fields: {
					priority: { name: "High" },
					labels: ["backend"],
				},
			});

			expect(issue).toMatchObject({
				key: "PROJ-2",
				summary: "New Issue",
				status: "To Do",
			});
		});
	});

	describe("External MCP Server Configuration", () => {
		let originalEnv: Record<string, string | undefined>;

		beforeEach(() => {
			// Save original environment
			originalEnv = {
				JIRA_URL: process.env.JIRA_URL,
				JIRA_USERNAME: process.env.JIRA_USERNAME,
				JIRA_API_TOKEN: process.env.JIRA_API_TOKEN,
				JIRA_EMAIL: process.env.JIRA_EMAIL,
				JIRA_PERSONAL_TOKEN: process.env.JIRA_PERSONAL_TOKEN,
			};

			// Set test environment
			process.env.JIRA_URL = "https://test.atlassian.net";
			process.env.JIRA_USERNAME = "test@example.com";
			process.env.JIRA_API_TOKEN = "test-token";
		});

		afterEach(() => {
			// Restore original environment
			for (const [key, value] of Object.entries(originalEnv)) {
				if (value === undefined) {
					delete process.env[key];
				} else {
					process.env[key] = value;
				}
			}
		});

		it("should create client with default Docker configuration", () => {
			const client = new JiraClient();
			expect(client).toBeDefined();
			// Access private fields for testing
			const clientInternal = client as unknown as {
				useExternalServer: boolean;
				dockerImage: string;
				fallbackToDocker: boolean;
			};
			expect(clientInternal.useExternalServer).toBe(false);
			expect(clientInternal.dockerImage).toBe(
				"ghcr.io/sooperset/mcp-atlassian:latest",
			);
			expect(clientInternal.fallbackToDocker).toBe(true);
		});

		it("should create client with external server configuration", () => {
			const options: JiraClientOptions = {
				useExternalServer: true,
				serverCommand: "mcp-atlassian-server",
				serverArgs: ["--debug"],
				fallbackToDocker: false,
			};
			const client = new JiraClient(options);
			expect(client).toBeDefined();

			// Access private fields for testing
			const clientInternal = client as unknown as {
				useExternalServer: boolean;
				serverCommand: string;
				serverArgs: string[];
				fallbackToDocker: boolean;
			};
			expect(clientInternal.useExternalServer).toBe(true);
			expect(clientInternal.serverCommand).toBe("mcp-atlassian-server");
			expect(clientInternal.serverArgs).toEqual(["--debug"]);
			expect(clientInternal.fallbackToDocker).toBe(false);
		});

		it("should validate credentials correctly", () => {
			const client = new JiraClient();

			// Access private method for testing
			const clientInternal = client as unknown as {
				validateAndPrepareCredentials(): Record<string, string>;
			};

			const envVars = clientInternal.validateAndPrepareCredentials();
			expect(envVars.JIRA_URL).toBe("https://test.atlassian.net");
			expect(envVars.JIRA_USERNAME).toBe("test@example.com");
			expect(envVars.JIRA_API_TOKEN).toBe("test-token");
		});

		it("should throw error for missing JIRA_URL", () => {
			process.env.JIRA_URL = undefined;
			const client = new JiraClient();

			const clientInternal = client as unknown as {
				validateAndPrepareCredentials(): Record<string, string>;
			};

			expect(() => clientInternal.validateAndPrepareCredentials()).toThrow(
				"Missing JIRA_URL environment variable.",
			);
		});

		it("should throw error for missing authentication credentials", () => {
			process.env.JIRA_USERNAME = undefined;
			process.env.JIRA_API_TOKEN = undefined;
			process.env.JIRA_EMAIL = undefined;
			process.env.JIRA_PERSONAL_TOKEN = undefined;
			const client = new JiraClient();

			const clientInternal = client as unknown as {
				validateAndPrepareCredentials(): Record<string, string>;
			};

			expect(() => clientInternal.validateAndPrepareCredentials()).toThrow(
				"Missing required Jira credentials",
			);
		});
	});
});
