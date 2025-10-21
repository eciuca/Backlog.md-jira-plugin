---
id: task-333
title: Fix Jira push failing to update status to Done
status: Done
assignee:
  - '@eciuca'
created_date: '2025-10-21 07:33'
updated_date: '2025-10-21 07:39'
labels:
  - bug
  - jira-sync
dependencies: []
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The backlog-jira push command fails to transition issues to 'Done' status in Jira. Error occurs when trying to get transitions and find the correct transition ID for the target status.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Jira transitions API call succeeds for issue NCIS-3378
- [x] #2 Correct transition ID is identified for 'Done' status mapping
- [x] #3 Status update to Done pushes successfully to Jira
- [x] #4 Error handling provides clear diagnostic information
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Identify the root cause: MCP server returns transitions without "to" field showing destination status
2. Update JiraClient.getTransitions() to handle the actual MCP response format
3. Modify status-mapping.ts to work with transitions that may not have destination status
4. Add fallback logic: try transition by name matching if "to" field is missing
5. Update error logging to provide better diagnostics
6. Test with NCIS-3378 to verify Done status can be pushed
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
## Root Cause

The MCP server's `jira_get_transitions` API returns transitions without the `to` field that indicates the destination status. The response format is:
```json
[
  {"id": 6, "name": "Request more info to Reporter"},
  {"id": 5, "name": "Resolve Issue"}
]
```

Our code expected transitions with `to.name` fields to match against target statuses, causing the lookup to fail.

## Solution

### 1. Updated `JiraClient.getTransitions()` (src/integrations/jira.ts)
- Now handles both array and object response formats from MCP server
- Maps transitions to include placeholder `to` fields when missing
- Improved error logging with actual transition data

### 2. Enhanced `findBestTransitionMatch()` (src/utils/status-mapping.ts)
- Added three-pass matching strategy:
  1. Exact match on destination status (when available)
  2. Case-insensitive match on destination status
  3. **Fallback: Match by transition name** when `to.name` is empty
- Transition name patterns recognized:
  - "Resolve Issue", "Close Issue" → Done/Closed/Resolved
  - "Start Progress" → In Progress
  - Generic substring matching for other cases

### 3. Better Diagnostics
- Logs now show actual transition data instead of empty error objects
- Debug messages indicate when fallback name matching is used

## Testing

Verified with issue NCIS-3378:
- Before: Failed with "Failed to get Jira transitions" and empty error logs
- After: Successfully identifies "Resolve Issue" transition for Done status
- Dry-run push completes without errors

## Files Modified

- `src/integrations/jira.ts`: Enhanced transition parsing
- `src/utils/status-mapping.ts`: Added fallback name matching logic
<!-- SECTION:NOTES:END -->
