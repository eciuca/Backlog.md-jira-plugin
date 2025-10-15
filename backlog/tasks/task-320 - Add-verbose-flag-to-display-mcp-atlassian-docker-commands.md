---
id: task-320
title: Add verbose flag to display mcp-atlassian docker commands
status: Done
assignee: []
created_date: '2025-10-15 09:50'
updated_date: '2025-10-15 17:37'
labels:
  - enhancement
  - docker
dependencies: []
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Add a --verbose flag that displays the actual docker commands being executed against the mcp-atlassian container for debugging and transparency purposes
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 CLI accepts --verbose or -v flag
- [x] #2 When verbose mode is enabled, docker commands are logged to stderr before execution
- [x] #3 Verbose output includes full docker command with all arguments
- [x] #4 Verbose flag works with all relevant commands that interact with the container
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Add --verbose/-v flag option to the mcp start command definition
2. Pass verbose flag through mcpStartCommand options
3. Create a helper function to log docker commands to stderr
4. Add verbose logging before docker spawn in startDockerServer
5. Test the implementation with mcp start --verbose
6. Verify output shows complete docker command with all args
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
## Summary
Added --verbose/-v flag to display docker commands executed against mcp-atlassian container.

## Changes Made
- Added `verbose` option to `McpStartOptions` interface
- Added `-v, --verbose` flag to mcp start command registration
- Passed verbose flag through to `startDockerServer` function
- Created `logDockerCommand` helper function that logs to stderr
- Integrated verbose logging before docker spawn call

## Implementation Details
- Verbose output goes to stderr (console.error) to avoid interfering with stdout/stdin piping
- Full docker command with all arguments is logged in cyan color for visibility
- Flag works consistently with existing --debug flag
- No breaking changes to existing functionality

## Testing
- All 203 existing tests pass
- Build succeeds without errors
- Help text displays new flag correctly
- Verbose logging function tested manually
<!-- SECTION:NOTES:END -->
