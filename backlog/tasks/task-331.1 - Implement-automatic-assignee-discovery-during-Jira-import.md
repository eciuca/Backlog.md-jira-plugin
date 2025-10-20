---
id: task-331.1
title: Implement automatic assignee discovery during Jira import
status: Done
assignee:
  - '@agent-k'
created_date: '2025-10-19 09:27'
updated_date: '2025-10-19 09:42'
labels:
  - enhancement
  - jira-integration
dependencies: []
parent_task_id: task-331
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Automatically discover and save assignee mappings when importing Jira issues to Backlog tasks. When a Jira user is encountered during import/pull operations, attempt to find a matching Backlog user based on name similarity and save the mapping to config.json for transparency.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Detect new Jira users during pull/import operations
- [x] #2 Attempt name-based matching between Jira displayName and Backlog assignees
- [x] #3 Save discovered mappings to config.json under autoMappedAssignees
- [x] #4 Log auto-discovered mappings for user review
- [x] #5 Provide option to approve/reject auto-discovered mappings
- [x] #6 Auto-discovered mappings are overridden by explicit mappings
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Analyze the codebase to understand where and how assignee handling occurs during Jira import
2. Design the automatic discovery logic for name-based matching
3. Create utility functions for discovering and saving assignee mappings
4. Integrate automatic discovery into the pull/import flow
5. Add logging for discovered mappings
6. Test the implementation with various scenarios
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented automatic assignee discovery during Jira import/pull operations.

Key changes:
- Added Levenshtein distance-based name similarity calculation in assignee-mapping.ts
- Implemented findBestAssigneeMatch() to find the best Backlog assignee match for a Jira user
- Implemented saveAutoDiscoveredMapping() to save discovered mappings to config.json under autoMappedAssignees
- Implemented autoDiscoverAndSaveMapping() as the main entry point for auto-discovery
- Added getAvailableBacklogAssignees() helper to extract unique assignees from existing tasks
- Integrated auto-discovery into importJiraIssue() function (during import operations)
- Integrated auto-discovery into pullTask() function (during pull operations)
- Auto-discovered mappings respect explicit mappings (won't override)\n- Comprehensive logging at info/warn/debug levels for user visibility\n\nBehavior:\n- When importing/pulling a Jira issue with an assignee that has no mapping:\n  1. System attempts to match Jira displayName against existing Backlog assignees\n  2. Uses Levenshtein distance with minimum similarity threshold of 0.6 (60%)\n  3. If a good match is found, saves it to config.json under autoMappedAssignees\n  4. Logs the discovered mapping for user review\n  5. Falls back to using Jira identifier if no match found\n\nFiles modified:\n- src/utils/assignee-mapping.ts: Added discovery and persistence functions\n- src/commands/pull.ts: Integrated auto-discovery into import and pull flows

Approve/Reject Functionality:
- Users can review auto-discovered mappings with: backlog-jira map-assignees show
- To approve (promote to explicit): backlog-jira map-assignees promote @user
- To reject (remove): backlog-jira map-assignees remove @user
- Remove command now handles both explicit and auto-discovered mappings
- Promote command moves auto-discovered mapping to explicit mapping section
<!-- SECTION:NOTES:END -->
