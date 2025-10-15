---
id: task-315
title: 'Fix UI bug: INFO messages displayed before prompt during init'
status: Done
assignee:
  - '@agent-k'
created_date: '2025-10-14 15:38'
updated_date: '2025-10-14 15:39'
labels:
  - bugfix
dependencies: []
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
During 'backlog-jira init', the initialization success messages (config path, database path, logs path) were being displayed before the agent instructions setup prompt, creating a confusing user experience where the prompt appeared after unrelated output.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Move INFO messages to display after setupAgentInstructions() completes
- [x] #2 Ensure prompt appears first in the output sequence
- [x] #3 Verify success messages display after user completes setup
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Analyze init.ts code to identify the issue\n2. Move INFO log messages from before setupAgentInstructions() to after it\n3. Ensure proper spacing and flow of output messages\n4. Test the fix by running the init command
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Fixed UI bug in src/commands/init.ts by reordering the output sequence:\n\n- Moved INFO messages (lines 82-86) to display after setupAgentInstructions() completes\n- Agent instructions prompt now appears first, followed by success messages\n- Maintains proper spacing and logical flow of initialization output\n- User experience is now clean and intuitive\n\nFiles modified:\n- src/commands/init.ts: Reordered logger.info statements to appear after agent setup
<!-- SECTION:NOTES:END -->
