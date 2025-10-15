# External MCP Server Integration

## Overview

The Backlog.md Jira plugin now supports connecting to an external MCP Atlassian server instead of spawning Docker containers for each operation. This provides significant performance improvements and reduced resource usage.

## Performance Benefits

Based on benchmarking, the external MCP server approach provides:

- **16.7x faster connections** (150ms vs 2.5s)
- **145MB less memory usage** per operation
- **Lower CPU overhead** (no Docker daemon overhead)
- **117 seconds saved per day** for typical usage (50 operations)

## Configuration

### Built-in MCP Server Command (New!)

The plugin now includes a built-in command to start an MCP Atlassian server using your existing configuration:

```bash
# Start MCP server with default configuration
backlog-jira mcp start

# Start with debug output
backlog-jira mcp start --debug

# Start with custom DNS configuration (for enterprise environments)
backlog-jira mcp start --dns-servers 8.8.8.8 1.1.1.1 --dns-search-domains company.com internal.local
```

This command:
- Uses your existing Jira credentials from environment variables
- Reads MCP configuration from `.backlog-jira/config.json`
- Supports DNS configuration for enterprise environments
- Falls back to Docker if external server fails (configurable)
- Provides stdio transport suitable for tools like Claude Desktop or Cursor

### Option 1: External MCP Server (Manual Setup)

Set up a long-running MCP Atlassian server process and configure the plugin to connect to it.

#### 1. Update Configuration File

Edit `.backlog-jira/config.json` to add MCP server configuration:

```json
{
  "jira": {
    "baseUrl": "https://your-domain.atlassian.net",
    "projectKey": "PROJ",
    "issueType": "Task"
  },
  "mcp": {
    "useExternalServer": true,
    "serverCommand": "mcp-atlassian",
    "serverArgs": [],
    "fallbackToDocker": true,
    "dnsServers": ["8.8.8.8", "1.1.1.1"],
    "dnsSearchDomains": ["company.com"]
  },
  "sync": {
    "conflictStrategy": "prompt"
  }
}
```

#### 2. MCP Server Configuration Options

| Option | Description | Default |
|--------|-------------|---------|
| `useExternalServer` | Enable external server connection | `false` |
| `serverCommand` | Command to connect to MCP server | `"mcp-atlassian"` |
| `serverArgs` | Additional arguments for server command | `[]` |
| `fallbackToDocker` | Fall back to Docker if external server fails | `true` |
| `dnsServers` | Array of DNS server IPs for MCP server process | `[]` |
| `dnsSearchDomains` | Array of DNS search domains for MCP server process | `[]` |

#### 3. Environment Variables

The same environment variables are used for authentication:

```bash
# Required
export JIRA_URL="https://your-domain.atlassian.net"

# For Jira Cloud (API Token)
export JIRA_USERNAME="your-email@example.com"  # or JIRA_EMAIL
export JIRA_API_TOKEN="your-api-token"

# OR for Jira Server/Data Center (Personal Access Token)
export JIRA_PERSONAL_TOKEN="your-personal-token"
```

### Option 2: Programmatic Configuration

You can also configure the JiraClient directly in code:

```typescript
import { JiraClient } from './integrations/jira.js';

const client = new JiraClient({
  useExternalServer: true,
  serverCommand: 'mcp-atlassian-server',
  serverArgs: ['--debug'],
  fallbackToDocker: false
});
```

## Setup Instructions

### Prerequisites

1. **Install MCP Atlassian Server**
   ```bash
   npm install -g @modelcontextprotocol/mcp-atlassian
   # OR download standalone binary
   ```

2. **Verify Server Installation**
   ```bash
   which mcp-atlassian
   # Should return path to the server binary
   ```

3. **Test Server Connection**
   ```bash
   # Set environment variables first
   export JIRA_URL="https://your-domain.atlassian.net"
   export JIRA_USERNAME="your-email@example.com"
   export JIRA_API_TOKEN="your-api-token"
   
   # Test the server manually
   echo '{"method":"jira_get_all_projects","params":{}}' | mcp-atlassian
   ```

### Quick Start with Built-in Command

1. **Initialize Plugin** (if not already done)
   ```bash
   backlog-jira init
   ```

2. **Set Environment Variables**
   ```bash
   export JIRA_URL="https://your-domain.atlassian.net"
   export JIRA_EMAIL="your-email@example.com"
   export JIRA_API_TOKEN="your-api-token"
   ```

3. **Start MCP Server**
   ```bash
   # Start the server (runs until stopped with Ctrl+C)
   backlog-jira mcp start --debug
   ```

4. **Configure Client Tools**
   
   Point your MCP clients (Claude Desktop, Cursor, etc.) to use stdio transport with the command:
   ```
   backlog-jira mcp start
   ```

