---
id: task-305
title: Sync CLI version with package.json
status: Done
assignee:
  - '@agent-k'
created_date: '2025-10-14 08:20'
updated_date: '2025-10-14 08:24'
labels:
  - bug
  - maintenance
dependencies: []
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The CLI version displayed by --version flag should automatically match the version in package.json. Currently cli.ts hardcodes version 0.1.0 while package.json shows 0.1.3.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 CLI reads version from package.json instead of hardcoding
- [x] #2 Version displayed by backlog-jira --version matches package.json version
- [x] #3 Build process ensures version stays in sync
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Check how to import package.json in TypeScript/Bun
2. Update cli.ts to read version from package.json
3. Test that backlog-jira --version shows correct version
4. Ensure build process works correctly
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Fixed CLI version sync by importing package.json version.

## Changes:
- Added `import packageJson from "../package.json"` to cli.ts
- Changed hardcoded version "0.1.0" to `packageJson.version`
- Version now automatically reads from package.json

## Testing:
- Verified `bun run src/cli.ts --version` shows 0.1.3 ✓
- Verified build process completes successfully ✓
- Verified `node dist/cli.js --version` shows 0.1.3 ✓

The CLI version will now stay in sync with package.json automatically.
<!-- SECTION:NOTES:END -->
