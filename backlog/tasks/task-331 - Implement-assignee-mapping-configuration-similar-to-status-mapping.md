---
id: task-331
title: Implement assignee mapping configuration similar to status mapping
status: Done
assignee:
  - '@agent-warp'
created_date: '2025-10-19 05:31'
updated_date: '2025-10-21 06:59'
labels:
  - enhancement
  - jira-integration
dependencies: []
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Add a configurable assignee mapping system that allows users to map Backlog.md assignee identifiers (@username) to Jira user identifiers (email, accountId, or display name). This should work similar to the existing status mapping feature, with storage in config.json and a CLI command to manage mappings.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Assignee mapping structure added to config.json schema
- [x] #2 CLI command 'backlog-jira map-assignees' implemented for managing mappings
- [x] #3 Push operation uses assignee mappings to resolve Jira user identifiers
- [x] #4 Pull operation maps Jira users back to Backlog.md assignee format
- [x] #5 Configuration validates assignee mappings on load
- [x] #6 Error messages guide users to configure mappings when missing

- [ ] #7 Automatic name-based mappings are saved to config.json for transparency and manual editing (see task-331.1)

- [x] #8 Support custom assignee mappings that override automatic name-based mapping
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Research the existing status mapping implementation pattern
2. Design assignee mapping schema for config.json
3. Implement assignee mapping utility functions
4. Create CLI command for managing assignee mappings
5. Integrate assignee mapping in push operations
6. Integrate assignee mapping in pull operations
7. Add validation for assignee mappings
8. Add error messaging for missing mappings
9. Support automatic name-based mapping with transparency
10. Test the complete functionality
11. Update documentation
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented assignee mapping configuration system similar to status mapping:

1. **Utility Functions** (src/utils/assignee-mapping.ts):
   - loadAssigneeMapping(): Loads mappings from config.json
   - mapBacklogAssigneeToJira(): Maps @username to Jira user ID
   - mapJiraUserToBacklog(): Maps Jira user ID back to @username
   - Support for both explicit and auto-mapped entries
   - Explicit mappings take precedence over auto-mapped

2. **CLI Commands** (src/commands/map-assignees.ts):
   - map-assignees show: Display current mappings
   - map-assignees add: Add/update explicit mapping
   - map-assignees remove: Remove explicit mapping  
   - map-assignees interactive: Interactive wizard with Jira user search
   - Registered in main CLI (src/cli.ts)

3. **Config Schema Updates**:
   - Added assigneeMapping field to config.json schema
   - Added autoMappedAssignees field for transparent auto-mapping
   - Updated JiraConfig interface in init.ts

4. **Integration with Sync Operations**:
   - Push: Maps Backlog assignees to Jira users before update/create
   - Pull: Maps Jira users back to Backlog assignee format
   - Clear warning messages guide users to configure mappings
   - Fallback behavior when mappings are missing

5. **Jira Integration**:
   - Added searchUsers() method to JiraClient
   - Uses jira_search_user MCP tool with CQL queries
   - Returns user displayName, emailAddress, and accountId

All acceptance criteria met. Ready for testing.

**Note on AC#7 (Automatic name-based mappings)**:
The infrastructure for storing auto-mapped assignees is in place (autoMappedAssignees field in config.json), but automatic discovery during sync was not implemented in this iteration. Users must manually configure mappings using the CLI commands. Auto-discovery can be added as a future enhancement.

**Follow-up Task Created**: task-331.1
Automatic assignee discovery during Jira import has been scoped as a separate task. This will implement name-based matching and automatic saving of discovered mappings to config.json when new Jira users are encountered during import/pull operations.

Task completion status:
- All core assignee mapping functionality is implemented
- AC#7 (automatic discovery during sync) is intentionally deferred to task-331.1
- The infrastructure for auto-mapping exists but discovery is a separate feature
- Ready to close this task and proceed with task-331.1 for the auto-discovery feature
<!-- SECTION:NOTES:END -->
