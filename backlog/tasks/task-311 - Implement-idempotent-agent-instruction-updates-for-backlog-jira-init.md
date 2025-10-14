---
id: task-311
title: Implement idempotent agent instruction updates for backlog-jira init
status: Done
assignee:
  - '@agent-k'
created_date: '2025-10-14 12:41'
updated_date: '2025-10-14 13:16'
labels:
  - enhancement
  - cli
  - init
  - agent-integration
dependencies: []
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Add functionality to backlog-jira init command that updates agent instruction files (AGENTS.md, CLAUDE.md, etc.) with plugin-specific guidelines. Should support both CLI mode (embedded instructions) and MCP mode (nudge to read MCP resources), with idempotent updates using HTML comment markers.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Init command offers choice between CLI instructions mode and MCP nudge mode
- [x] #2 Agent file selection prompt allows choosing which files to update
- [x] #3 Content wrapped with HTML comment markers for BACKLOG-JIRA GUIDELINES
- [x] #4 Updates are idempotent - no duplication on multiple runs
- [x] #5 Support mode switching between CLI and MCP modes
- [x] #6 User content outside markers is preserved
- [x] #7 Create plugin-specific guidelines content for CLI mode
- [x] #8 Create MCP nudge content that references backlog-jira MCP resources

- [x] #9 Implement getMarkers() function returning markers based on file type
- [x] #10 Implement hasBacklogJiraGuidelines() to detect existing guidelines
- [x] #11 Implement wrapWithMarkers() to wrap content with markers
- [x] #12 Implement stripGuidelineSection() to remove old guidelines
- [x] #13 Implement addAgentInstructions() function for CLI mode
- [x] #14 Implement ensureMcpGuidelines() function for MCP mode
- [x] #15 Add git integration with optional autoCommit
- [x] #16 Add comprehensive test coverage for idempotency and mode switching
- [x] #17 Document the update mechanism with detailed analysis
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Research codebase structure and existing init command implementation
2. Design marker system for HTML comments to wrap guidelines
3. Implement core utility functions (getMarkers, hasBacklogJiraGuidelines, wrapWithMarkers, stripGuidelineSection)
4. Create CLI mode content with comprehensive plugin guidelines
5. Create MCP mode content with resource references
6. Implement addAgentInstructions function for CLI mode
7. Implement ensureMcpGuidelines function for MCP mode
8. Extend init command with interactive prompts for mode selection and file selection
9. Add git integration with optional autoCommit
10. Write comprehensive tests for idempotency and mode switching
11. Document the implementation and update README if needed
12. Test end-to-end with real agent instruction files
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
# Implementation Summary

Successfully implemented idempotent agent instruction updates for the `backlog-jira init` command.

## What Was Built

### Core Utility Module (`src/utils/agent-instructions.ts`)

Created a comprehensive utility module with:

1. **Marker System**: HTML comment markers that wrap plugin guidelines
   - `<!-- BACKLOG-JIRA GUIDELINES START -->`
   - `<!-- BACKLOG-JIRA GUIDELINES END -->`
   - Supports different file types (currently all use HTML comments)

2. **Core Functions**:
   - `getMarkers()`: Returns appropriate markers based on file type
   - `hasBacklogJiraGuidelines()`: Detects if guidelines already exist
   - `wrapWithMarkers()`: Wraps content with markers
   - `stripGuidelineSection()`: Removes existing guideline sections
   - `addAgentInstructions()`: Main function for adding/updating guidelines
   - `ensureMcpGuidelines()`: Convenience wrapper for MCP mode
   - `switchInstructionMode()`: Switch between CLI and MCP modes

3. **Content Generators**:
   - `getCliModeContent()`: Comprehensive plugin documentation (~7KB)
   - `getMcpModeContent()`: Short MCP resource reference (~1KB)

### Extended Init Command (`src/commands/init.ts`)

Added interactive agent instructions setup workflow:

1. **Initial Prompt**: Asks if user wants to add plugin guidelines
2. **File Discovery**: Automatically finds common agent instruction files
3. **File Selection**: Multi-select checkbox for choosing which files to update
4. **Mode Selection**: Choose between CLI mode (embedded) or MCP mode (reference)
5. **Update Process**: Applies guidelines idempotently
6. **Git Integration**: Optional commit of changes

### Test Coverage (`src/utils/agent-instructions.test.ts`)

Comprehensive test suite with 28 passing tests covering:
- Marker system
- Content detection
- Idempotency
- Mode switching
- User content preservation
- Error handling
- Complex scenarios (multiple mode switches)

## Key Features

### 1. Idempotency
- Multiple runs do NOT duplicate content
- Guidelines are wrapped with markers for easy identification
- Existing guidelines are stripped before new ones are added
- Tested extensively with multiple consecutive runs

### 2. User Content Preservation
- Content outside markers is preserved
- Proper spacing maintained
- Mode switches don't lose user content

### 3. Two Modes

**CLI Mode**:
- Embeds comprehensive documentation directly
- Includes: commands, configuration, workflows, troubleshooting
- Best for: CLI-only usage, offline work, single source of truth

**MCP Mode**:
- Short nudge to read MCP resources
- Minimal footprint in agent files
- Best for: MCP server usage, dynamic documentation

### 4. Git Integration
- Automatically detects git repositories
- Offers to commit changes after update
- Descriptive commit messages with file list
- Gracefully handles git unavailability

## Files Modified

- `src/commands/init.ts` - Extended with agent instructions setup
- `src/utils/agent-instructions.ts` - New utility module (359 lines)
- `src/utils/agent-instructions.test.ts` - Comprehensive test suite (366 lines)

## Usage

```bash
# Initialize backlog-jira and setup agent instructions
backlog-jira init

# Follow prompts:
# 1. Choose whether to add guidelines
# 2. Select files to update (AGENTS.md, CLAUDE.md, etc.)
# 3. Choose mode (CLI or MCP)
# 4. Optionally commit changes to git
```

## Testing

All 28 tests pass:
```bash
bun test src/utils/agent-instructions.test.ts
# ✓ 28 pass, 0 fail
```

## Design Decisions

1. **HTML Comments for Markers**: Universal compatibility across markdown and text files
2. **Prepend Guidelines**: Plugin docs appear at the top, before user content
3. **Interactive Prompts**: Better UX than CLI flags for initial setup
4. **Optional Git Commit**: Flexibility for users who want manual control
5. **File Discovery**: Searches for common agent file names automatically
6. **Mode Switching**: Allows users to change their mind later

## Future Enhancements

Potential improvements for future iterations:
- Support for additional marker styles (e.g., code comments for .js files)
- CLI flags for non-interactive mode
- Configuration file to remember preferences
- Auto-detect if project uses MCP server
- Support for custom agent file paths
<!-- SECTION:NOTES:END -->
