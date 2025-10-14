#!/usr/bin/env bash

# Simple integration test for Jira connection
# This script assumes you're running it from a project root with existing .backlog-jira config
# It just tests that we can connect to Jira using the credentials in your environment

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

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

print_info "Simple Jira connection test"
print_info "Project root: $PROJECT_ROOT"
echo ""

# Test 1: Verify environment variables are set
print_info "Test 1: Checking Jira credentials"

# Check for Personal Access Token (Server/Data Center)
if [ -n "$JIRA_PERSONAL_TOKEN" ]; then
    if [ -z "$JIRA_URL" ]; then
        print_error "Missing JIRA_URL for Personal Access Token authentication"
        print_info "Required: JIRA_URL and JIRA_PERSONAL_TOKEN"
        exit 1
    fi
    print_status "Jira credentials found (Personal Access Token)"
# Check for API Token (Cloud)
elif [ -n "$JIRA_API_TOKEN" ]; then
    if [ -z "$JIRA_URL" ] || [ -z "$JIRA_EMAIL" ]; then
        print_error "Missing credentials for API Token authentication"
        print_info "Required: JIRA_URL, JIRA_EMAIL, and JIRA_API_TOKEN"
        exit 1
    fi
    print_status "Jira credentials found (API Token)"
else
    print_error "Missing Jira credentials"
    print_info "Two authentication methods are supported:"
    echo ""
    print_info "1. For Jira Cloud (API Token):"
    print_info "   - JIRA_URL (e.g., https://yoursite.atlassian.net)"
    print_info "   - JIRA_EMAIL (your Jira account email)"
    print_info "   - JIRA_API_TOKEN (get from https://id.atlassian.com/manage-profile/security/api-tokens)"
    echo ""
    print_info "2. For Jira Server/Data Center (Personal Access Token):"
    print_info "   - JIRA_URL (e.g., https://jira.yourcompany.com)"
    print_info "   - JIRA_PERSONAL_TOKEN (your PAT)"
    echo ""
    print_info "Run with (Cloud):"
    print_info "  JIRA_URL='...' JIRA_EMAIL='...' JIRA_API_TOKEN='...' $0"
    echo ""
    print_info "Or run with (Server/Data Center):"
    print_info "  JIRA_URL='...' JIRA_PERSONAL_TOKEN='...' $0"
    exit 1
fi

# Get project key from config if available
if [ -f "$PROJECT_ROOT/.backlog-jira/config.json" ]; then
    JIRA_PROJECT_KEY=$(cat "$PROJECT_ROOT/.backlog-jira/config.json" | grep -o '"projectKey"[[:space:]]*:[[:space:]]*"[^"]*"' | cut -d'"' -f4 || echo "")
    if [ -n "$JIRA_PROJECT_KEY" ]; then
        export JIRA_PROJECT_KEY
        print_status "Using project key from config: $JIRA_PROJECT_KEY"
    fi
fi

# Default to S20 if not set
export JIRA_PROJECT_KEY="${JIRA_PROJECT_KEY:-S20}"
echo ""

# Test 2: Test Jira connection using JiraClient.test()
print_info "Test 2: Testing Jira connection with JiraClient.test()"

cd "$PROJECT_ROOT"

# Run the connection test
if bun run "$SCRIPT_DIR/test-connection.ts" 2>&1; then
    print_status "Jira connection test passed"
else
    print_error "Jira connection test failed"
    exit 1
fi
echo ""

# Test 3: Try to fetch data from Jira
print_info "Test 3: Fetching Jira projects list"

if bun run "$SCRIPT_DIR/test-get-projects.ts" 2>&1; then
    print_status "Jira data fetch successful"
else
    print_error "Jira data fetch failed"
    exit 1
fi

# All tests passed
echo ""
print_status "All Jira connection tests passed!"
echo ""
print_info "Summary:"
echo "  ✓ Jira credentials verified"
echo "  ✓ Jira connection established"
echo "  ✓ Jira API accessible and working"
echo ""

exit 0
