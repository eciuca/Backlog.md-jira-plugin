---
id: task-318
title: 'Fix failing test: ''should throw error for missing authentication credentials'''
status: Done
assignee:
  - '@agent'
created_date: '2025-10-15 06:01'
updated_date: '2025-10-15 06:31'
labels:
  - test
  - bugfix
dependencies: []
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The test 'JiraClient > External MCP Server Configuration > should throw error for missing authentication credentials' is failing because it doesn't properly clear all authentication-related environment variables before testing. The test only deletes JIRA_USERNAME and JIRA_API_TOKEN, but the validateAndPrepareCredentials() method also checks for JIRA_PERSONAL_TOKEN and JIRA_EMAIL, which may still be set in the test environment.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Test passes after fixing environment cleanup
- [x] #2 All authentication environment variables are properly cleared in the test
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Examine the test to confirm the issue
2. Update the beforeEach hook to save all auth-related env vars (JIRA_EMAIL, JIRA_PERSONAL_TOKEN)
3. Update the failing test to clear all auth env vars (JIRA_USERNAME, JIRA_API_TOKEN, JIRA_EMAIL, JIRA_PERSONAL_TOKEN)
4. Run the test to verify it passes
5. Add implementation notes
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Fixed the failing test by properly clearing all authentication environment variables.

## Changes Made
- Updated `beforeEach` hook to save `JIRA_EMAIL` and `JIRA_PERSONAL_TOKEN` in addition to existing vars
- Modified the failing test to delete all four auth-related environment variables: `JIRA_USERNAME`, `JIRA_API_TOKEN`, `JIRA_EMAIL`, and `JIRA_PERSONAL_TOKEN`

## Verification
- Ran the specific test: now passes ✓
- Ran all jira.test.ts tests: 11/11 passing ✓

## Root Cause
The `validateAndPrepareCredentials()` method checks for multiple authentication variables (`JIRA_EMAIL || JIRA_USERNAME` and `JIRA_PERSONAL_TOKEN`), but the test was only clearing two of them, leaving `JIRA_EMAIL` and `JIRA_PERSONAL_TOKEN` potentially set from the test environment.
<!-- SECTION:NOTES:END -->
