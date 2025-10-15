---
id: task-320
title: Add verbose flag to display mcp-atlassian docker commands
status: Done
assignee:
  - '@eciuca'
created_date: '2025-10-15 09:50'
updated_date: '2025-10-15 17:48'
labels:
  - enhancement
  - docker
dependencies: []
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Add a --verbose flag that displays the actual docker commands being executed against the mcp-atlassian container for debugging and transparency purposes
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 CLI accepts --verbose or -v flag
- [ ] #2 When verbose mode is enabled, docker commands are logged to stderr before execution
- [ ] #3 Verbose output includes full docker command with all arguments
- [ ] #4 Verbose flag works with all relevant commands that interact with the container
<!-- AC:END -->
