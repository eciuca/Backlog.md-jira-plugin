# Research: Interactive CLI Command Patterns in Backlog.md

## Context
This document summarizes research into how the parent Backlog.md project handles interactive CLI commands, process cleanup, and stdin management after using interactive prompts.

**Goal**: Understand the correct pattern for ensuring clean process exit after using @inquirer/prompts or similar interactive libraries.

---

## Key Findings

### 1. **Interactive Prompt Libraries Used**

Backlog.md uses **two different libraries** for interactive prompts:

- **`prompts`** (npm package) - Used for most interactive selections and confirmations
  - File: `src/cli.ts` - imports `prompts from "prompts"`
  - Used in: init wizard, agent selection, config wizard, cleanup confirmation
  
- **`node:readline/promises`** - Used for simple text input
  - File: `src/ui/tui.ts` - Function `promptText()`
  - Pattern: Creates interface, gets answer, **explicitly calls `rl.close()`**

### 2. **The `promptText()` Pattern - Simple Text Input**

Located in `src/ui/tui.ts` (lines 37-44):

```typescript
export async function promptText(message: string, defaultValue = ""): Promise<string> {
	// Always use readline for simple text input to avoid blessed rendering quirks
	const { createInterface } = await import("node:readline/promises");
	const rl = createInterface({ input, output });
	const answer = (await rl.question(`${message} `)).trim();
	rl.close();  // ← EXPLICIT CLOSE
	return answer || defaultValue;
}
```

**Key Pattern**: **Always explicitly close the readline interface** with `rl.close()`.

### 3. **The `prompts` Library Pattern - No Explicit Cleanup**

The parent project uses the `prompts` library extensively (imported at top of `cli.ts`), and **does NOT explicitly close stdin or cleanup after prompts**.

Examples from `src/cli.ts`:
- Lines 463-494: Integration mode selection (multiselect prompt)
- Lines 552-598: Agent file selection (multiselect prompt)  
- Lines 642-671: MCP client selection (multiselect prompt)
- Lines 790-804: Advanced config confirmation

**Pattern observed**: 
- Call `await prompts({ ... })` 
- Handle response
- **No explicit cleanup or stdin.close()**
- Process exits naturally when command completes

### 4. **Advanced Config Wizard** (`src/commands/advanced-config-wizard.ts`)

This file shows the most extensive use of prompts with no cleanup:
- Multiple sequential `await promptImpl(...)` calls (lines 44-226)
- Uses custom `PromptRunner` type for testability
- **No stdin cleanup anywhere**
- Returns results, caller handles what to do next

**Key Pattern**: The `prompts` library appears to handle its own cleanup internally.

### 5. **Process Exit Patterns**

Throughout `cli.ts`, the project uses these patterns:

**For Errors**:
```typescript
process.exitCode = 1;
return;
```

**For Explicit Exit**:
```typescript
process.exit(0);  // or process.exit(1)
```

**Natural Exit**:
- Most commands just `return` and let Node.js exit naturally
- The CLI entry point (line 3006-3011) uses `program.parseAsync(process.argv).finally(...)` 
- **No explicit process.exit() at the end**

### 6. **Interactive UI Views (TUI)**

Files: `src/ui/unified-view.ts`, `src/ui/board.ts`, `src/ui/task-viewer-with-search.ts`

**Pattern for blessed/neo-neo-bblessed UI**:
```typescript
screen.destroy();  // Destroys the blessed screen
resolve();         // Resolves the promise
```

In some cases (lines 208, 290 of `unified-view.ts`):
```typescript
if (result === "exit") {
	process.exit(0);  // Explicit exit when user wants to quit
}
```

**Key Insight**: Interactive TUI views use `screen.destroy()` for cleanup, then either:
- Resolve promise to continue (for view switching)
- Call `process.exit(0)` for final exit

### 7. **Cleanup Functions Pattern**

From `src/cli.ts` (lines 1277-1280):
```typescript
const cleanup = () => {
	searchService.dispose();
	contentStore.dispose();
};
```

This cleanup is called:
- Before early returns due to errors (lines 1305, 1317)
- Before showing plain text results (line 1334)
- After interactive UI completes (line 1375)

**Pattern**: Create cleanup function, call it before all exit paths.

---

## Analysis: Why @inquirer/prompts Might Be Hanging

Based on the research, the `prompts` library in Backlog.md doesn't require explicit stdin cleanup, but `@inquirer/prompts` (different library) might have different behavior.

**Possible reasons for hanging**:

1. **@inquirer/prompts vs prompts**: Different libraries, different internal handling
2. **stdin not cleaned up**: @inquirer might not auto-cleanup stdin like prompts does
3. **Event loop kept alive**: stdin listeners might keep process alive

**Evidence from Backlog.md**:
- `readline` explicitly needs `.close()` (line 42 of tui.ts)
- `prompts` library doesn't need explicit cleanup
- Process exits naturally when commands complete

---

## Recommended Solution for Jira Plugin

Based on Backlog.md patterns, here's the recommended approach:

### Option 1: Explicit stdin cleanup (safest)
```typescript
import { stdin as input } from "node:process";

async function myInteractiveCommand() {
	// ... use @inquirer/prompts ...
	
	// Cleanup before exit
	if (input.isTTY && typeof input.unref === "function") {
		input.unref();
	}
	// Or: input.pause(); input.destroy();
}
```

### Option 2: Switch to `prompts` library (like parent)
```typescript
import prompts from "prompts";

const response = await prompts({
	type: "text",
	name: "value", 
	message: "Enter value:"
});
// No cleanup needed
```

### Option 3: Force exit (nuclear option)
```typescript
// After all work is done
process.exit(0);
```

---

## Testing Pattern

From `src/test/enhanced-init.test.ts` and other test files:

```typescript
// Tests mock stdin/stdout to avoid hanging
const mockStdin = new PassThrough();
const mockStdout = new PassThrough();
```

**Key**: Tests don't use real stdin, avoiding the hanging issue in test environments.

---

## Conclusion

1. **Backlog.md uses `prompts` library** which handles its own cleanup
2. **For `readline`**, explicit `.close()` is required
3. **For @inquirer/prompts**, may need explicit stdin cleanup
4. **Pattern**: Either cleanup stdin explicitly OR switch to `prompts` library
5. **Natural exit** is preferred over explicit `process.exit()` when possible

The parent project's pattern suggests that using the right library (`prompts`) removes the need for manual stdin cleanup. If sticking with @inquirer/prompts, explicit stdin cleanup is likely needed.
