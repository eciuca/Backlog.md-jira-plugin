---
id: task-329
title: 'Fix Backlog-Jira push failure for NCIS-3378: invalid priority/transition'
status: In Progress
assignee:
  - '@myself'
created_date: '2025-10-17 11:40'
updated_date: '2025-10-17 14:32'
labels:
  - bug
dependencies: []
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Backlog-Jira push for task-7 failed when updating Jira issue NCIS-3378 with error:
"This priority is not available for this project."

Observed symptoms:
- Attempted updates: description and priority "Low"
- Jira responded with HTTP error; transitions lookup also failed for target status "◒ In Progress"
- Tooling hinted at possible proxy/HTML response issues from MCP (e.g., corporate proxy)

Suspected causes:
- Project priority scheme does not include "Low"; mapping from Backlog priority to Jira project-specific priorities is missing or incorrect
- Transition mapping/name mismatch for project workflow (status-to-transition resolution failing)
- Corporate proxy/NO_PROXY misconfiguration causing HTML responses to MCP Jira client

Notes (from logs):
- Issue key: NCIS-3378
- Failed field update: priority = "Low"
- Suggested remediation in logs: run `backlog-jira mcp start --debug`, consider HTTP(S)_PROXY/NO_PROXY in `.backlog-jira/config.json` under `mcp.envVars`, and authenticate to Jira in browser if behind corporate proxy

Scope:
- Make push resilient when priority is invalid for the target project and improve diagnostics for transition lookup and proxy issues
- Provide configuration and docs so users can fix mappings and environment easily

Out of scope:
- Changing Jira project configuration/schemes; focus is on plugin behavior and docs
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Handle invalid project priority mappings with fallback
- [x] #2 Skip or map priority update when not available; log clear guidance
- [ ] #3 Fix transition lookup for 'In Progress' (map by ID or name per project)
- [ ] #4 Improve MCP proxy/HTML response detection and error surfacing
- [x] #5 Document config: status/priority mapping + mcp.envVars (HTTP(S)_PROXY/NO_PROXY), add troubleshooting steps
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented flexible priority mapping with project-specific overrides:

- Added support for project-specific priority mappings in .backlog-jira/config.json
- Made status mapping case-insensitive for more robust matching
- Created comprehensive documentation in docs/priority-mapping.md
- Added proper resource cleanup to prevent dangling connections
- Ensured CLI commands exit properly after completion

These changes make the plugin more resilient when syncing with Jira projects that have custom priority schemes, such as when projects don't support standard priorities like "Low". The implementation follows the same pattern used for status mappings with both global defaults and project-specific overrides.
<!-- SECTION:NOTES:END -->
