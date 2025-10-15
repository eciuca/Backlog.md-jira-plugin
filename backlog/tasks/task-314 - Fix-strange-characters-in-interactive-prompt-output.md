---
id: task-314
title: Fix strange characters in interactive prompt output
status: Done
assignee:
  - '@agent-k'
created_date: '2025-10-14 15:16'
updated_date: '2025-10-14 15:35'
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
- [x] #1 Interactive prompts display clean, readable characters
- [x] #2 No Unicode rendering issues in terminal output
- [x] #3 Prompts work correctly across different terminal environments
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Research the prompts library Unicode character issue
2. Identify configuration options to use ASCII-only characters
3. Update all prompt configurations to use ASCII characters
4. Test the changes in different terminal environments
5. Verify all acceptance criteria are met
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
## Root Cause
Build target mismatch: building with `--target=node` but using `#!/usr/bin/env bun` shebang caused UTF-8 double-encoding.

When the build target and runtime don't match:
- UTF-8 character `›` (e2 80 ba) gets double-encoded to (c3 a2 c2 80 c2 ba)
- Displays as `âº` instead of `›`

## Solution
Changed build configuration to match runtime:
- Build: `--target=bun`
- Shebang: `#!/usr/bin/env bun`
- External dependencies (better-sqlite3, pino, pino-pretty) still work correctly

## Files Changed
- package.json: Updated build script to use `--target=bun`
- src/cli.ts: Added comment explaining build/runtime matching requirement
- /home/eciuca/workspace/Backlog.md/src/core/plugin-router.ts: Added UTF-8 locale env vars (defense in depth)
- README.md: Added UTF-8 terminal troubleshooting section

## Testing
Verified with `od -A x -t x1z` that output now contains correct UTF-8 bytes:
- Before: `c3 a2 c2 80 c2 ba` (double-encoded)
- After: `e2 80 ba` (correct UTF-8 for ›)

Tested both direct execution and through Backlog proxy - both work correctly.
<!-- SECTION:NOTES:END -->
