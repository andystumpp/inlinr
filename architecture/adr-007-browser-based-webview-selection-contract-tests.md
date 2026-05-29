# ADR 007: Browser-Based Webview Selection Contract Tests

## Status

Proposed

## Context

Inlinr already has real automated tests, but the current suites are centered on Mocha running inside a
VS Code test instance through `@vscode/test-electron`.

That is the right tool for extension-host integration, command flow, apply or reject behavior, and
telemetry. It is not the clearest primary tool for the missing reliability gap around the inline popup.

Today, the highest-risk boundary is the webview path from:

1. DOM selection
2. selection direction and range normalization
3. bounding-rect lookup
4. popup trigger gating
5. emitted `selection.capture` message

Current integration coverage largely starts after that boundary by injecting synthetic
`selection.capture` messages directly into the extension-side flow. That leaves a gap for failures such
as:

- normal text selections that do not produce a popup
- reverse selections that resolve differently from forward selections
- multi-block and list-item selections that cross rendered structure boundaries
- inline formatting boundaries that distort selected text or popup placement
- repeated select and deselect cycles that leave stale popup state behind
- empty or unstable bounding-rect behavior that should block or safely degrade popup behavior

The repository's current guidance already points to a separate test layer for this:

- `product/development-workflow.md` says to test behavior at the right layer
- `product/development-workflow.md` expects UI tests for inline action surfaces and rendered-view behavior
- `architecture/high-level-architecture.md` places transient overlay state in the webview and
  source-backed validation in the extension host
- `architecture/adr-003-client-owned-inline-request-overlay.md` already notes that automated coverage
  must include at least one DOM-driven webview interaction path

This decision is about the primary technical solution for that missing layer.

## Decision

Adopt a dedicated browser-based webview selection contract suite as the first missing test layer for
popup reliability.

- Use **Playwright** as the primary tool for the new suite.
- Run it against a **sandboxed browser harness** that loads the real webview selection script and
  realistic rendered HTML fixtures.
- Keep **Mocha + `@vscode/test-electron`** as the existing authority for post-message extension-host
  behavior.
- Treat the following as **minimum scenario coverage**, with room to add more scenarios as incidents,
  regressions, or new feature slices reveal additional failure modes:
  - normal text selection
  - reverse selection
  - multi-block selection
  - list-item selection
  - inline formatting boundaries
  - repeated select and deselect cycles
  - empty bounding-rect cases
  - unstable bounding-rect cases
- Keep the browser-based suite focused on the webview contract only:
  - rendered DOM fixture setup
  - user-like selection behavior
  - popup eligibility and gating
  - emitted `selection.capture` message shape
  - safe no-op behavior when geometry or selection state is invalid
- Treat this suite as a staged rollout rather than an immediate default pipeline gate:
  - run it during feature work and bug fixes that touch rendered selection, popup behavior, rendered
    selection markup, or bounding-rect and geometry logic
  - run it explicitly for pull requests that affect the webview selection-to-popup contract
  - keep it out of default CI and release verification until the suite has demonstrated stable signal
  - promote it into `npm test`, CI, and release verification only after that stabilization step
- Do not make a DOM emulator such as jsdom the primary solution for this layer, because the bug class
  depends on real browser behavior around `Selection`, `Range`, and geometry.
- Do not use the full VS Code test instance as the primary tool for this layer, because it is slower,
  more brittle, and less direct for diagnosing browser-side popup behavior.
- If later evidence shows that the sandbox harness misses an important VS Code-specific behavior, add a
  small number of VS Code-hosted smoke tests for critical scenarios rather than moving the whole layer
  back into the VS Code test host.

## Consequences

- The test strategy becomes clearer:
  - Playwright sandbox tests own the webview DOM and popup contract
  - Mocha + VS Code test-electron suites own extension-host validation, request execution, review,
    document mutation, and telemetry
- Popup regressions can be caught earlier and more deterministically than with extension-level tests
  alone.
- The repository gains a new test harness and dependency surface that will need maintenance.
- The development workflow becomes stricter for webview interaction changes, but the suite can mature
  before it becomes a blocking default gate.
- Realistic rendered fixtures and controlled geometry stubs become part of the test system of record for
  popup behavior.
- If a browser harness result and a real VS Code webview ever diverge, the right response is to add a
  focused smoke test and tighten the contract, not to collapse all testing into one slower layer.

## Alternatives considered

- Keep relying on Mocha + `@vscode/test-electron` only and continue patching popup bugs through
  integration coverage.
- Use a DOM emulator such as jsdom or happy-dom for the new layer instead of a real browser engine.
- Build the new layer primarily as a full VS Code UI or acceptance suite rather than a browser-based
  contract suite.

## Related documents

- `product/user-scenarios.md`
- `product/development-workflow.md`
- `architecture/high-level-architecture.md`
- `architecture/security-principles.md`
- `architecture/adr-003-client-owned-inline-request-overlay.md`
- `specs/002-selection-scoped-edit-request/spec.md`
- `specs/003-execute-selection-request/spec.md`
