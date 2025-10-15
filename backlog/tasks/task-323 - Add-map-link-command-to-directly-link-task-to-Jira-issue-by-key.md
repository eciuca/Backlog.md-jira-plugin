---
id: task-323
title: Add map link command to directly link task to Jira issue by key
status: To Do
assignee: []
created_date: '2025-10-15 17:15'
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
- [ ] #1 Add 'backlog-jira map link <taskId> <jiraKey>' command to CLI
- [ ] #2 Validate that taskId exists in Backlog
- [ ] #3 Validate that jiraKey exists in Jira
- [ ] #4 Create mapping in SQLite database
- [ ] #5 Create initial snapshots for 3-way merge
- [ ] #6 Update task frontmatter with Jira metadata (jira_key, jira_url, jira_last_sync, jira_sync_state)
- [ ] #7 Handle case where mapping already exists (error or update)
- [ ] #8 Add --force flag to overwrite existing mapping
- [ ] #9 Log operation success/failure
- [ ] #10 Add unit tests for link command
- [ ] #11 Update README with usage examples
<!-- AC:END -->
