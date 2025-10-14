# Jira Authentication Methods

The Backlog.md Jira plugin supports two authentication methods, depending on whether you're using **Jira Cloud** or **Jira Server/Data Center**.

## Jira Cloud - API Token Authentication ☁️

**Recommended for:** Atlassian Cloud instances (*.atlassian.net)

### Required Environment Variables:
```bash
JIRA_URL="https://yoursite.atlassian.net"
JIRA_EMAIL="your-email@example.com"
JIRA_API_TOKEN="your-api-token-here"
```

### How to Get an API Token:

1. Visit [Atlassian API Tokens](https://id.atlassian.com/manage-profile/security/api-tokens)
2. Click **"Create API token"**
3. Give it a descriptive name (e.g., "Backlog.md Plugin")
4. Copy the generated token
5. Store it securely (you won't be able to see it again)

### Usage Example:
```bash
# Set environment variables
export JIRA_URL="https://yoursite.atlassian.net"
export JIRA_EMAIL="your-email@example.com"
export JIRA_API_TOKEN="ATATT3xFfGF0..."

# Initialize plugin
backlog-jira init

# Run commands
backlog-jira pull
backlog-jira push
```

---

## Jira Server/Data Center - Personal Access Token 🏢

**Recommended for:** Self-hosted Jira instances

### Required Environment Variables:
```bash
JIRA_URL="https://jira.yourcompany.com"
JIRA_PERSONAL_TOKEN="your-personal-access-token"
```

### How to Get a Personal Access Token:

1. Log in to your Jira Server instance
2. Click your profile icon → **Personal Access Tokens** (or **Profile → Manage your account → Security → Create and manage API tokens**)
3. Click **"Create token"**
4. Give it a name and set appropriate permissions
5. Copy the generated token
6. Store it securely

### Usage Example:
```bash
# Set environment variables
export JIRA_URL="https://jira.yourcompany.com"
export JIRA_PERSONAL_TOKEN="your-pat-here"

# Initialize plugin
backlog-jira init

# Run commands
backlog-jira pull
backlog-jira push
```

---

## How It Works

The plugin automatically detects which authentication method to use based on the environment variables you provide:

- If `JIRA_PERSONAL_TOKEN` is set → Uses **Personal Access Token** authentication
- Otherwise, if `JIRA_API_TOKEN` and `JIRA_EMAIL` are set → Uses **API Token** authentication

The authentication is handled by the underlying [MCP Atlassian](https://github.com/sooperset/mcp-atlassian) server, which supports both methods seamlessly.

---

## Security Best Practices

### ✅ DO:
- Store credentials in environment variables or secure secret managers
- Use `.env` files for local development (add to `.gitignore`)
- Rotate tokens regularly
- Use separate tokens for different environments (dev/staging/prod)
- Grant minimum required permissions to tokens

### ❌ DON'T:
- Commit credentials to version control
- Share tokens in plain text (Slack, email, etc.)
- Use the same token across multiple systems
- Store tokens in your shell history

### Example `.env` file:
```bash
# .env (add to .gitignore!)
JIRA_URL=https://yoursite.atlassian.net
JIRA_EMAIL=your-email@example.com
JIRA_API_TOKEN=your-token-here
```

Load it with:
```bash
source .env
# or
export $(grep -v '^#' .env | xargs)
```

---

## Testing Authentication

To verify your credentials work correctly, run the integration test:

```bash
# For Cloud
JIRA_URL='...' JIRA_EMAIL='...' JIRA_API_TOKEN='...' \
  ./tests/integration/test-jira-connection-simple.sh

# For Server/Data Center
JIRA_URL='...' JIRA_PERSONAL_TOKEN='...' \
  ./tests/integration/test-jira-connection-simple.sh
```

A successful test will show:
```
✓ Jira credentials verified
✓ Jira connection established
✓ Jira API accessible and working
```

---

## Troubleshooting

### "Missing required Jira credentials"
- Verify all required environment variables are set
- Check for typos in variable names
- Ensure variables are exported: `export JIRA_URL="..."`

### "Failed to connect to MCP Atlassian server"
- Verify Docker is running: `docker ps`
- Check your network connection
- Verify the Jira URL is correct and accessible

### "Authentication failed" or "401 Unauthorized"
- For **API Token**: Verify your email and token are correct
- For **Personal Token**: Verify the token has appropriate permissions
- Try regenerating the token
- Check if your token has expired

### "Cannot find module" or similar errors
- Ensure the plugin is built: `npm run build`
- Verify Docker image is available: `docker pull ghcr.io/sooperset/mcp-atlassian:latest`

---

## OAuth 2.0 (Advanced)

OAuth 2.0 authentication is also supported for Jira Cloud but requires additional setup. This is typically used for:
- Third-party apps that need user consent
- Organizations with stricter security requirements
- Apps that need to act on behalf of multiple users

For OAuth setup, refer to the [MCP Atlassian documentation](https://github.com/sooperset/mcp-atlassian#oauth-20-setup).

---

## Related Documentation

- [Integration Tests README](../tests/integration/README.md)
- [MCP Atlassian Server](https://github.com/sooperset/mcp-atlassian)
- [Atlassian API Tokens](https://support.atlassian.com/atlassian-account/docs/manage-api-tokens-for-your-atlassian-account/)
- [Jira Server PATs](https://confluence.atlassian.com/enterprise/using-personal-access-tokens-1026032365.html)
