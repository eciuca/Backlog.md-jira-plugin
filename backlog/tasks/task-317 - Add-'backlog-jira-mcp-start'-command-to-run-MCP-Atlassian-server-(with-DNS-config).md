---
id: task-317
title: >-
  Add 'backlog-jira mcp start' command to run MCP Atlassian server (with DNS
  config)
status: Done
assignee:
  - '@agent'
created_date: '2025-10-14 16:01'
updated_date: '2025-10-14 16:11'
labels:
  - mcp
  - cli
  - enhancement
dependencies: []
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Goal: Provide a built-in command to start an MCP Atlassian server using the plugin's configuration, similar to Backlog.md's `backlog mcp start`.

Context:
- Backlog.md exposes `backlog mcp start` (stdio transport) for local MCP integration.
- This plugin currently spawns Docker per MCP call; we now support external servers.
- We want a first-class CLI command to launch a long-running MCP Atlassian server using the plugin configuration, to simplify setup and improve performance.

Scope:
- Add a new command group to the plugin CLI: `backlog-jira mcp start` (and optional helpers later).
- The command should read Jira connection settings from environment variables (JIRA_URL, JIRA_USERNAME/JIRA_EMAIL + JIRA_API_TOKEN, or JIRA_PERSONAL_TOKEN), and may leverage `.backlog-jira/config.json` `mcp` section for defaults (serverCommand, serverArgs, fallbackToDocker, etc.).
- Besides the current configuration options, add an option to configure DNS for the MCP server process (e.g., `dnsServers` and `dnsSearchDomains`) for enterprise environments.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Create a new CLI command group 'mcp' with 'backlog-jira mcp start' to run the Atlassian MCP server over stdio.
- [x] #2 Read credentials from env (JIRA_URL + Cloud API token or Server PAT); fail fast with clear messages when missing.
- [x] #3 Use .backlog-jira/config.json mcp section to allow: serverCommand, serverArgs, fallbackToDocker, useExternalServer.
- [x] #4 Add new DNS configuration options: config keys mcp.dnsServers (array of IPs) and mcp.dnsSearchDomains (array of domains); and CLI flags --dns-servers and --dns-search-domain(s).
- [x] #5 When DNS options are provided, ensure the spawned process receives the correct resolver/search configuration (document the mechanism and limitations).
- [x] #6 Provide --debug flag to print startup info; print a one-line "MCP Atlassian server started (stdio)" confirmation on success.
- [x] #7 Add unit tests for argument building (including DNS), env validation, and failure paths; no network tests required.
- [x] #8 Update README and docs/external-mcp-server.md with usage examples and the new DNS options.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Research current MCP implementation in Backlog.md and existing code structure
2. Create new CLI command group structure for `mcp` commands
3. Implement environment variable validation and configuration reading
4. Add DNS configuration support in config and CLI flags
5. Implement server spawning with DNS configuration
6. Add debug logging and user feedback
7. Write comprehensive unit tests
8. Update documentation with examples and new features
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Successfully implemented the `backlog-jira mcp start` command with all required features:

## Implementation Summary

**New CLI Command**: `backlog-jira mcp start`
- Integrated into existing CLI structure using Commander.js
- Added new MCP command group with start subcommand
- Full argument validation and error handling

**Credential Validation**: 
- Supports both Jira Cloud (API Token) and Server/DC (PAT) authentication
- Clear error messages for missing credentials
- Environment variable validation with fast-fail behavior

**Configuration Support**:
- Reads from `.backlog-jira/config.json` mcp section
- Supports all requested options: serverCommand, serverArgs, fallbackToDocker, useExternalServer
- Graceful handling of missing config files with sensible defaults

**DNS Configuration**:
- Added CLI flags: `--dns-servers` and `--dns-search-domains`
- Config file support: `mcp.dnsServers` and `mcp.dnsSearchDomains`
- Environment variable approach with documented limitations
- Docker DNS integration using `--dns` and `--dns-search` flags

**Server Management**:
- External server startup with stdio transport
- Docker fallback with configurable behavior
- Process lifecycle management (SIGINT/SIGTERM handling)
- Debug logging with `--debug` flag

**Testing**:
- Comprehensive unit tests covering all core functionality
- Environment validation, configuration loading, DNS merging
- Server argument building and fallback logic
- All tests passing

**Documentation**:
- Updated `docs/external-mcp-server.md` with new command
- Added DNS configuration examples and troubleshooting
- Updated README.md with feature announcement
- Clear usage examples and configuration options

## Technical Implementation

**Files Modified**:
- `src/commands/mcp.ts` (new) - Main implementation
- `src/commands/mcp.test.ts` (new) - Unit tests
- `src/cli.ts` - Added MCP command registration
- `docs/external-mcp-server.md` - Documentation updates
- `README.md` - Feature announcement

**Key Design Decisions**:
- Environment variables for DNS (portable approach)
- Docker DNS flags for containerized fallback
- Graceful error handling with clear messages
- Configuration merging (CLI flags override config)
- Debug mode for troubleshooting

The implementation provides a production-ready solution for starting MCP Atlassian servers with enterprise DNS support, following all acceptance criteria and maintaining high code quality standards.
<!-- SECTION:NOTES:END -->
