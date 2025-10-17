---
id: task-327
title: Reduce default verbosity of CLI commands
status: Done
assignee:
  - '@agent'
created_date: '2025-10-16 06:07'
updated_date: '2025-10-17 07:09'
labels:
  - enhancement
  - cli
dependencies: []
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Currently commands like 'pull' display detailed logs by default. Make commands output minimal information by default and only show detailed logs when --verbose flag is used.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Pull command outputs minimal information by default
- [x] #2 Pull command shows detailed logs with --verbose flag
- [x] #3 Push command outputs minimal information by default
- [x] #4 Push command shows detailed logs with --verbose flag
- [x] #5 Sync command outputs minimal information by default
- [x] #6 Sync command shows detailed logs with --verbose flag
- [x] #7 Other relevant commands follow same verbosity pattern
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Analyze current logging behavior in pull, push, and sync commands
2. Add --verbose flag to CLI commands (pull, push, sync)
3. Modify commands to set logger level based on --verbose flag
4. Update CLI output to be minimal by default (only show summary)
5. Test the changes with both default and --verbose modes
6. Check for other commands that might need similar treatment
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented verbosity control for CLI commands:

- Added --verbose/-v flag to pull, push, sync, and watch commands
- Modified all commands to suppress info/debug logs by default (set logger level to "error" for sync commands, "warn" for watch)
- Logger level is restored after command execution to avoid side effects
- Verbose mode shows full detailed logging as before
- All 235 tests pass successfully

Changes made:
1. src/cli.ts - Added --verbose option to pull, push, sync, and watch commands
2. src/commands/pull.ts - Added verbose option handling with log level control
3. src/commands/push.ts - Added verbose option handling with log level control
4. src/commands/sync.ts - Added verbose option handling with log level control
5. src/commands/watch.ts - Added verbose option handling with log level control and passes verbose flag to sync calls

The commands now output only summary information by default (already handled by CLI), while detailed logs are suppressed unless --verbose is used.
<!-- SECTION:NOTES:END -->
