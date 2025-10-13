# Backlog.md Jira Plugin

**Bidirectional sync plugin between Backlog.md and Jira via MCP Atlassian server**

[![Status](https://img.shields.io/badge/status-Phase%204%20Complete-success)](https://github.com/MrLesk/Backlog.md/pull/394)

## Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Features](#features)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Configuration](#configuration)
- [Usage](#usage)
- [Commands](#commands)
- [Troubleshooting](#troubleshooting)
- [Development](#development)
- [License](#license)

## Overview

The Backlog.md Jira plugin enables seamless bidirectional synchronization between [Backlog.md](https://github.com/MrLesk/Backlog.md) tasks and Jira issues. Built as a standalone plugin following the zero-coupling architecture introduced in [PR #394](https://github.com/MrLesk/Backlog.md/pull/394), it operates entirely through public APIs without requiring any modifications to Backlog.md core.

### What Does It Do?

- **🔄 Bidirectional Sync**: Keep Backlog tasks and Jira issues in sync automatically
- **✅ Acceptance Criteria**: Sync acceptance criteria with full checked/unchecked state
- **📊 Status Mapping**: Flexible status mapping with project-specific overrides
- **🔍 Conflict Detection**: Field-level conflict detection with multiple resolution strategies
- **📝 Field Mapping**: Sync titles, descriptions, assignees, labels, and custom fields
- **🔐 Secure**: Uses MCP (Model Context Protocol) for secure Jira access
- **📦 Standalone**: Zero modifications to Backlog.md core - fully independent plugin

## Architecture

### Design Principles

The plugin follows a **zero-coupling architecture** that ensures complete separation from Backlog.md core:

1. **Public APIs Only**: 
   - Uses Backlog CLI for all Backlog operations
   - Uses MCP Atlassian server for all Jira operations
   - No direct file manipulation or internal API calls

2. **External State Management**:
   - SQLite database (`.backlog-jira/jira-sync.db`) stores all plugin state
   - Mapping data, sync history, and snapshots stored separately
   - No modifications to Backlog.md data structures

3. **3-Way Merge**:
   - Stores base snapshots for both Backlog and Jira sides
   - Enables intelligent conflict detection by comparing current state to last known state
   - Supports multiple conflict resolution strategies

4. **Standalone CLI**:
   - Separate `backlog-jira` command namespace
   - Independent npm package installation
   - Can be installed, updated, or removed without affecting Backlog.md

### How It Works

```
┌──────────────┐         ┌─────────────────┐         ┌──────────┐
│  Backlog.md  │◄────────┤  backlog-jira   ├────────►│   Jira   │
│    Tasks     │  CLI    │     Plugin      │   MCP   │  Issues  │
└──────────────┘         └─────────────────┘         └──────────┘
                                 │
                                 ▼
                         ┌───────────────┐
                         │ SQLite Store  │
                         │  - Mappings   │
                         │  - Snapshots  │
                         │  - Sync State │
                         └───────────────┘
```

**Key Components**:

- **Integration Layer**: Wrappers for Backlog CLI and MCP Atlassian client
- **State Store**: SQLite database with tables for mappings, snapshots, sync state, and operations log
- **Sync Engine**: Handles push, pull, and bidirectional sync with conflict resolution
- **Configuration System**: JSON-based configuration with project-specific overrides
- **Logger**: Pino-based logging with secret redaction and structured output

### Database Schema

The plugin maintains state in `.backlog-jira/jira-sync.db`:

- **`mappings`**: Links Backlog task IDs to Jira issue keys
- **`snapshots`**: Stores payload snapshots for 3-way merge (separate for Backlog and Jira)
- **`sync_state`**: Tracks last sync timestamps and status per task
- **`ops_log`**: Audit log of all sync operations

## Features

### ✅ Core Capabilities (Phase 4 Complete)

- ✅ **Task-Issue Mapping**: Create and manage mappings between Backlog tasks and Jira issues
- ✅ **Push (Backlog → Jira)**: Push changes from Backlog to Jira
- ✅ **Pull (Jira → Backlog)**: Pull changes from Jira to Backlog
- ✅ **Bidirectional Sync**: Intelligent 3-way merge with conflict detection
- ✅ **Acceptance Criteria Sync**: Full support for AC with checked/unchecked state
- ✅ **Status Mapping**: Flexible status mapping with project overrides
- ✅ **Field-Level Conflicts**: Detect conflicts at field level (title, description, status, etc.)
- ✅ **Multiple Conflict Strategies**: prefer-backlog, prefer-jira, prompt, manual
- ✅ **Dry Run Mode**: Preview changes without applying them
- ✅ **Batch Operations**: Sync multiple tasks at once with `--all` flag

### 🚧 Future Enhancements (Phase 5)

- [ ] **Watch Mode**: Automatic background sync on file changes
- [ ] **Advanced Conflict Resolution**: Interactive UI for complex conflicts
- [ ] **Custom Field Mapping**: User-defined field mapping rules
- [ ] **Webhooks**: Real-time sync triggered by Jira webhooks

## Prerequisites

Before installing the plugin, ensure you have:

1. **Backlog.md CLI** installed and configured
   - Install from: https://github.com/MrLesk/Backlog.md
   - Verify: `backlog --version`

2. **MCP Atlassian Server** configured
   - Install the MCP Atlassian server for Jira access
   - Configure with your Jira credentials (see Configuration section)

3. **Bun Runtime** (recommended) or Node.js 20+
   - Bun: `curl -fsSL https://bun.sh/install | bash`
   - Or Node.js: https://nodejs.org/

4. **Active Backlog.md Project**
   - Navigate to a directory with `backlog/` folder
   - Or initialize one: `backlog init`

## Installation

### From npm (Future)

```bash
npm install -g backlog-jira
```

### From Source (Current)

```bash
# Clone the repository
git clone https://github.com/YOUR-USERNAME/Backlog.md-jira-plugin.git
cd Backlog.md-jira-plugin

# Install dependencies
npm install

# Build the CLI
npm run build

# Link globally (optional)
npm link

# Or run directly
./dist/cli.js --help
```

### Verify Installation

```bash
backlog-jira --version
backlog-jira doctor
```

## Configuration

### 1. Initialize Plugin

In your Backlog.md project directory:

```bash
backlog-jira init
```

This creates `.backlog-jira/` directory with:
- `config.json` - Configuration file
- `jira-sync.db` - SQLite database
- `logs/` - Log directory

### 2. Configure MCP Atlassian Server

The plugin requires MCP Atlassian server for Jira access. Configure it with environment variables or in your MCP settings:

**Environment Variables** (`.env` or shell):

```bash
# Jira Configuration
JIRA_BASE_URL=https://your-domain.atlassian.net
JIRA_USER_EMAIL=your-email@example.com
JIRA_API_TOKEN=your-jira-api-token

# Optional: MCP Server Path (if not in PATH)
MCP_ATLASSIAN_PATH=/path/to/mcp-atlassian
```

**Getting Jira API Token**:
1. Go to https://id.atlassian.com/manage-profile/security/api-tokens
2. Click "Create API token"
3. Copy the token and save it securely

### 3. Edit Configuration File

Edit `.backlog-jira/config.json`:

```json
{
  "jira": {
    "baseUrl": "https://your-domain.atlassian.net",
    "projectKey": "PROJ",
    "issueType": "Task",
    "jqlFilter": ""
  },
  "backlog": {
    "statusMapping": {
      "To Do": ["To Do", "Open", "Backlog"],
      "In Progress": ["In Progress", "In Development"],
      "Done": ["Done", "Closed", "Resolved"]
    }
  },
  "sync": {
    "conflictStrategy": "prompt",
    "enableAnnotations": false,
    "watchInterval": 60
  }
}
```

### Configuration Options

#### Jira Section

| Option | Description | Example |
|--------|-------------|---------|  
| `baseUrl` | Your Jira instance URL | `https://company.atlassian.net` |
| `projectKey` | Default Jira project key | `PROJ`, `DEV`, `SUPPORT` |
| `issueType` | Default issue type for new issues | `Task`, `Story`, `Bug` |
| `jqlFilter` | Optional JQL filter for queries | `labels = backend` |

#### Backlog Section

| Option | Description | Details |
|--------|-------------|---------|  
| `statusMapping` | Maps Backlog statuses to Jira | See [Status Mapping Guide](docs/status-mapping.md) |
| `projectOverrides` | Project-specific status mappings | Override per Jira project |

#### Sync Section

| Option | Description | Values |
|--------|-------------|--------|
| `conflictStrategy` | Default conflict resolution | `prompt`, `prefer-backlog`, `prefer-jira`, `manual` |
| `enableAnnotations` | Add sync metadata to tasks | `true`, `false` |
| `watchInterval` | Watch mode check interval (seconds) | `60`, `300` |

### 4. Verify Configuration

```bash
backlog-jira doctor
backlog-jira connect
```

The `doctor` command checks:
- ✅ Bun runtime version
- ✅ Backlog CLI availability
- ✅ Configuration file validity
- ✅ Database permissions
- ✅ Backlog.md project detection
- ✅ Git repository status

The `connect` command verifies:
- ✅ Backlog CLI connectivity
- ✅ MCP Atlassian server connectivity
- ✅ Jira API credentials

## Usage

### Quick Start

1. **Create a mapping** between Backlog task and Jira issue:
   ```bash
   backlog-jira map
   ```
   Follow the interactive prompts to map tasks to issues.

2. **Push changes** from Backlog to Jira:
   ```bash
   backlog-jira push task-123
   ```

3. **Pull changes** from Jira to Backlog:
   ```bash
   backlog-jira pull task-123
   ```

4. **Bidirectional sync** with conflict resolution:
   ```bash
   backlog-jira sync task-123
   ```

### Common Workflows

#### Workflow 1: Creating New Jira Issues from Backlog

```bash
# List unmapped Backlog tasks
backlog task list --plain

# Map a task to create a new Jira issue
backlog-jira map
# Select task → Choose "Create new Jira issue"

# Push the task to create the issue
backlog-jira push task-123
```

#### Workflow 2: Syncing Existing Tasks

```bash
# Map existing task to existing Jira issue
backlog-jira map
# Select task → Choose "Link to existing issue" → Enter issue key

# Sync bidirectionally
backlog-jira sync task-123
```

#### Workflow 3: Bulk Operations

```bash
# Sync all mapped tasks
backlog-jira sync --all

# Push all changes with dry-run first
backlog-jira push --all --dry-run
backlog-jira push --all

# Pull all updates from Jira
backlog-jira pull --all
```

#### Workflow 4: Handling Conflicts

```bash
# Sync with automatic conflict resolution
backlog-jira sync task-123 --strategy prefer-backlog

# Sync with interactive prompts
backlog-jira sync task-123 --strategy prompt

# Preview conflicts without resolving
backlog-jira sync task-123 --dry-run
```

## Commands

### `backlog-jira init`

Initialize plugin configuration and database.

```bash
backlog-jira init
```

Creates:
- `.backlog-jira/config.json`
- `.backlog-jira/jira-sync.db`
- `.backlog-jira/logs/`

### `backlog-jira doctor`

Run health checks on your environment.

```bash
backlog-jira doctor
```

Checks:
- Runtime (Bun/Node.js)
- Backlog CLI installation
- Configuration validity
- Database connectivity
- Project structure
- Git status

### `backlog-jira connect`

Verify connectivity to Backlog and Jira.

```bash
backlog-jira connect
```

Tests:
- Backlog CLI execution
- MCP Atlassian server connection
- Jira API authentication
- Project access permissions

### `backlog-jira map`

Create and manage task-to-issue mappings.

```bash
# Interactive mapping
backlog-jira map

# View current mappings
backlog-jira map --list

# Remove a mapping
backlog-jira map --remove task-123
```

### `backlog-jira status`

View sync status and recent operations.

```bash
# Overall status
backlog-jira status

# Status for specific task
backlog-jira status task-123

# Show last N operations
backlog-jira status --history 20
```

### `backlog-jira push [taskIds...]`

Push changes from Backlog to Jira.

```bash
# Push single task
backlog-jira push task-123

# Push multiple tasks
backlog-jira push task-123 task-124 task-125

# Push all mapped tasks
backlog-jira push --all

# Dry run (preview changes)
backlog-jira push task-123 --dry-run

# Force push (ignore conflicts)
backlog-jira push task-123 --force
```

**What gets pushed:**
- Title → Summary
- Description → Description
- Status → Status (with transitions)
- Assignee → Assignee
- Labels → Labels
- Acceptance Criteria → Embedded in description

### `backlog-jira pull [taskIds...]`

Pull changes from Jira to Backlog.

```bash
# Pull single task
backlog-jira pull task-123

# Pull multiple tasks
backlog-jira pull task-123 task-124

# Pull all mapped tasks
backlog-jira pull --all

# Dry run (preview changes)
backlog-jira pull task-123 --dry-run

# Force pull (ignore conflicts)
backlog-jira pull task-123 --force
```

**What gets pulled:**
- Summary → Title
- Description → Description (AC extracted)
- Status → Status
- Assignee → Assignee
- Labels → Labels
- Acceptance Criteria → Parsed from description

### `backlog-jira sync [taskIds...]`

Bidirectional sync with conflict resolution.

```bash
# Sync single task
backlog-jira sync task-123

# Sync with strategy
backlog-jira sync task-123 --strategy prefer-backlog
backlog-jira sync task-123 --strategy prefer-jira
backlog-jira sync task-123 --strategy prompt
backlog-jira sync task-123 --strategy manual

# Sync all tasks
backlog-jira sync --all

# Dry run
backlog-jira sync task-123 --dry-run
```

**Conflict Strategies:**
- `prefer-backlog`: Use Backlog value when conflict detected
- `prefer-jira`: Use Jira value when conflict detected
- `prompt`: Ask user for each conflict (interactive)
- `manual`: Skip conflicts, log them for manual resolution

### `backlog-jira view`

View task/issue details and sync status.

```bash
# View task details
backlog-jira view task-123

# View with Jira issue details
backlog-jira view task-123 --with-jira

# View sync history
backlog-jira view task-123 --history
```

### `backlog-jira watch` (Future)

Watch for changes and auto-sync.

```bash
# Start watch mode
backlog-jira watch

# Watch with specific interval
backlog-jira watch --interval 300

# Watch specific tasks
backlog-jira watch task-123 task-124
```

## Troubleshooting

### Common Issues

#### Issue: "Backlog CLI not found"

**Solution:**
```bash
# Verify Backlog CLI is installed
which backlog
backlog --version

# If not found, install from:
# https://github.com/MrLesk/Backlog.md
```

#### Issue: "MCP Atlassian server connection failed"

**Solution:**
```bash
# Check MCP server is configured
echo $JIRA_BASE_URL
echo $JIRA_USER_EMAIL

# Verify API token is set
echo $JIRA_API_TOKEN

# Test connection manually
backlog-jira connect
```

#### Issue: "No transition found for status"

**Problem:** Jira workflow doesn't allow the status transition.

**Solution:**
1. Check available transitions in Jira UI
2. Update status mapping in `.backlog-jira/config.json`
3. See [Status Mapping Guide](docs/status-mapping.md)

```bash
# Enable debug logging to see available transitions
LOG_LEVEL=debug backlog-jira push task-123
```

#### Issue: "Acceptance criteria not syncing"

**Solution:**
1. Verify AC format in Backlog: `- [ ] #1 Criterion text`
2. Check Jira description format: `Acceptance Criteria:` section
3. See [AC Sync Guide](docs/acceptance-criteria-sync.md)

```bash
# View task with AC
backlog task task-123 --plain

# Check sync logs
cat .backlog-jira/logs/sync.log | grep "AC"
```

#### Issue: "Conflicts during sync"

**Solution:**
1. Run with `--dry-run` to preview conflicts
2. Choose appropriate strategy:
   ```bash
   # Use Backlog as source of truth
   backlog-jira sync task-123 --strategy prefer-backlog
   
   # Use Jira as source of truth
   backlog-jira sync task-123 --strategy prefer-jira
   
   # Resolve interactively
   backlog-jira sync task-123 --strategy prompt
   ```

#### Issue: "Permission denied on database"

**Solution:**
```bash
# Fix database permissions
chmod 644 .backlog-jira/jira-sync.db
chmod 755 .backlog-jira

# Rebuild if corrupted
rm .backlog-jira/jira-sync.db
backlog-jira init
```

### Debug Logging

Enable detailed logging for troubleshooting:

```bash
# Set log level
export LOG_LEVEL=debug

# Run command
backlog-jira sync task-123

# View logs
tail -f .backlog-jira/logs/backlog-jira.log
```

### Getting Help

1. **Check documentation**:
   - [Status Mapping Guide](docs/status-mapping.md)
   - [Acceptance Criteria Sync](docs/acceptance-criteria-sync.md)

2. **Run diagnostics**:
   ```bash
   backlog-jira doctor
   backlog-jira connect
   backlog-jira status
   ```

3. **Enable debug logging**:
   ```bash
   LOG_LEVEL=debug backlog-jira [command]
   ```

4. **Check operation logs**:
   ```bash
   backlog-jira status --history 50
   ```

## Development

### Setup Development Environment

```bash
# Clone repository
git clone https://github.com/YOUR-USERNAME/Backlog.md-jira-plugin.git
cd Backlog.md-jira-plugin

# Install dependencies
npm install

# Type check
npm run check:types

# Lint
npm run check

# Build
npm run build

# Run in development mode
bun run src/cli.ts --help
```

### Project Structure

```
backlog-jira/
├── src/
│   ├── cli.ts                    # CLI entry point
│   ├── commands/                 # Command implementations
│   │   ├── init.ts
│   │   ├── doctor.ts
│   │   ├── connect.ts
│   │   ├── map.ts
│   │   ├── status.ts
│   │   ├── push.ts
│   │   ├── pull.ts
│   │   ├── sync.ts
│   │   ├── view.ts
│   │   └── watch.ts
│   ├── integrations/             # Backlog & Jira integrations
│   │   ├── backlog.ts
│   │   └── jira.ts
│   ├── state/                    # State management
│   │   └── store.ts
│   ├── ui/                       # User interface components
│   │   ├── conflict-resolver.ts
│   │   └── display-adapter.ts
│   └── utils/                    # Utilities
│       ├── logger.ts
│       ├── status-mapping.ts
│       ├── sync-state.ts
│       ├── frontmatter.ts
│       └── normalizer.ts
├── docs/                         # Documentation
├── backlog/                      # Backlog.md tasks
├── .backlog-jira/               # Plugin state (gitignored)
│   ├── config.json
│   ├── jira-sync.db
│   └── logs/
├── package.json
├── tsconfig.json
└── README.md
```

### Testing

```bash
# Run all tests
bun test

# Run specific test
bun test src/commands/sync.test.ts

# Watch mode
bun test --watch
```

### Contributing

This plugin follows Backlog.md's plugin architecture. When contributing:

1. **Follow zero-coupling principle**: Only use public APIs
2. **No core modifications**: Plugin must work standalone
3. **External state**: Store all state in `.backlog-jira/`
4. **Test thoroughly**: Add tests for new features
5. **Document changes**: Update README and relevant docs

## Benefits

### Why Use This Plugin?

✅ **Zero Coupling**: No modifications to Backlog.md core - can be installed/removed freely  
✅ **Bidirectional**: Changes flow both ways automatically  
✅ **Intelligent**: 3-way merge detects conflicts accurately  
✅ **Flexible**: Project-specific status mappings and custom configurations  
✅ **Secure**: Uses MCP protocol for safe Jira access  
✅ **Transparent**: Dry-run mode and detailed logging  
✅ **Standalone**: Independent lifecycle from Backlog.md updates  

### Use Cases

- **Development Teams**: Keep Backlog.md tasks synced with Jira for project management
- **Multi-Tool Workflows**: Use Backlog.md for planning, Jira for tracking
- **Remote Teams**: Ensure everyone has latest updates across both systems
- **Compliance**: Maintain audit trail with operations log
- **Custom Workflows**: Support complex Jira workflows with flexible mapping

## References

- **PR #394**: [Backlog.md Plugin System](https://github.com/MrLesk/Backlog.md/pull/394)
- **Backlog.md**: [Main Repository](https://github.com/MrLesk/Backlog.md)
- **MCP Atlassian**: [Model Context Protocol for Atlassian](https://modelcontextprotocol.io)
- **Status Mapping Guide**: [docs/status-mapping.md](docs/status-mapping.md)
- **AC Sync Guide**: [docs/acceptance-criteria-sync.md](docs/acceptance-criteria-sync.md)

## License

MIT License (inherits from Backlog.md)

Copyright (c) 2025 Backlog.md Contributors

---

**Status: Phase 4 Complete ✓** - Push, pull, and bidirectional sync with conflict resolution

For questions or issues, please check the [Troubleshooting](#troubleshooting) section or open an issue on GitHub.
