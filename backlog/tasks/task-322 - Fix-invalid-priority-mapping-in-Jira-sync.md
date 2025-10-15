---
id: task-322
title: Fix invalid priority mapping in Jira sync
status: Done
assignee: []
created_date: '2025-10-15 10:30'
updated_date: '2025-10-15 17:40'
labels:
  - bug
  - jira-sync
dependencies: []
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The backlog-jira plugin is failing to pull/update tasks because it's using 'minor' as a priority value, which is not valid in Backlog.md. Valid priority values are: high, medium, low.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Map Jira priority values to valid Backlog.md priority values (high, medium, low)
- [x] #2 Handle edge cases where Jira priorities don't match standard values
- [x] #3 Update priority mapping logic to convert 'Minor' to 'low', 'Major' to 'medium', 'Critical'/'Blocker' to 'high'
- [x] #4 Test the fix by running a sync operation with task-1
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Create a priority mapping utility function to convert Jira priority values to Backlog.md format
2. Update buildBacklogUpdates() in pull.ts to use the mapping function
3. Update push.ts to map in the opposite direction (Backlog -> Jira)
4. Add test coverage for the priority mapping
5. Test with task-1 to verify the fix works
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
## Summary
Fixed invalid priority mapping issue where Jira priorities like "Minor", "Major", "Critical", etc. were being passed directly to Backlog.md without conversion, causing validation errors.

## Changes Made

### Created Priority Mapping Utility (`src/utils/priority-mapping.ts`)
- Added `mapJiraPriorityToBacklog()` function to convert Jira priority values to Backlog.md format
- Added `mapBacklogPriorityToJira()` function for bidirectional mapping
- Handles standard Jira priorities: Highest, High, Medium, Low, Lowest
- Handles alternate priority names: Critical, Blocker, Major, Minor, Trivial
- Defaults to "medium" for unknown values with warning logs

### Updated Pull Command (`src/commands/pull.ts`)
- Modified `buildBacklogUpdates()` to use `mapJiraPriorityToBacklog()` when syncing priorities from Jira
- Added debug logging for priority mapping operations

### Updated Push Command (`src/commands/push.ts`)
- Modified `buildJiraUpdates()` to use `mapBacklogPriorityToJira()` when syncing priorities to Jira
- Updated issue creation to map priorities
- Added debug logging for priority mapping operations

### Added Test Coverage (`src/utils/priority-mapping.test.ts`)
- 11 test cases covering all mapping scenarios
- Tests case-insensitive input, whitespace handling, undefined values
- Tests default behavior for unknown priorities
- All tests passing

## Testing
- Unit tests: 11/11 passing
- Integration tests: 214/214 passing (no regressions)
- Linting: All new files pass biome checks

## Impact
- Fixes sync failures when pulling/pushing tasks with Jira priorities
- Ensures valid priority values in Backlog.md (high, medium, low only)
- Maintains data integrity during bidirectional sync
<!-- SECTION:NOTES:END -->
