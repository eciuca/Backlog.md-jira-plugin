---
id: task-324
title: Add create-issue command to create Jira issue from unmapped Backlog task
status: To Do
assignee: []
created_date: '2025-10-15 17:15'
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
- [ ] #1 Add 'backlog-jira create-issue <taskId>' command to CLI
- [ ] #2 Validate that taskId exists in Backlog
- [ ] #3 Validate that taskId is not already mapped to Jira issue
- [ ] #4 Read task metadata (title, description, status, assignee, labels, priority, AC)
- [ ] #5 Map Backlog status to Jira status using configured status mapping
- [ ] #6 Map Backlog assignee to Jira user (resolve email/username to account ID)
- [ ] #7 Map Backlog labels to Jira labels
- [ ] #8 Map Backlog priority to Jira priority
- [ ] #9 Convert Backlog AC format to Jira description format or subtasks
- [ ] #10 Create Jira issue via MCP jira_create_issue tool
- [ ] #11 Create mapping between taskId and created Jira key
- [ ] #12 Create initial snapshots for 3-way merge
- [ ] #13 Update task frontmatter with Jira metadata
- [ ] #14 Add --dry-run flag to preview issue creation without creating
- [ ] #15 Add --issue-type <type> flag to override default issue type
- [ ] #16 Log operation success/failure with created Jira key
- [ ] #17 Add unit tests for create-issue command
- [ ] #18 Update README with usage examples
<!-- AC:END -->
