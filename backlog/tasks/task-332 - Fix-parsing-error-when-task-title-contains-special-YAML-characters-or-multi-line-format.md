---
id: task-332
title: >-
  Fix parsing error when task title contains special YAML characters or
  multi-line format
status: Done
assignee:
  - '@agent-k'
created_date: '2025-10-20 08:28'
updated_date: '2025-10-28 12:12'
labels:
  - bug
  - parser
dependencies: []
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The plugin fails to parse task files when the title in the frontmatter uses YAML multi-line syntax (>-) or contains special characters like brackets. Error: 'Failed to parse task ID from output' during pull operations.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Plugin correctly parses task files with multi-line title YAML syntax (>-)
- [x] #2 Plugin correctly handles task titles with square brackets in YAML frontmatter
- [x] #3 Pull operation succeeds without parse errors for all valid task files
- [x] #4 Add error handling with specific messages when YAML parsing fails
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Research YAML multi-line syntax and proper parsing requirements
2. Install or use a proper YAML parser library (js-yaml)
3. Update parseFrontmatter() to use YAML parser instead of regex
4. Update serializeFrontmatter() to properly quote values with special characters
5. Add comprehensive tests for multi-line titles and special characters
6. Test with existing task files that have problematic frontmatter
7. Ensure backwards compatibility with existing task files
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Enhanced frontmatter parser to handle YAML multi-line syntax and special characters:

- Updated parseFrontmatter() in src/utils/frontmatter.ts:
  - Added support for YAML folded scalar syntax (>-, >) for multi-line values
  - Added support for YAML literal scalar syntax (|-, |) preserving newlines
  - Improved parsing of quoted strings (both single and double quotes)
  - Enhanced key-value detection to handle indented continuation lines
  - Added state machine for tracking multi-line mode

- Created parseYamlValue() helper function:
  - Handles different YAML value types (strings, arrays, multi-line)
  - Properly extracts values from quoted strings
  - Preserves array format [item1, item2, item3]

- Created serializeYamlValue() helper function:
  - Automatically quotes values containing YAML special characters
  - Escapes double quotes in values
  - Detects characters that need quoting: :[]{}#&*!|>'"%@`
  - Handles leading special characters like - and ?

- Added comprehensive test coverage in src/utils/frontmatter.test.ts:
  - 19 tests covering all YAML features
  - Tests for multi-line values (both folded and literal)
  - Tests for special characters (brackets, colons, quotes, pipes, etc.)
  - Tests for complex real-world scenarios
  - Tests for edge cases (empty values, whitespace, consecutive blocks)
  - All tests pass

The parser now correctly handles task files with:
- Multi-line titles using YAML >- syntax
- Titles with square brackets [PROJ-123]
- Titles with colons, quotes, and other YAML special characters
- Properly quoted and escaped values

Backwards compatible with existing simple key:value format.
<!-- SECTION:NOTES:END -->
