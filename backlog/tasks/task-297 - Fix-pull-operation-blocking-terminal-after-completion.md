---
id: task-297
title: Fix pull operation blocking terminal after completion
status: Done
assignee:
  - '@codex'
created_date: '2025-10-13 10:33'
updated_date: '2025-10-14 06:25'
labels:
  - backlog-jira
  - bug
dependencies: []
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The backlog-jira pull command successfully completes the operation and shows 'Pull Results' but doesn't exit cleanly - it continues running and blocks the terminal, requiring Ctrl+C to exit. The operation itself works correctly (task-289 was successfully pulled from S20-291), but the process should terminate automatically after showing the results.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Pull command exits cleanly after displaying results
- [x] #2 No manual Ctrl+C required after successful pull
- [x] #3 Process terminates with proper exit code (0 for success)
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Review the fix from task-293 for the status command
2. Apply same fix to pull.ts: add jira.close() in finally block
3. Add process.exit(0) after successful completion
4. Test that pull command exits cleanly without hanging
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Fixed the pull command hanging issue by applying the same solution used in task-293:

## Changes Made

1. **Added jira.close() in finally block**: The JiraClient maintains an MCP connection that wasn't being closed after the pull command completed. Added `await jira.close()` in the finally block alongside `store.close()` to ensure the MCP client connection is properly terminated.

2. **Added explicit process.exit(0)**: The pino-pretty logger transport creates a child process that keeps the event loop alive even after all async operations complete. Added `process.exit(0)` after successful pull command execution to ensure the process terminates cleanly.

## Testing

- All 139 tests pass, including 23 pull command tests
- Verified the fix matches the pattern used successfully in task-293

## Files Modified

- `src/commands/pull.ts`: Added `await jira.close()` in finally block (line 89) and `process.exit(0)` after completion (line 93)
<!-- SECTION:NOTES:END -->
