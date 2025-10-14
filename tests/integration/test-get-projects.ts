import { JiraClient } from "../../src/integrations/jira.ts";

async function testGetProjects() {
	const client = new JiraClient();
	try {
		console.log("Fetching Jira projects...");

		// Get projects using the public API
		const result = await client.getAllProjects();

		console.log("\n✓ Successfully retrieved projects!");
		console.log(
			`Found ${Array.isArray(result) ? result.length : 0} project(s)\n`,
		);

		if (Array.isArray(result) && result.length > 0) {
			console.log("Projects:");
			for (const project of result.slice(0, 5)) {
				console.log(`  - ${project.key}: ${project.name}`);
			}
		}

		await client.close();
		process.exit(0);
	} catch (error) {
		console.error("\n✗ Failed to get projects:");
		console.error(error instanceof Error ? error.message : String(error));
		try {
			await client.close();
		} catch (closeError) {
			// Ignore close errors
		}
		process.exit(1);
	}
}

testGetProjects();
