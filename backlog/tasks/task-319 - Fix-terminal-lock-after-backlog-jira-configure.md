---
id: task-319
title: Fix terminal lock after backlog-jira configure
status: To Do
assignee: []
created_date: '2025-10-15 09:42'
labels:
  - bug
  - cli
dependencies: []
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
After running 'backlog-jira configure', the terminal becomes locked/unresponsive and requires user intervention to exit. The command should return control to the shell prompt immediately after completing the configuration.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Command exits cleanly after configuration is saved
- [ ] #2 Terminal prompt is restored without hanging
- [ ] #3 No manual intervention (Ctrl+C, etc.) is required to regain control
<!-- AC:END -->
