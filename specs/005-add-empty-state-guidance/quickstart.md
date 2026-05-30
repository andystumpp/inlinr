# Quickstart: Empty State Guidance

## Goal

Validate that first-run guidance helps a new user discover the selection-based editing flow without adding repeated or distracting chrome for returning users.

## Privacy Boundary

- Persist only local completion metadata for the first-action hint in VS Code global state.
- Do not persist document content, selected text, or request text as part of onboarding completion.

## Scenario 1: First open shows guidance

1. Open a Markdown file in the Inlinr viewer with no stored first-action guidance completion state.
2. Confirm the document still renders normally and remains readable.
3. Confirm subtle in-document guidance appears immediately.
4. Confirm the guidance explains that selecting text starts the editing flow.
5. Confirm the guidance does not block scrolling or text selection.

## Scenario 2: Direct dismissal completes onboarding

1. Open a Markdown file as a first-run user.
2. Dismiss the guidance from the viewer.
3. Confirm the guidance disappears immediately in the active viewer.
4. Reopen the same document or open another Markdown file.
5. Confirm the guidance does not reappear for that user.

## Scenario 3: Qualifying selection completes onboarding

1. Open a Markdown file as a first-run user.
2. Select supported rendered prose to start a request.
3. Confirm the request popup still opens normally.
4. Confirm the guidance disappears as part of that first successful discovery action.
5. Reopen the viewer and confirm the guidance stays suppressed.

## Scenario 4: Successful request keeps guidance suppressed

1. Start from a first-run user state.
2. Open the request popup, submit a valid instruction, and reach suggestion review.
3. Confirm no first-run guidance returns during the request lifecycle.
4. Reopen a Markdown file after the successful request.
5. Confirm the viewer opens without the guidance banner.

## Verification Checklist

| Check | Command / Method | Status |
|---|---|---|
| TypeScript compile | `npm run compile` | PASS |
| VS Code-hosted integration and unit suites | `npm test` / `npm run test:unit:only` | BLOCKED - existing workspace-path runner issue loads `tests\fixtures\workspace` as a module path |
| Playwright webview suite | `npm run test:webview:only` | BLOCKED - existing script does not resolve a Playwright CLI on this machine |
