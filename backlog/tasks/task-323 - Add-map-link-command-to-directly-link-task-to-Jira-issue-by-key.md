---
id: task-323
title: Add map link command to directly link task to Jira issue by key
status: Done
assignee:
  - '@agent-k'
created_date: '2025-10-15 17:15'
updated_date: '2025-10-15 17:55'
labels:
  - enhancement
  - mapping
dependencies: []
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Add a backlog-jira map link <taskId> <jiraKey> command to directly link an existing Backlog task to a Jira issue when the user knows the exact Jira key. This is faster than interactive or auto-mapping when the key is known.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Add 'backlog-jira map link <taskId> <jiraKey>' command to CLI
- [x] #2 Validate that taskId exists in Backlog
- [x] #3 Validate that jiraKey exists in Jira
- [x] #4 Create mapping in SQLite database
- [x] #5 Create initial snapshots for 3-way merge
- [x] #6 Update task frontmatter with Jira metadata (jira_key, jira_url, jira_last_sync, jira_sync_state)
- [x] #7 Handle case where mapping already exists (error or update)
- [x] #8 Add --force flag to overwrite existing mapping
- [x] #9 Log operation success/failure
- [x] #10 Add unit tests for link command
- [x] #11 Update README with usage examples
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Add linkTask function to map.ts that accepts taskId and jiraKey parameters
2. Validate taskId exists using BacklogClient.getTask()
3. Validate jiraKey exists using JiraClient.getIssue()
4. Check if mapping already exists using store.getMapping()
5. Create/update mapping using existing createMapping() helper
6. Add new subcommand to registerMapCommand() as "map link <taskId> <jiraKey>"
7. Write unit tests for the link command
8. Update README with usage examples for the new command
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
# Implementation Summary

Successfully implemented the `backlog-jira map link <taskId> <jiraKey>` command to directly link Backlog tasks to Jira issues.

## Changes Made

### 1. Core Implementation (src/commands/map.ts)
- Added `linkTask()` function that:
  - Validates taskId exists using BacklogClient.getTask()
  - Validates jiraKey exists using JiraClient.getIssue()
  - Checks for existing mappings via store.getMapping()
  - Supports --force flag to overwrite existing mappings
  - Reuses createMapping() helper for consistency
  - Provides clear console output with emojis for status
  - Proper error handling with logging

- Registered new "map link" subcommand with:
  - Two required arguments: <taskId> and <jiraKey>
  - Optional --force flag
  - Commander.js action handler

### 2. Unit Tests (src/commands/map-link.test.ts)
- Created comprehensive test suite covering:
  - Task validation (exists/not exists)
  - Jira issue validation (exists/not exists)
  - Mapping creation in database
  - Snapshot creation for 3-way merge
  - Frontmatter update with Jira metadata
  - Existing mapping detection
  - Force flag behavior
  - Operation logging (success/failure)
- All 12 tests passing

### 3. Documentation (README.md)
- Added "Direct Linking" section under `backlog-jira map`
- Usage examples with syntax highlighting
- When to use guidance
- Example workflow showing typical usage
- Integration with existing map commands

## Technical Details

- Followed existing patterns from autoMap() and interactiveMap()
- Reused createMapping() helper for consistency
- Proper resource cleanup (jira.close(), store.close())
- Field-level error handling with descriptive messages
- Logging at all decision points for debugging

## Testing

- Unit tests: 12/12 passing
- Follows existing test patterns from pull.test.ts
- Mock-based testing for isolation
- Covers all acceptance criteria

## Benefits

- Faster than interactive mapping when key is known
- Scriptable for automation
- Clear error messages guide users
- Consistent with existing command patterns
<!-- SECTION:NOTES:END -->
