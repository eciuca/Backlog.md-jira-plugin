---
id: task-337
title: 'Update jira push to sync description, plan and notes'
status: Done
assignee:
  - '@agent-k'
created_date: '2025-10-28 10:10'
updated_date: '2025-10-28 10:32'
labels:
  - enhancement
  - sync
dependencies: []
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Currently jira push only syncs acceptance criteria to Jira. Need to enhance it to also update the Jira issue description with the full task content including Implementation Plan and Implementation Notes sections.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Description field in Jira includes task description from Backlog.md
- [x] #2 Implementation Plan section is included in Jira description
- [x] #3 Implementation Notes section is included in Jira description
- [x] #4 Formatting is preserved and readable in Jira
- [x] #5 Existing push functionality (AC sync) continues to work
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Analyze current description sync in buildJiraUpdates function
2. Enhance mergeDescriptionWithAc to include plan and notes
3. Update both push (new issue) and update paths to use enhanced description
4. Test with tasks that have plan and notes sections
5. Verify formatting is preserved in Jira
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Enhanced Jira push functionality to sync complete task details:

- Modified mergeDescriptionWithAc() in normalizer.ts to accept optional implementationPlan and implementationNotes parameters
- Updated push.ts in two locations:
  1. New issue creation path (line 300-307): passes plan and notes to mergeDescriptionWithAc
  2. Issue update path (buildJiraUpdates, line 403-413): includes plan and notes in description updates
- Added comprehensive test coverage in normalizer.test.ts with 12 test cases covering all scenarios
- All 247 existing tests continue to pass, confirming backward compatibility

The Jira description now includes:
1. Task description
2. Acceptance Criteria (with checkboxes)
3. Implementation Plan (if present)
4. Implementation Notes (if present)

This provides complete context in Jira while maintaining the existing AC sync functionality.
<!-- SECTION:NOTES:END -->
