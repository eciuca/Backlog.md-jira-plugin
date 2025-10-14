# Integration Tests

This directory contains integration tests for the backlog-jira plugin.

## Clean Installation Workflow Test

The `test-clean-install.sh` script tests that the plugin works correctly in a clean environment, ensuring:

1. **Clean directory setup** - Starts in a fresh directory without existing backlog or node_modules
2. **Backlog.md initialization** - Runs `backlog init` successfully
3. **Plugin initialization** - Runs `backlog-jira init` successfully
4. **Dependency resolution** - Verifies that pino and pino-pretty are correctly loaded
5. **No hardcoded paths** - Ensures dist/cli.js doesn't contain absolute paths from the build machine

### Prerequisites

- **Backlog.md CLI** must be installed and available in PATH
  - Install from: https://github.com/codevalley/backlog.md
- **Node.js** (for npm link if testing locally)
- **Bash** shell

### Running Tests Locally

```bash
# Build the project first
npm run build

# Run the integration test
./tests/integration/test-clean-install.sh
```

### Running Tests in Docker

Docker testing is fully supported!

To test in a clean Linux environment (Alpine-based) once backlog is available:

```bash
# Build the Docker image (run from project root)
docker build -f tests/integration/Dockerfile -t backlog-jira-test .

# Run the test
docker run --rm backlog-jira-test
```

**Note**: The Docker build context should be the project root directory, not the tests/integration directory.

**Alternative**: You can test cross-platform compatibility by:
1. Installing backlog-jira from npm on a Linux machine
2. Running the test script manually: `./tests/integration/test-clean-install.sh`

### What the Test Does

1. Creates a temporary directory for testing
2. Verifies it's a clean environment (no backlog/, node_modules/, etc.)
3. Runs `backlog init` to set up a Backlog.md project
4. Checks for backlog-jira CLI (builds and links if needed)
5. Runs `backlog-jira init` with dummy credentials
6. Verifies the command doesn't fail with dependency errors
7. Checks that pino/pino-pretty modules are available
8. Verifies no hardcoded paths exist in the bundle
9. Cleans up the temporary directory

### Expected Output

```
ℹ Starting clean installation test
ℹ Test directory: /tmp/tmp.XXXXXXXXXX
ℹ Project root: /path/to/Backlog.md-jira-plugin
ℹ Test 1: Verifying clean directory state
✓ Clean directory verified
ℹ Test 2: Checking for backlog CLI
✓ backlog CLI found: /usr/local/bin/backlog
ℹ Test 3: Running 'backlog init'
✓ 'backlog init' completed successfully
ℹ Test 4: Checking for backlog-jira CLI
✓ backlog-jira CLI found: /usr/local/bin/backlog-jira
ℹ Test 5: Running 'backlog-jira init'
✓ 'backlog-jira init' ran without dependency errors
ℹ Test 6: Verifying dependencies
✓ pino module found in: /usr/local/lib/node_modules/backlog-jira/node_modules/pino
✓ pino-pretty module found in: /usr/local/lib/node_modules/backlog-jira/node_modules/pino-pretty
ℹ Test 7: Checking for hardcoded paths in bundle
✓ No hardcoded paths found in bundle

✓ All integration tests passed!

ℹ Summary:
  ✓ Clean directory setup
  ✓ backlog init successful
  ✓ backlog-jira init successful
  ✓ Dependencies resolved correctly
  ✓ No hardcoded paths in bundle
```

### Troubleshooting

**Error: backlog CLI not found**
- Install Backlog.md first: https://github.com/codevalley/backlog.md

**Error: backlog-jira CLI not found**
- The test will try to build and link it automatically
- If that fails, run `npm run build` and `npm link` manually

**Error: Cannot find module / ModuleNotFound**
- This indicates the dependency issue that task-306 fixed
- Ensure pino and pino-pretty are marked as external in the build script

**Error: Found hardcoded paths in dist/cli.js**
- This means the bundler is embedding absolute paths
- Verify the build command includes `--external pino --external pino-pretty`

## Jira Connection Test

The `test-jira-connection-simple.sh` script tests that the plugin can successfully connect to a real Jira instance and retrieve data.

### Authentication Methods

Two authentication methods are supported:

#### 1. **Jira Cloud - API Token** (Recommended for Cloud)

```bash
JIRA_URL='https://yoursite.atlassian.net' \
JIRA_EMAIL='your-email@example.com' \
JIRA_API_TOKEN='your-api-token' \
./tests/integration/test-jira-connection-simple.sh
```

**How to get an API token:**
1. Go to https://id.atlassian.com/manage-profile/security/api-tokens
2. Click "Create API token"
3. Give it a name and copy the token

#### 2. **Jira Server/Data Center - Personal Access Token**

```bash
JIRA_URL='https://jira.yourcompany.com' \
JIRA_PERSONAL_TOKEN='your-personal-access-token' \
./tests/integration/test-jira-connection-simple.sh
```

**How to get a Personal Access Token:**
1. Go to your Jira Server instance
2. Navigate to Profile → Personal Access Tokens
3. Create a new token with appropriate permissions

### What the Test Does

1. **Validates credentials** - Checks that required environment variables are set
2. **Tests connection** - Uses `JiraClient.test()` to verify connectivity
3. **Fetches data** - Retrieves the list of Jira projects to confirm API access

### Expected Output

```
ℹ Simple Jira connection test
ℹ Project root: /path/to/project

ℹ Test 1: Checking Jira credentials
✓ Jira credentials found (API Token)

ℹ Test 2: Testing Jira connection with JiraClient.test()
Connecting to Jira...
✓ Jira connection successful
✓ Jira connection test passed

ℹ Test 3: Fetching Jira projects list
Fetching Jira projects...
✓ Successfully retrieved projects!
Found 1 project(s)

Projects:
  - PROJ: Project Name
✓ Jira data fetch successful

✓ All Jira connection tests passed!

ℹ Summary:
  ✓ Jira credentials verified
  ✓ Jira connection established
  ✓ Jira API accessible and working
```

## Adding More Integration Tests

To add more integration tests:

1. Create a new `.sh` script in this directory
2. Make it executable: `chmod +x test-name.sh`
3. Follow the pattern of using `mktemp -d` for isolated testing
4. Add cleanup with `trap cleanup EXIT`
5. Document it in this README
