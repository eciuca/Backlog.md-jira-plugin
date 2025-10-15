---
id: task-322
title: Fix invalid priority mapping in Jira sync
status: Done
assignee:
  - '@eciuca'
created_date: '2025-10-15 10:30'
updated_date: '2025-10-15 17:48'
labels:
  - bug
  - jira-sync
dependencies: []
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The backlog-jira plugin is failing to pull/update tasks because it's using 'minor' as a priority value, which is not valid in Backlog.md. Valid priority values are: high, medium, low.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Map Jira priority values to valid Backlog.md priority values (high, medium, low)
- [ ] #2 Handle edge cases where Jira priorities don't match standard values
- [ ] #3 Update priority mapping logic to convert 'Minor' to 'low', 'Major' to 'medium', 'Critical'/'Blocker' to 'high'
- [ ] #4 Test the fix by running a sync operation with task-1
<!-- AC:END -->
