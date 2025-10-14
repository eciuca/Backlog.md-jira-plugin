#!/usr/bin/env bash

# Integration test for clean installation workflow
# This script tests that backlog-jira commands work correctly in a clean environment

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

print_info "Starting clean installation test"
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

# Test 1: Verify we're in a clean directory
print_info "Test 1: Verifying clean directory state"
if [ -d "backlog" ] || [ -d "node_modules" ] || [ -f "package.json" ]; then
    print_error "Directory is not clean!"
    exit 1
fi
print_status "Clean directory verified"

# Test 2: Check if backlog CLI is available
print_info "Test 2: Checking for backlog CLI"
if ! command -v backlog &> /dev/null; then
    print_error "backlog CLI not found. Please install Backlog.md first."
    print_info "Visit: https://github.com/codevalley/backlog.md"
    exit 1
fi
print_status "backlog CLI found: $(which backlog)"

# Test 3: Initialize git repository (required for backlog)
print_info "Test 3a: Initializing git repository"
if ! git init &> /dev/null; then
    print_error "git init failed"
    exit 1
fi
print_status "Git repository initialized"

# Test 3b: Initialize Backlog.md project
print_info "Test 3b: Running 'backlog init'"
if ! backlog init test-project --defaults; then
    print_error "'backlog init' failed"
    exit 1
fi

# Verify backlog directory was created
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

# Test 5: Run backlog-jira init
print_info "Test 5: Running 'backlog-jira init'"
# Create a temporary config with dummy values for non-interactive testing
export JIRA_URL="https://example.atlassian.net"
export JIRA_EMAIL="test@example.com"
export JIRA_API_TOKEN="dummy_token"
export JIRA_PROJECT_KEY="TEST"

# Try to run init - it might fail due to invalid credentials, but should not crash
OUTPUT=$(backlog-jira init 2>&1 || true)

# Check if the command ran without critical errors (dependency not found, etc.)
if echo "$OUTPUT" | grep -qi "cannot find module\|modulenotfound\|enoent"; then
    print_error "'backlog-jira init' failed with dependency error:"
    echo "$OUTPUT"
    exit 1
fi

# Check if config directory was created
if [ ! -d ".backlog-jira" ]; then
    print_error ".backlog-jira directory was not created"
    exit 1
fi
print_status "'backlog-jira init' ran without dependency errors"

# Test 6: Verify node_modules and dependencies
print_info "Test 6: Verifying dependencies"
BACKLOG_JIRA_PATH=$(which backlog-jira)
# Follow symlink to get the real path
BACKLOG_JIRA_REAL=$(readlink "$BACKLOG_JIRA_PATH" || echo "$BACKLOG_JIRA_PATH")
# Get the installation directory (going up from dist/cli.js to package root)
BACKLOG_JIRA_DIR=$(cd "$(dirname "$BACKLOG_JIRA_PATH")/$(dirname "$BACKLOG_JIRA_REAL")/.." && pwd)

print_info "backlog-jira installed at: $BACKLOG_JIRA_DIR"

# Check if pino and pino-pretty are available
if [ -d "$BACKLOG_JIRA_DIR/node_modules/pino" ]; then
    print_status "pino module found in: $BACKLOG_JIRA_DIR/node_modules/pino"
else
    print_error "pino module not found at: $BACKLOG_JIRA_DIR/node_modules/pino"
    exit 1
fi

if [ -d "$BACKLOG_JIRA_DIR/node_modules/pino-pretty" ]; then
    print_status "pino-pretty module found in: $BACKLOG_JIRA_DIR/node_modules/pino-pretty"
else
    print_error "pino-pretty module not found at: $BACKLOG_JIRA_DIR/node_modules/pino-pretty"
    exit 1
fi

# Test 7: Verify no hardcoded paths in dist/cli.js
print_info "Test 7: Checking for hardcoded paths in bundle"
DIST_CLI="$PROJECT_ROOT/dist/cli.js"
if [ -f "$DIST_CLI" ]; then
    if grep -q "/Users/" "$DIST_CLI" || grep -q "/home/" "$DIST_CLI"; then
        print_error "Found hardcoded absolute paths in dist/cli.js"
        print_info "Paths found:"
        grep -n "/Users/\|/home/" "$DIST_CLI" | head -5
        exit 1
    fi
    print_status "No hardcoded paths found in bundle"
else
    print_error "dist/cli.js not found"
    exit 1
fi

# All tests passed
echo ""
print_status "All integration tests passed!"
echo ""
print_info "Summary:"
echo "  ✓ Clean directory setup"
echo "  ✓ backlog init successful"
echo "  ✓ backlog-jira init successful"
echo "  ✓ Dependencies resolved correctly"
echo "  ✓ No hardcoded paths in bundle"
echo ""

exit 0
