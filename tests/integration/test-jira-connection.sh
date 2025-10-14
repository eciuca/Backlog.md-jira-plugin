#!/usr/bin/env bash

# Integration test for Jira connection
# This script tests that the plugin can successfully connect to a real Jira instance

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}✓${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
}

print_info() {
    echo -e "${YELLOW}ℹ${NC} $1"
}

# Setup
TEST_DIR=$(mktemp -d)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

print_info "Starting Jira connection test"
print_info "Test directory: $TEST_DIR"
print_info "Project root: $PROJECT_ROOT"

# Cleanup function
cleanup() {
    if [ -d "$TEST_DIR" ]; then
        print_info "Cleaning up test directory: $TEST_DIR"
        rm -rf "$TEST_DIR"
    fi
}

# Register cleanup on exit
trap cleanup EXIT

# Navigate to test directory
cd "$TEST_DIR"

# Test 1: Verify environment variables are set
print_info "Test 1: Checking Jira credentials"
if [ -z "$JIRA_URL" ] || [ -z "$JIRA_EMAIL" ] || [ -z "$JIRA_API_TOKEN" ]; then
    print_error "Missing Jira credentials"
    print_info "Required environment variables:"
    print_info "  - JIRA_URL"
    print_info "  - JIRA_EMAIL"
    print_info "  - JIRA_API_TOKEN"
    exit 1
fi
print_status "Jira credentials found"

# Test 2: Initialize git repository
print_info "Test 2: Initializing git repository"
if ! git init &> /dev/null; then
    print_error "git init failed"
    exit 1
fi
print_status "Git repository initialized"

# Test 3: Initialize Backlog.md project
print_info "Test 3: Running 'backlog init'"
if ! backlog init test-project --defaults; then
    print_error "'backlog init' failed"
    exit 1
fi

if [ ! -d "backlog" ]; then
    print_error "backlog directory was not created"
    exit 1
fi
print_status "'backlog init' completed successfully"

# Test 4: Check if backlog-jira CLI is available
print_info "Test 4: Checking for backlog-jira CLI"
if ! command -v backlog-jira &> /dev/null; then
    print_error "backlog-jira CLI not found"
    print_info "Building from source..."
    
    # Build the CLI from project root
    cd "$PROJECT_ROOT"
    print_info "Building backlog-jira..."
    if ! npm run build 2>&1 | grep -i "error\|fail" && [ ${PIPESTATUS[0]} -ne 0 ]; then
        print_error "Build failed"
        exit 1
    fi
    
    # Link the CLI for testing
    print_info "Linking backlog-jira..."
    if ! npm link 2>&1 | grep -v "^up to date" > /dev/null; then
        print_error "npm link failed"
        exit 1
    fi
    
    cd "$TEST_DIR"
    print_status "backlog-jira CLI built and linked"
fi
print_status "backlog-jira CLI found: $(which backlog-jira)"

# Test 5: Initialize backlog-jira with real credentials
print_info "Test 5: Running 'backlog-jira init'"
# Export required variables
export JIRA_PROJECT_KEY="${JIRA_PROJECT_KEY:-S20}"  # Default to S20 if not set

# Run init command
if ! backlog-jira init 2>&1; then
    print_error "'backlog-jira init' failed"
    exit 1
fi

# Check if config was created
if [ ! -d ".backlog-jira" ]; then
    print_error ".backlog-jira directory was not created"
    exit 1
fi
print_status "'backlog-jira init' completed successfully"

# Test 6: Test Jira connection using the JiraClient.test() method
print_info "Test 6: Testing Jira connection"

# Create a test script that uses the JiraClient
cat > test-connection.ts << 'EOF'
import { JiraClient } from "../../../src/integrations/jira.ts";

async function testConnection() {
    const client = new JiraClient();
    try {
        const success = await client.test();
        if (success) {
            console.log("✓ Jira connection successful");
            process.exit(0);
        } else {
            console.error("✗ Jira connection failed");
            process.exit(1);
        }
    } catch (error) {
        console.error("✗ Jira connection error:", error);
        process.exit(1);
    }
}

testConnection();
EOF

# Run the connection test
cd "$PROJECT_ROOT"
if bun run "$TEST_DIR/test-connection.ts" 2>&1; then
    print_status "Jira connection test passed"
else
    print_error "Jira connection test failed"
    exit 1
fi

cd "$TEST_DIR"

# Test 7: Try to fetch projects from Jira
print_info "Test 7: Fetching Jira projects"

cat > test-projects.ts << 'EOF'
import { JiraClient } from "../../../src/integrations/jira.ts";

async function testProjects() {
    const client = new JiraClient();
    try {
        // This is a bit of a hack - we'll use searchIssues with a project filter
        // to verify we can communicate with Jira
        const result = await client.searchIssues(`project = ${process.env.JIRA_PROJECT_KEY}`, {
            maxResults: 1
        });
        
        console.log(`✓ Found ${result.total} issues in project ${process.env.JIRA_PROJECT_KEY}`);
        await client.close();
        process.exit(0);
    } catch (error) {
        console.error("✗ Failed to fetch projects:", error);
        await client.close();
        process.exit(1);
    }
}

testProjects();
EOF

cd "$PROJECT_ROOT"
if bun run "$TEST_DIR/test-projects.ts" 2>&1; then
    print_status "Jira project fetch successful"
else
    print_error "Jira project fetch failed"
    exit 1
fi

# All tests passed
echo ""
print_status "All Jira connection tests passed!"
echo ""
print_info "Summary:"
echo "  ✓ Jira credentials verified"
echo "  ✓ backlog init successful"
echo "  ✓ backlog-jira init successful"
echo "  ✓ Jira connection established"
echo "  ✓ Jira API accessible"
echo ""

exit 0
