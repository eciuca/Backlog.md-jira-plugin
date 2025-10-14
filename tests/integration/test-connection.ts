import { JiraClient } from "../../src/integrations/jira.ts";

async function testConnection() {
	const client = new JiraClient();
	try {
		console.log("Connecting to Jira...");
		const success = await client.test();
		if (success) {
			console.log("✓ Jira connection successful");
			process.exit(0);
		} else {
			console.error("✗ Jira connection failed");
			process.exit(1);
		}
	} catch (error) {
		console.error("✗ Jira connection error:", error);
		process.exit(1);
	}
}

testConnection();
