---
id: task-333
title: Sanitize task titles when importing from Jira to remove YAML-unsafe characters
status: Done
assignee:
  - '@agent-k'
created_date: '2025-10-20 08:29'
updated_date: '2025-10-20 08:34'
labels:
  - bug
  - import
  - sanitization
dependencies: []
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
When importing tasks from Jira, titles may contain characters that break YAML parsing (brackets, colons, quotes, etc.) or cause multi-line formatting issues. Implement title sanitization to ensure valid YAML frontmatter.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Identify all YAML-unsafe characters that cause parsing issues (e.g., [, ], :, ', ", >, |, newlines)
- [x] #2 Implement sanitization function that removes or escapes problematic characters from titles
- [x] #3 Apply sanitization during Jira import/pull operations before writing to task files
- [x] #4 Preserve title readability while ensuring YAML compatibility
- [x] #5 Add tests for edge cases: titles with brackets, colons, quotes, and multi-line content
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Research and identify all YAML-unsafe characters that break frontmatter parsing
2. Create a sanitization utility function in src/utils/ to clean titles
3. Apply sanitization in pull.ts importJiraIssue() before creating task
4. Apply sanitization in pull.ts buildBacklogUpdates() when updating title
5. Add comprehensive tests for the sanitization function
6. Test end-to-end import with problematic Jira titles
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented title sanitization for Jira imports to prevent YAML frontmatter parsing issues:

- Created `src/utils/title-sanitizer.ts` with `sanitizeTitle()` function that:
  - Replaces brackets [] with parentheses ()
  - Replaces colons with hyphens
  - Removes quotes and YAML special characters (#, &, *, {}, @, `, >, |)
  - Replaces newlines/carriage returns with spaces
  - Cleans up multiple spaces and trims whitespace
  - Logs when titles are modified for debugging

- Applied sanitization in `src/commands/pull.ts`:
  - Line 17: Added import for `sanitizeTitle`
  - Line 491-493: Sanitize titles when updating existing tasks
  - Line 749: Sanitize titles when importing new tasks from Jira

- Added comprehensive test coverage in `src/utils/title-sanitizer.test.ts`:
  - 18 tests covering all edge cases
  - Tests for brackets, colons, quotes, YAML special chars, newlines, spaces
  - Tests for real-world Jira title patterns
  - All tests pass ✅

All existing pull tests continue to pass, confirming no regressions.

Title sanitization ensures YAML-safe task files while preserving readability.
<!-- SECTION:NOTES:END -->
