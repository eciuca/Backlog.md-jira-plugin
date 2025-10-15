# Development Guidelines

## Project Overview

This document contains development guidelines and best practices for the backlog-jira plugin.

## CLI Command Development

### Working with Interactive Prompts

When developing CLI commands that use the `prompts` library for interactive input, follow these critical guidelines:

#### ⚠️ Always Exit Explicitly After Prompts

**Problem**: The `prompts` library keeps stdin open after the last prompt completes. If your command function simply returns without explicitly exiting, the terminal will hang and require manual intervention (Ctrl+C) to regain control.

**Solution**: Always call `process.exit(0)` at the end of any command function that uses prompts.

**Example - WRONG**:
```typescript
export async function myCommand(): Promise<void> {
  const response = await prompts({
    type: "text",
    name: "value",
    message: "Enter value:",
  });
  
  console.log("Done!");
  // ❌ Function ends here - terminal will hang!
}
```

**Example - CORRECT**:
```typescript
export async function myCommand(): Promise<void> {
  const response = await prompts({
    type: "text",
    name: "value",
    message: "Enter value:",
  });
  
  console.log("Done!");
  
  // ✅ Explicitly exit to return control to terminal
  process.exit(0);
}
```

#### Handling User Cancellation

When a user cancels a prompt (Ctrl+C or ESC), the response value will be `undefined`. Always check for this and exit cleanly:

```typescript
const response = await prompts({
  type: "confirm",
  name: "confirm",
  message: "Continue?",
});

if (response.confirm === undefined) {
  console.log(chalk.yellow("\n✗ Cancelled.\n"));
  process.exit(0);  // ✅ Exit cleanly on cancellation
}
```

#### Multiple Exit Points

Commands with multiple prompts may have multiple exit points. Ensure ALL paths exit explicitly:

```typescript
export async function myCommand(): Promise<void> {
  const step1 = await prompts({ /* ... */ });
  
  if (step1.value === undefined) {
    console.log("Cancelled.");
    process.exit(0);  // ✅ Exit point 1
  }
  
  const step2 = await prompts({ /* ... */ });
  
  if (step2.value === undefined) {
    console.log("Cancelled.");
    process.exit(0);  // ✅ Exit point 2
  }
  
  // Do work...
  console.log("Success!");
  process.exit(0);  // ✅ Exit point 3 (success path)
}
```

#### Error Handling

The CLI action handlers in `cli.ts` already call `process.exit(1)` on errors, but your command should still handle expected errors gracefully:

```typescript
export async function myCommand(): Promise<void> {
  try {
    const response = await prompts({ /* ... */ });
    
    if (response.value === undefined) {
      process.exit(0);  // User cancellation
    }
    
    // Do work that might fail...
    
    console.log("Success!");
    process.exit(0);
    
  } catch (error) {
    // Let the error propagate to cli.ts handler
    // which will log it and call process.exit(1)
    throw error;
  }
}
```

### Command Structure Checklist

When creating a new command:

- [ ] Add command registration in `cli.ts`
- [ ] Implement command function in `src/commands/`
- [ ] Add error handler with `process.exit(1)` in cli.ts action
- [ ] If using prompts: Add `process.exit(0)` at ALL exit points
- [ ] Handle user cancellation (check for `undefined`)
- [ ] Add tests in corresponding `.test.ts` file
- [ ] Update README.md with command documentation
- [ ] Update AGENTS.md if relevant to agent usage

## Testing

### Running Tests

```bash
# Run all tests
bun test

# Run specific test file
bun test src/commands/configure.test.ts

# Run integration tests
bun run test:integration
```

### Testing Interactive Commands

Interactive commands that use prompts are harder to test. Consider:

1. **Mock prompts**: Use mocking to simulate user input
2. **Non-interactive mode**: Add `--non-interactive` flag for CI/CD
3. **Integration tests**: Test the actual CLI binary in scripts

## Code Quality

### Coding Style Guidelines

#### Split Nested Function Calls for Readability

**Rule**: Avoid nesting constructor calls with function calls on the same line.

**Why**: Makes code harder to debug, read, and understand the execution order.

**Example - WRONG**:
```typescript
// ❌ Two method calls on same line - hard to debug
const jiraClient = new JiraClient(getJiraClientOptions());
```

**Example - CORRECT**:
```typescript
// ✅ Split into separate lines - clear execution order
const options = getJiraClientOptions();
const jiraClient = new JiraClient(options);
```

**Benefits**:
- Easier to set breakpoints for debugging
- Clear execution order
- Intermediate values can be inspected
- Stack traces are more informative
- Code is more maintainable

### Type Checking

```bash
bun run check:types
```

### Linting and Formatting

```bash
bun run check
```

### Pre-publish Checks

Before publishing, the following run automatically:

```bash
npm run prepublishOnly
# Runs: build, check, and test
```

## Common Patterns

### Loading Configuration

```typescript
import { readFileSync } from "node:fs";
import { join } from "node:path";

const configPath = join(process.cwd(), ".backlog-jira", "config.json");
const config = JSON.parse(readFileSync(configPath, "utf-8"));
```

### Using the Jira Client

```typescript
import { JiraClient } from "../integrations/jira.ts";
import { getJiraClientOptions } from "../utils/jira-config.ts";

// Always load configuration to get MCP server args (e.g., DNS settings)
const options = getJiraClientOptions();
const jiraClient = new JiraClient(options);
const projects = await jiraClient.getAllProjects();
await jiraClient.close();  // Always close when done!
```

### Logging

```typescript
import { logger } from "../utils/logger.ts";

logger.info("Information message");
logger.error({ error }, "Error occurred");
logger.debug({ data }, "Debug information");
```

## Troubleshooting

### Terminal Hangs After Command

**Symptom**: Command completes but doesn't return to shell prompt.

**Cause**: Missing `process.exit(0)` after using prompts library.

**Fix**: Add `process.exit(0)` at the end of the command function.

### Build Fails

**Symptom**: `bun run build` fails with module resolution errors.

**Cause**: Missing dependencies.

**Fix**: Run `bun install`

## Resources

- [prompts documentation](https://github.com/terkelg/prompts)
- [commander.js documentation](https://github.com/tj/commander.js)
- [Bun documentation](https://bun.sh/docs)
