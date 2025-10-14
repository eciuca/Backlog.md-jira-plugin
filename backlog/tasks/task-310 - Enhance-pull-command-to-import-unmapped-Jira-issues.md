---
id: task-310
title: Enhance pull command to import unmapped Jira issues
status: To Do
assignee: []
created_date: '2025-10-14 12:35'
labels:
  - enhancement
  - ux
dependencies: []
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Currently, the pull command only works with already-mapped Backlog tasks. Users cannot import existing Jira issues as new Backlog tasks without manually creating and mapping each one first. This creates friction when trying to pull an existing Jira project into Backlog.

The pull command should be enhanced to automatically create Backlog tasks for unmapped Jira issues found via the JQL filter in config, enabling true import functionality without requiring a separate import command.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Pull command fetches Jira issues using JQL filter from config when no task IDs specified
- [ ] #2 For each unmapped Jira issue found, create a new Backlog task via CLI
- [ ] #3 Automatically create mapping between new task and Jira issue
- [ ] #4 Pull/sync the Jira data into the newly created task
- [ ] #5 Support --dry-run to preview what would be imported
- [ ] #6 Add --import flag to explicitly enable import mode (default: only sync mapped tasks)
- [ ] #7 Preserve existing behavior: without --import, only pull mapped tasks
- [ ] #8 Log which tasks were imported vs updated in the operation summary
- [ ] #9 Handle Jira fields mapping: title, description, status, assignee, labels, priority
- [ ] #10 Strip AC section from Jira description and convert to Backlog AC format
- [ ] #11 Update documentation and README with import workflow examples
<!-- AC:END -->