### Manual Plugin Configuration

2. **Update Configuration**
   ```bash
   # Edit the config file
   nano .backlog-jira/config.json
   
   # Add the mcp section as shown above
   ```

3. **Test Connection**
   ```bash
   backlog-jira connect
   ```

4. **Verify Performance**
   ```bash
   # Run performance benchmark
   ./benchmark-mcp-performance.js
   ```

## Migration Plan

### Phase 1: Enable with Fallback (Recommended First Step)

1. Update configuration with `fallbackToDocker: true`
2. Test basic operations (`backlog-jira connect`, `backlog-jira status`)
3. Monitor logs for connection issues
4. Gradually test more complex operations (pull, push, sync)

### Phase 2: Performance Testing

1. Run benchmark script to measure improvements
2. Test with your actual Jira instance
3. Verify end-to-end workflows work correctly
4. Compare operation times before and after

### Phase 3: Full Migration (Optional)

1. Once confident in external server stability, set `fallbackToDocker: false`
2. Remove Docker-related configuration if desired
3. Update documentation and team instructions

## Troubleshooting

### Common Issues

#### 1. External Server Not Found

**Error**: `Command not found: mcp-atlassian`

**Solution**:
```bash
# Install the MCP Atlassian server
npm install -g @modelcontextprotocol/mcp-atlassian

# OR specify full path in config
{
  "mcp": {
    "serverCommand": "/usr/local/bin/mcp-atlassian"
  }
}
```

#### 2. Connection Timeout

**Error**: `Failed to connect to external MCP server`

**Solution**:
1. Verify server command works manually
2. Check environment variables are set
3. Enable debug logging: `LOG_LEVEL=debug backlog-jira connect`
4. Ensure fallback is enabled for testing

#### 3. Authentication Errors

**Error**: `Missing required Jira credentials`

**Solution**:
```bash
# Verify environment variables
echo "JIRA_URL: $JIRA_URL"
echo "JIRA_USERNAME: $JIRA_USERNAME"
echo "JIRA_API_TOKEN: [hidden]"

# Test authentication manually
curl -u "$JIRA_USERNAME:$JIRA_API_TOKEN" \
  -H "Accept: application/json" \
  "$JIRA_URL/rest/api/2/myself"
```

#### 4. DNS Configuration Issues

**Error**: DNS resolution failures in enterprise environments

**Solution**:
```bash
# Use CLI flags for DNS configuration
backlog-jira mcp start --dns-servers 8.8.8.8 1.1.1.1 --dns-search-domains company.com

# Or configure in .backlog-jira/config.json
{
  "mcp": {
    "dnsServers": ["10.0.0.1", "10.0.0.2"],
    "dnsSearchDomains": ["company.internal", "corp.local"]
  }
}
```

**Note**: DNS configuration applies environment variables that some applications may respect. Full DNS resolution changes may require system-level configuration or containerization.

### Debug Mode

Enable debug logging to troubleshoot connection issues:

```bash
export LOG_LEVEL=debug
backlog-jira connect
```

Look for these log messages:
- `Connecting to external MCP server`
- `Successfully connected to external MCP Atlassian server`
- `Falling back to Docker-based MCP server` (if fallback occurs)

## Compatibility

### Supported MCP Server Versions

- **@modelcontextprotocol/mcp-atlassian**: v1.0.0+
- **Custom MCP servers**: Any server implementing the MCP Atlassian protocol

### Backlog.md Integration

This feature is compatible with Backlog.md's MCP mode. While Backlog.md uses MCP for AI tool integration, this plugin uses MCP for Jira API access - they serve different purposes and don't conflict.

### Docker Fallback

The Docker-based approach remains available as a fallback:
- Automatic fallback when `fallbackToDocker: true`
- Manual override by setting `useExternalServer: false`
- Zero breaking changes for existing installations

## Future Enhancements

### TCP Transport Support

Future versions may support TCP-based MCP connections for:
- Remote MCP server deployment
- Better connection pooling
- Network-based service discovery

### Connection Pooling

Planned improvements include:
- Persistent connections across multiple operations
- Connection health monitoring
- Automatic reconnection on failures

### Server Management

Future features may include:
- Automatic MCP server startup/shutdown
- Server health checks
- Performance monitoring and metrics

## See Also

- [MCP Protocol Documentation](https://modelcontextprotocol.io)
- [MCP Atlassian Server](https://github.com/modelcontextprotocol/servers/tree/main/atlassian)
- [Backlog.md MCP Integration](../README.md#mcp-integration)
- [Performance Benchmarking](../benchmark-mcp-performance.js)