---
id: task-307
title: Add integration test for clean installation workflow
status: Done
assignee:
  - '@agent-k'
created_date: '2025-10-14 08:40'
updated_date: '2025-10-14 10:29'
labels:
  - testing
  - integration
  - ci
dependencies: []
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
During testing of task-306, we discovered that running backlog-jira commands in a clean directory fails with dependency errors. We need an automated integration test that verifies the complete installation workflow works correctly.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Create a test script that simulates a clean installation environment
- [x] #2 Test runs 'backlog init' to initialize Backlog.md project
- [x] #3 Test runs 'backlog-jira init' to initialize the plugin
- [x] #4 Verify both commands complete successfully without errors
- [x] #5 Test should verify required dependencies are found (node_modules, etc.)
- [x] #6 Run test in both local development and simulated clean environment (Docker)
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Create integration test directory structure (tests/integration/)
2. Create a shell script test for clean installation workflow
3. Add test that verifies backlog init works in clean directory
4. Add test that verifies backlog-jira init works after backlog init
5. Create Dockerfile for simulated clean environment testing
6. Add npm script to run integration tests
7. Document how to run integration tests in README or test docs
8. Run tests locally and in Docker to verify both scenarios
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Created comprehensive integration test for clean installation workflow that addresses the issue discovered in task-306.

## What was implemented:

1. **Test script** (`tests/integration/test-clean-install.sh`):
   - Creates isolated temporary directory for testing
   - Verifies clean environment (no existing backlog or node_modules)
   - Tests complete workflow: git init → backlog init → backlog-jira init
   - Validates dependencies are correctly resolved (pino, pino-pretty)
   - Checks for hardcoded paths in bundle
   - Automatic cleanup on exit

2. **Docker support** (`tests/integration/Dockerfile`):
   - Alpine-based Linux environment for cross-platform testing
   - Documented limitation: requires backlog CLI on npm (not yet published)
   - Ready to use once backlog.md is published

3. **Documentation** (`tests/integration/README.md`):
   - Comprehensive usage instructions
   - Prerequisites and troubleshooting guide
   - Expected output examples

4. **npm script**: Added `test:integration` to package.json

## Testing:

- ✅ Local test passes successfully on macOS
- ✅ All 7 test scenarios pass
- ✅ Verifies the fix from task-306 works correctly
- ⚠️ Docker test requires backlog CLI on npm (future work)

## Key features:

- Non-interactive: uses `--defaults` flag with project name
- Portable: works in any bash environment
- Safe: uses temporary directories with automatic cleanup
- Informative: colored output with clear status messages
- Comprehensive: tests all aspects of clean installation

## Note on Docker testing:

Discovered that there is an unrelated "backlog" package on npm (version 0.0.3 from 2013, a file logging utility by jawerty). This is not the Backlog.md project management CLI we need. The Backlog.md CLI from https://github.com/codevalley/backlog.md is not yet published to npm.

For future Docker testing, Backlog.md will need to be published under a different package name (e.g., `@backlog/cli`, `backlog-md`, or similar) to avoid confusion with the existing npm package.

## Update: Docker testing now fully working!

Fixed Docker configuration:
- Corrected package name: `npm install -g backlog.md` (not `backlog`)
- Switched from Alpine to Debian-based image (node:20-slim) for better binary compatibility
- Added Bun runtime installation (required for backlog-jira CLI shebang)
- All 7 integration tests now pass successfully in Docker

✅ Both local (macOS) and Docker (Linux) testing confirmed working!
<!-- SECTION:NOTES:END -->
