# ADR 002: Inlinr-Owned Request Capture And Model Invocation

## Status

Accepted

## Context

Inlinr is adding a selection-scoped edit request flow inside its custom Markdown surface. A natural question is whether the extension should reuse the existing agent chat experience by copying request text into another chat UI, such as GitHub Copilot Chat, and programmatically triggering submission there.

That approach would reduce some apparent UI work, but it would make the core editing workflow depend on another extension's chat surface and on UI automation rather than a stable extension boundary. It would also split ownership of the interaction across three places: Inlinr would own selection and anchoring, another chat UI would own request entry and submission, and the downstream result would need to be reattached to the original document context.

The repository's product and engineering direction favor precise, reviewable, selection-scoped interactions that stay understandable to the user and rely on explicit, supported boundaries.

## Decision

Inlinr owns the primary request-capture flow inside its own document surface.

- The user enters the request into an Inlinr-owned popup anchored near the selection.
- When the user submits, Inlinr creates the selection-scoped request payload itself.
- The primary request-submission path uses supported extension integration points, with the VS Code Language Model API as the default model invocation boundary for downstream provider access.
- Inlinr does not rely on programmatically writing to, pre-filling, or sending from another extension-owned chat input UI as the primary architecture.
- Chat participants, editor chat entrypoints, or other chat-pane integrations may be added later as secondary experiences, but they are not the system of record for the inline editing flow.

## Consequences

- The inline editing experience stays attached to the selected text and remains under Inlinr control.
- Request capture, anchoring, payload construction, and later response handling can evolve behind stable internal contracts.
- The product avoids brittle dependencies on another extension's UI structure or private commands.
- Inlinr must implement and maintain its own request popup, pending state, and downstream request orchestration.
- Follow-up design work is required for submitted and pending inline states after the user clicks the request button.
- Follow-up architecture work is still required to define provider policy, model selection, and failure behavior for the downstream request path.

## Alternatives considered

- Programmatically copy text into another extension's chat textbox and trigger send.
- Use a built-in or third-party chat pane as the primary request-entry surface.
- Capture input with transient VS Code primitives such as `InputBox`, detached from the selected text.

## Related documents

- `product/product-outline.md`
- `architecture/high-level-architecture.md`
- `architecture/adr-001-custom-markdown-editor-surface.md`
- `specs/002-selection-scoped-edit-request/spec.md`