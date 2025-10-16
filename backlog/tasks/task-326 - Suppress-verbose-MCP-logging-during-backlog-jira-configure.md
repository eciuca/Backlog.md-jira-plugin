---
id: task-326
title: Suppress verbose MCP logging during backlog-jira configure
status: Done
assignee:
  - '@eciuca'
created_date: '2025-10-15 20:13'
updated_date: '2025-10-16 06:11'
labels:
  - logging
  - mcp
  - ux
dependencies: []
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The configure command displays excessive debug logging from MCP transport and Jira client initialization, including Docker command details and internal FastMCP logs. This should be hidden from users unless --verbose flag is used.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Identify all sources of verbose logging during configure command
- [x] #2 Suppress MCP transport initialization logs (Docker command, dockerArgs)
- [x] #3 Suppress FastMCP server startup logs
- [x] #4 Suppress internal INFO logs from Jira client tool calls
- [x] #5 Keep only user-facing messages (Step progress, success/error messages)
- [x] #6 Ensure --verbose flag still shows all logs for debugging
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Add LOG_LEVEL environment variable handling in configure command to temporarily suppress verbose logs
2. Modify logger level during configure command execution (set to warn unless verbose)
3. Update JiraClient to respect silentMode more thoroughly - suppress info logs about tool calls
4. Consider redirecting FastMCP stderr output (the "INFO - FastMCP..." messages)
5. Add --verbose flag support to configure command to restore full logging
6. Test that all logs are suppressed except user-facing messages
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
## Summary
Successfully suppressed verbose MCP logging during the configure command. Users now see only clean, user-facing messages unless they use the --verbose flag.

## Changes Made

### Updated Logger (`src/utils/logger.ts`)
- Added `setLogLevel()` function to dynamically change log level at runtime
- Added `getLogLevel()` function to retrieve current log level
- Enables temporary suppression of verbose logs

### Enhanced JiraClient Silent Mode (`src/integrations/jira.ts`)
- Updated `silentMode` to suppress ALL info-level logs, not just console output
- Suppressed: MCP transport initialization logs (Docker command, dockerArgs)
- Suppressed: Connection success messages
- Suppressed: "About to call MCP tool" and "MCP tool returned" logs
- Preserved: Debug logs remain available when verbose mode is on

### Updated Configure Command (`src/commands/configure.ts`)
- Added `verbose` option to ConfigureOptions interface
- Set log level to "warn" by default (only warnings and errors shown)
- Wrapped command in try-finally to restore original log level
- Clean exit ensures proper log level restoration

### Added Verbose Flag (`src/cli.ts`)
- Added `-v, --verbose` flag to configure command
- When used, shows full debug logging including MCP internals
- Without flag, users see only step progress and success/error messages

## What Users See Now

**Without --verbose (default):**
- Step progress messages ("Step 5: Testing Connection")
- Success/error indicators (✓/✗)
- User prompts and responses
- NO Docker commands, NO MCP logs, NO internal INFO messages

**With --verbose:**
- All the above PLUS
- Docker command details
- MCP transport initialization
- Tool call logging
- Full debug output

## Testing
- All 235 tests passing
- Linting: All files pass biome checks
- Build: Successful

## Impact
- Dramatically improves UX for configure command
- Removes technical noise from user-facing output
- Preserves debugging capability with --verbose flag
- No breaking changes to existing functionality
<!-- SECTION:NOTES:END -->
