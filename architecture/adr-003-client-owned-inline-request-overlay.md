# ADR 003: Client-Owned Inline Request Overlay

## Status

Accepted

## Context

The first implementation of selection-scoped request capture kept the inline request popup largely
under extension-host rendering control. The webview captured a selection, the extension host
validated it, and then the host rebuilt the full webview HTML to show popup state, draft changes,
submit state, and positioning.

That design kept the source-backed validation boundary in the right place, but it placed transient
overlay behavior on the wrong side of the architecture boundary.

Manual testing exposed repeated failures that automated coverage did not catch:

- popup placement drifted because overlay position was computed in the webview but rendered later
  by the extension host in a different coordinate system
- submit and draft interactions were vulnerable to rerender timing because the host rewrote the full
  webview HTML for transient state changes
- integration tests passed because they injected synthetic selection messages directly into the
  provider rather than exercising real DOM selection and popup behavior

The result is a systemic mismatch: transient interaction state lives in the extension host, while
the only component that actually understands the current DOM selection, viewport, and scroll state
is the webview itself.

## Decision

Inlinr keeps source-backed validation and request submission in the extension host, but moves the
inline request overlay to a client-owned webview controller.

- The Markdown render pipeline emits stable DOM attributes for supported selection regions and
  source-backed markers.
- The webview resolves the actual DOM selection against those rendered attributes and owns the
  overlay lifecycle, including placement, scroll behavior, focus handling, and draft entry.
- The extension host remains authoritative for validating the proposed selection, creating the
  durable selection anchor, enforcing single-session rules, and building the submit payload.
- Overlay coordinates and other transient layout details are treated as UI hints, not canonical
  targeting data.
- The extension host does not rerender the full document HTML for every draft keystroke or popup
  position change.
- Automated coverage must include at least one DOM-driven webview interaction path that exercises
  real rendered selection behavior rather than only synthetic message injection.

## Consequences

- Popup visibility and placement become the responsibility of the surface that owns the live DOM,
  which is the webview.
- The extension host can stay focused on durable document concerns: source mapping, anchor
  revalidation, submit gating, and request payload creation.
- Message contracts become narrower and more explicit because transient overlay layout is no longer
  persisted as host-owned state.
- The current host-rendered popup path should be treated as transitional and refactored before more
  rounds of popup bug-fixing.
- Existing integration tests that inject `selection.capture` directly into the provider remain
  useful for host validation, but they are insufficient as the only regression coverage for this
  feature.

## Alternatives considered

- Continue patching popup CSS and coordinate transforms while keeping the host-rendered popup model.
- Keep the popup host-rendered but try to reduce rerender frequency.
- Move the entire selection-validation flow into the webview.

## Related documents

- `architecture/high-level-architecture.md`
- `architecture/adr-002-inlinr-owned-request-capture-and-model-invocation.md`
- `specs/002-selection-scoped-edit-request/spec.md`
- `specs/002-selection-scoped-edit-request/plan.md`
- `specs/002-selection-scoped-edit-request/contracts/selection-request-contract.md`