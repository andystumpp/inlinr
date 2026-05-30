## Summary

<!-- Describe what this PR changes and why. -->

## Type

- [ ] Feature
- [ ] Bug fix
- [ ] Refactor / cleanup
- [ ] Docs / workflow

## Verification

Record the exact commands run or explicit blockers. Do not leave this section blank.

### `npm run compile`

- [ ] Passed
- [ ] Blocked — reason: <!-- describe what prevented this -->

### `npm run test`

- [ ] Passed
- [ ] Blocked — reason: <!-- describe what prevented this -->

### `npm run test:webview`

*(Required when this PR touches rendered selection handling, popup behavior, selection anchors, bounding-rect or geometry logic, or the webview selection-to-popup contract.)*

- [ ] Passed
- [ ] Not applicable — reason: <!-- e.g. no webview changes -->
- [ ] Blocked — reason: <!-- describe what prevented this -->

### Manual walkthrough

*(Required for UX changes: new or modified UI surfaces, interaction flows, error states, or any change a user would notice.)*

- [ ] Completed — notes: <!-- describe what you tested and what you observed -->
- [ ] Not applicable — reason: <!-- e.g. no user-visible behavior changed -->

## Bug fix regression test

*(Required when this PR is a bug fix.)*

<!-- Name the test added or updated that would have caught this bug. -->
- Regression test: <!-- e.g. `tests/unit/anchorResolver.test.ts` — added "returns null when selection is empty" -->

<!-- If no regression test was added, explain why. -->

## Checklist

- [ ] Docs updated if behavior changed
- [ ] No new security vulnerabilities introduced
