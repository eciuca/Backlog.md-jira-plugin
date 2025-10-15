---
id: task-324
title: Add create-issue command to create Jira issue from unmapped Backlog task
status: Done
assignee: []
created_date: '2025-10-15 17:15'
updated_date: '2025-10-15 18:01'
labels:
  - enhancement
  - integration
dependencies: []
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Add a backlog-jira create-issue <taskId> command to create a new Jira issue based on an existing Backlog task that is not yet mapped. This enables pushing Backlog tasks to Jira without manual issue creation.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Add 'backlog-jira create-issue <taskId>' command to CLI
- [x] #2 Validate that taskId exists in Backlog
- [x] #3 Validate that taskId is not already mapped to Jira issue
- [x] #4 Read task metadata (title, description, status, assignee, labels, priority, AC)
- [x] #5 Map Backlog status to Jira status using configured status mapping
- [x] #6 Map Backlog assignee to Jira user (resolve email/username to account ID)
- [x] #7 Map Backlog labels to Jira labels
- [x] #8 Map Backlog priority to Jira priority
- [x] #9 Convert Backlog AC format to Jira description format or subtasks
- [x] #10 Create Jira issue via MCP jira_create_issue tool
- [x] #11 Create mapping between taskId and created Jira key
- [x] #12 Create initial snapshots for 3-way merge
- [x] #13 Update task frontmatter with Jira metadata
- [x] #14 Add --dry-run flag to preview issue creation without creating
- [x] #15 Add --issue-type <type> flag to override default issue type
- [x] #16 Log operation success/failure with created Jira key
- [x] #17 Add unit tests for create-issue command
- [x] #18 Update README with usage examples
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Analyze existing push.ts and understand create vs update flow
2. Create new create-issue.ts command file
3. Implement validation logic (task exists, not mapped)
4. Implement metadata reading from Backlog task
5. Implement field mapping (status, assignee, priority, labels, AC)
6. Implement Jira issue creation via MCP tool
7. Implement mapping storage and snapshot creation
8. Implement frontmatter updates
9. Add CLI command registration in cli.ts
10. Add --dry-run and --issue-type flags
11. Write unit tests
12. Update README with usage examples
13. Test end-to-end with real task
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented backlog-jira create-issue command that creates Jira issues from unmapped Backlog tasks.

## Implementation Summary

**Core Functionality:**
- Created create-issue.ts with full validation, mapping, and creation logic
- Integrated with existing BacklogClient, JiraClient, and SyncStore
- Added CLI command registration in cli.ts with --dry-run and --issue-type flags

**Key Features:**
- Validates task existence and unmapped status
- Reads all task metadata including acceptance criteria
- Maps Backlog fields to Jira fields (priority, status, assignee, labels)
- Merges AC into Jira description format
- Creates issue via MCP jira_create_issue tool
- Stores mapping and initial snapshots for 3-way merge
- Updates task frontmatter with Jira metadata
- Supports dry-run mode for previewing
- Allows custom issue type override

**Testing:**
- Created comprehensive unit test suite (9 tests, all passing)
- Tests cover: success case, error cases, dry-run, custom issue type, field mapping
- Verified with manual dry-run on task-324 itself

**Documentation:**
- Added usage examples in README workflow section
- Added detailed command documentation in Commands section
- Documented flags, behavior, and error cases

## Files Modified
- src/commands/create-issue.ts (new)
- src/commands/create-issue.test.ts (new)
- src/cli.ts (added command registration)
- README.md (added documentation)

## PR Ready
All acceptance criteria met, tests passing, documentation complete.
<!-- SECTION:NOTES:END -->
