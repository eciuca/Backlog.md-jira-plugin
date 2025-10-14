---
id: task-312
title: Fix backlog-jira init command hanging after completion
status: Done
assignee:
  - '@agent-k'
created_date: '2025-10-14 14:16'
updated_date: '2025-10-14 15:08'
labels:
  - bug
  - cli
dependencies: []
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The backlog-jira init command successfully initializes the configuration and database, but leaves the terminal in a hanging/stuck state instead of returning control to the user.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Terminal returns control to user after init completion
- [x] #2 All init functionality continues to work correctly
- [x] #3 Logs are properly flushed before exit
- [x] #4 Process exits cleanly with appropriate exit code
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Analyze the init.ts file to identify potential hanging issues
2. Check for async operations that might not be properly awaited or closed
3. Verify the logger is properly flushed before exit
4. Test the fix with the init command
5. Verify all acceptance criteria are met
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
## Research Findings

From RESEARCH_INTERACTIVE_CLI_PATTERNS.md:
- Parent Backlog.md uses `prompts` library (NOT @inquirer/prompts)
- `prompts` handles stdin cleanup automatically - no manual cleanup needed
- `@inquirer/prompts` is different library that leaves stdin listeners active
- Parent project pattern: use `prompts` library OR explicit cleanup for `readline`

## Root Cause
@inquirer/prompts does not auto-cleanup stdin listeners, causing the event loop to stay alive.

## Solution
Switch from @inquirer/prompts to prompts library (align with parent project)

## Implementation Progress

### Phase 1: init.ts - COMPLETE ✅
- Replaced @inquirer/prompts with prompts library
- All prompts now use prompts API (confirm, select, multiselect)
- Added proper cancellation handling (Ctrl+C)
- Removed all manual stdin cleanup code (no longer needed)
- Tested: Process exits cleanly

### Phase 2: configure.ts and conflict-resolver.ts - TODO
These files also use @inquirer/prompts and need to be migrated.

### Phase 2: Starting configure.ts and conflict-resolver.ts migration
- Both files still use @inquirer/prompts
- Need to migrate to prompts library for consistency

### Phase 2: configure.ts - COMPLETE ✅
- Migrated all @inquirer/prompts usage to prompts library
- Updated all prompt types: select, text, password, confirm
- Added proper cancellation handling for all prompts
- No manual stdin cleanup needed anymore

### Phase 3: conflict-resolver.ts - COMPLETE ✅
- Migrated all @inquirer/prompts usage to prompts library
- Updated all prompt types: select, text, confirm
- Added proper cancellation handling

### Migration Complete! ✅
- All files now use prompts library (consistent with parent Backlog.md)
- No manual stdin cleanup needed
- Package @inquirer/prompts removed from dependencies
- Build successful with no TypeScript errors
- Help command returns immediately (no hanging)
<!-- SECTION:NOTES:END -->
