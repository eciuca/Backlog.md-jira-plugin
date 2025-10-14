---
id: task-314
title: Fix strange characters in interactive prompt output
status: To Do
assignee: []
created_date: '2025-10-14 15:16'
labels:
  - bug
  - ux
dependencies: []
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The interactive prompts display strange Unicode characters (âº, â, â¦) instead of clean symbols. These should be replaced with simple ASCII characters or properly handled for terminal display.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Interactive prompts display clean, readable characters
- [ ] #2 No Unicode rendering issues in terminal output
- [ ] #3 Prompts work correctly across different terminal environments
<!-- AC:END -->
