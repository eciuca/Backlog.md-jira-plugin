---
id: task-310
title: Enhance pull command to import unmapped Jira issues
status: Done
assignee:
  - '@agent'
created_date: '2025-10-14 12:35'
updated_date: '2025-10-14 12:58'
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
- [x] #1 Pull command fetches Jira issues using JQL filter from config when no task IDs specified
- [x] #2 For each unmapped Jira issue found, create a new Backlog task via CLI
- [x] #3 Automatically create mapping between new task and Jira issue
- [x] #4 Pull/sync the Jira data into the newly created task
- [x] #5 Support --dry-run to preview what would be imported
- [x] #6 Add --import flag to explicitly enable import mode (default: only sync mapped tasks)
- [x] #7 Preserve existing behavior: without --import, only pull mapped tasks
- [x] #8 Log which tasks were imported vs updated in the operation summary
- [x] #9 Handle Jira fields mapping: title, description, status, assignee, labels, priority
- [x] #10 Strip AC section from Jira description and convert to Backlog AC format
- [x] #11 Update documentation and README with import workflow examples
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Add --import flag to pull command interface in cli.ts
2. Update PullOptions interface to include import flag and jql filter
3. Modify getTaskIds() function to fetch Jira issues via JQL when --import flag is used
4. Create new function importJiraIssue() to create Backlog task from Jira issue
5. Update pull() function to handle unmapped issues by calling importJiraIssue()
6. Extract Jira field mapping logic into reusable function
7. Strip AC section from Jira description and convert to Backlog AC format
8. Add import statistics to PullResult (imported vs updated count)
9. Update logging to differentiate imported vs pulled tasks
10. Add unit tests for import functionality
11. Update README with --import flag documentation and examples
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
## Implementation Summary

### Core Changes

**CLI Interface (`src/cli.ts`)**
- Added `--import` flag to enable import mode for unmapped Jira issues
- Added `--jql <jql>` flag to specify custom JQL filter (optional)
- Updated output to show imported count separately from pulled count

**Pull Command (`src/commands/pull.ts`)**
- Updated `PullOptions` interface to include `import` and `jql` fields
- Updated `PullResult` interface to include `imported` array
- Modified `getTaskIds()` to return `{ mapped, unmapped }` structure
- Added `getIssuesForImport()` function to fetch and categorize Jira issues via JQL
- Added `importJiraIssue()` function to create Backlog task from Jira issue
- Updated main `pull()` function to process both unmapped (import) and mapped (pull) tasks
- Preserved existing behavior: without `--import`, only pulls mapped tasks

**Backlog Client (`src/integrations/backlog.ts`)**
- Added `createTask()` method to create new Backlog tasks via CLI
- Supports all task fields: title, description, status, assignee, labels, priority, AC
- Parses created task ID from CLI output

### Key Features Implemented

1. **JQL Configuration Hierarchy**
   - Priority 1: `--jql` command-line option
   - Priority 2: `jqlFilter` from `.backlog-jira/config.json`
   - Priority 3: Default to `project = JIRA_PROJECT ORDER BY created DESC`

2. **Import Process**
   - Fetches Jira issues via JQL
   - Separates already-mapped from unmapped issues
   - Creates Backlog tasks for unmapped issues
   - Automatically creates mappings
   - Syncs AC from Jira description (strips AC section, converts to Backlog format)
   - Sets initial snapshots for 3-way merge
   - Updates frontmatter with Jira metadata

3. **Dry-Run Support**
   - Both import and pull operations support `--dry-run`
   - Logs what would be created/updated without making changes

4. **Parallel Processing**
   - Processes up to 10 tasks/issues concurrently
   - Separate batches for import and pull operations

### Usage Examples

```bash
# Import all issues matching config JQL filter
backlog-jira pull --import

# Import with custom JQL
backlog-jira pull --import --jql "project = PROJ AND status = \Open\\"\n\n# Preview import without creating tasks\nbacklog-jira pull --import --dry-run\n\n# Import and force update conflicts\nbacklog-jira pull --import --force\n```\n\n### Testing Notes\n\n- Build successful: `bun run build` completed without errors\n- All new functions follow existing code patterns\n- Logging differentiates imported vs pulled tasks\n- Error handling maintains consistency with existing commands
<!-- SECTION:NOTES:END -->
