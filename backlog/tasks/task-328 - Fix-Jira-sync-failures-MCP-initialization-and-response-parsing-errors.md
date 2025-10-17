---
id: task-328
title: 'Fix Jira sync failures: MCP initialization and response parsing errors'
status: Done
assignee:
  - '@myself'
created_date: '2025-10-17 09:53'
updated_date: '2025-10-17 09:57'
labels:
  - bug
  - jira-sync
dependencies: []
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The backlog-jira sync command fails with two types of errors: 1) MCP tool calls fail with 'Invalid request parameters' error code -32602 before initialization completes, and 2) TypeError when parsing Jira API responses that return unexpected string types instead of structured data. This affects tasks task-2 and task-7 during sync/push operations.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 MCP server initialization completes before processing requests
- [x] #2 Jira API responses are validated and handle string error responses gracefully
- [x] #3 Sync operation successfully processes tasks without MCP -32602 errors
- [x] #4 Error handling catches and reports TypeError from jira.get_issue properly
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Add initialization wait mechanism to ensureConnected() to ensure MCP server is fully ready
2. Add response validation in callMcpTool() to detect and handle error string responses
3. Add null-safety checks in getIssue() before accessing nested properties like status.name
4. Add error type checking and better error messages for MCP initialization failures
5. Test sync operation with the fixes to ensure no -32602 errors and graceful error handling
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
## Summary
Fixed two critical issues causing Jira sync failures:

1. **MCP Initialization Race Condition (-32602 errors)**
   - Added `waitForServerReady()` method that waits up to 5 seconds for MCP server initialization
   - Polls `listTools()` with 500ms intervals to ensure server is ready before processing requests
   - Prevents "Invalid request parameters" errors from premature tool calls

2. **Response Validation and Error Handling**
   - Enhanced `callMcpTool()` to validate response structure and detect error strings
   - Added `isErrorResponse()` helper to identify error messages in text responses
   - Added null-safety checks in `getIssue()` for nested properties (e.g., `status?.name`)
   - Improved error messages to distinguish MCP initialization errors from other failures

## Changes Made
- Modified `ensureConnected()` to call `waitForServerReady()` after connection
- Added retry logic with exponential backoff for initialization
- Enhanced `callMcpTool()` with pre-flight error detection
- Made all `getIssue()` response fields optional with safe defaults
- Added specific error handling for -32602 MCP errors

## Testing
- All 235 existing tests pass
- Build completes successfully without TypeScript errors
- Error paths are properly validated and logged
<!-- SECTION:NOTES:END -->
