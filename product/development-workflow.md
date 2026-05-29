# Development Workflow

## Purpose

Use this workflow to move from product intent to implementation without skipping product, UX, editor-surface, or boundary decisions.

## Default sequence

1. **User scenario**
   Capture the user-facing behavior in `product/user-scenarios.md`, including Markdown authoring, rendered-view, and AI-assisted editing workflows when relevant.
2. **Lightweight architecture check**
   Decide whether the scenario changes extension boundaries, rendered-view synchronization, provider integration, persisted state, privacy posture, or command flow.
3. **Feature spec**
   Create a focused spec in `specs/` for the slice that is ready to build.
4. **Plan and tasks**
   Generate implementation planning artifacts and ordered tasks for that spec.
5. **Implementation**
   Build, test, and validate the slice.

## When to do the architecture check earlier

Do the architecture check immediately after the user scenario when the scenario introduces any of the following:

- persisted comments, anchors, or history
- render pipeline, preview synchronization, or editor surface changes that affect how source and rendered views stay aligned
- background jobs or long-running AI workflows
- new provider abstractions or fallback behavior
- privacy-sensitive document handling or telemetry
- multi-file editing or broader workspace access
- non-Markdown file support

In these cases, update `architecture/high-level-architecture.md` first and add an ADR if the change creates a durable system boundary or platform rule.

## Practical rule

- If the scenario fits the existing product and system shape, go from scenario to spec.
- If the scenario changes the system shape, do a short architecture pass before the spec.

## Output by document type

- `product/user-scenarios.md`: enduring user-facing behavior
- `architecture/high-level-architecture.md`: current system and component shape
- `architecture/adr-*.md`: durable architecture decisions
- `specs/<feature>/`: scoped implementation-ready feature definition

## Testing principles

- Test behavior at the right layer instead of leaning only on editor-level end-to-end tests.
- Prefer fast, deterministic tests over brittle or slow tests.
- Cover rendered-view alignment, selection anchoring, diff application, Markdown integrity, and privacy boundaries first.
- Once user scenarios are formally captured, preserve them or intentionally update the source docs and related tests.
- Bug fixes should add or update a test that would have caught the issue, and the PR should name the exact regression test that now covers the fix.

## Expected test layers

- **Unit tests:** anchoring, context building, diff generation, validation, and formatting logic.
- **Integration tests:** VS Code command flow, provider adapters, document update flow, and persistence boundaries.
- **UI tests:** browser-based webview contract tests for inline action surfaces, rendered selection and popup behavior, diff presentation, and core error handling for editing flows.
- **Manual verification:** targeted editor walkthroughs for critical UX paths when automation is not enough.

## Current automated test suites

The repository currently has these automated suites wired into `npm test`:

- **Unit tests:** under `tests/unit/`
- **Integration tests:** under `tests/integration/`

The browser-based webview selection contract suite exists as a dedicated command under
`tests/webview/`, but it is intentionally kept separate from `npm test`, CI, and release verification
until the suite stabilizes.

## When to run browser-based webview contract tests

- Install the Playwright browser once per machine with `npm run test:webview:install` before running
  `npm run test:webview`.
- Run them during feature work and bug fixes that touch rendered selection handling, popup behavior,
  selection anchors, rendered selection markup, or bounding-rect and geometry logic.
- Run them explicitly before merge for pull requests that affect the webview selection-to-popup
  contract.
- Add or update one of these tests for bugs that originate at the webview DOM selection or popup
  boundary.
- Promote them into `npm test`, CI, and release verification only after the suite is stable enough to
  serve as a blocking gate.

## Verification commands

- `npm run compile` - TypeScript compilation
- `npm run test` - runs the integration and unit suites
- `npm run test:webview:install` - installs the Chromium browser used by the webview contract suite
- `npm run test:webview` - browser-based webview contract suite
- `npm run test:integration` - VS Code integration suite
- `npm run test:unit` - unit suite
- `npm run package:vsix` - package extension artifact
- `npm run verify:release` - compile, test, and package release artifact

## Pull request verification requirements

- Behavior-touching PRs should include a verification section that records the exact commands run or the exact blocker for each required command.
- The default verification set is `npm run compile` and `npm run test`.
- PRs that affect rendered selection, popup behavior, selection anchors, rendered selection markup, or related geometry logic should also record `npm run test:webview`.
- PRs with user-visible UX or editor-surface changes should include short manual walkthrough notes describing what was exercised and what happened.
- Bug-fix PRs should name the exact regression test added or updated for the fix. If automation is not yet practical, the PR should say why and name the manual verification that covers the bug.
- If expected local verification is blocked, treat that as a workflow defect to surface explicitly and track, not as passive PR context.
