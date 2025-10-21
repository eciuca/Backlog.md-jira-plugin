---
id: task-334
title: Support creating Jira subtasks from Backlog subtasks in create-issue command
status: To Do
assignee: []
created_date: '2025-10-21 10:59'
labels:
  - enhancement
  - integration
dependencies: []
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Add support for creating Jira subtasks when the Backlog task has a parent task. The create-issue command should detect parent relationships and use the --parent flag when creating Jira issues, ensuring the parent-child hierarchy is preserved in Jira.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Add --parent <JIRA-KEY> flag to create-issue command
- [ ] #2 Auto-detect when Backlog task has a parent and look up parent's Jira mapping
- [ ] #3 Set issue type to 'Subtask' when --parent is provided or auto-detected
- [ ] #4 Pass parent field in additional_fields to jira_create_issue MCP tool
- [ ] #5 Update validation to ensure parent Jira issue exists before creating subtask
- [ ] #6 Update CLI help documentation for --parent flag
- [ ] #7 Add unit tests for subtask creation scenarios
- [ ] #8 Handle case where parent task exists in Backlog but not yet mapped to Jira
- [ ] #9 Update README with subtask creation examples
<!-- AC:END -->
