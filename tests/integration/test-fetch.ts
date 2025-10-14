import { JiraClient } from "../../src/integrations/jira.ts";

async function testFetch() {
    const client = new JiraClient();
    try {
        const projectKey = process.env.JIRA_PROJECT_KEY || "S20";
        console.log(`Fetching issues from project ${projectKey}...`);
        
        const result = await client.searchIssues(`project = ${projectKey}`, {
            maxResults: 5
        });
        
        console.log(`\n✓ Connection successful!`);
        console.log(`✓ Found ${result.total} total issues in project ${projectKey}`);
        console.log(`  Retrieved ${result.issues.length} issues in this query`);
        
        if (result.issues.length > 0) {
            console.log(`\nSample issues:`);
            for (const issue of result.issues.slice(0, 3)) {
                console.log(`  - ${issue.key}: ${issue.summary}`);
            }
        } else {
            console.log(`\nNo issues found in project ${projectKey}`);
        }
        
        await client.close();
        process.exit(0);
    } catch (error) {
        console.error("\n✗ Failed to fetch data:");
        console.error(error instanceof Error ? error.message : String(error));
        try {
            await client.close();
        } catch (closeError) {
            // Ignore close errors
        }
        process.exit(1);
    }
}

testFetch();
