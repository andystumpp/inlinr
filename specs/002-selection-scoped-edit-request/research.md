# Research: Selection-Scoped Edit Request

## Decision 1: Capture rendered selection in the webview, but keep validation and active draft authority in the extension host

- Decision: Let the webview observe DOM selection and request-popup interactions, but treat the extension host as the authority for supported-selection checks, one-draft enforcement, anchor validation, and submit eligibility.
- Rationale: The browser DOM is the only place where rendered text selection exists, but the canonical Markdown document and session lifecycle live in the extension host. Keeping trust decisions in the extension host preserves a clear boundary and matches the existing custom editor architecture.
- Alternatives considered: Making the webview authoritative for selection validity was simpler but would duplicate trust-sensitive logic away from the canonical document model. Falling back to source-editor selection or detached VS Code input controls would violate the feature spec's rendered-selection-first interaction.

## Decision 2: Use a hybrid durable anchor for v1

- Decision: Represent the targeted scope as a source-backed range plus the selected text and a short prefix and suffix quote captured from nearby Markdown context.
- Rationale: A DOM range alone is unstable across rerenders, while a raw source range alone becomes fragile after document edits. A hybrid anchor provides a cheap re-find path after small document changes and supports the spec's requirement to fail clearly when the intended range becomes ambiguous.
- Alternatives considered: Persisting DOM node paths was rejected because render structure can change independently of source intent. Selected-text-only fuzzy matching was too error-prone. A full Markdown AST path was more precise but unnecessary for this slice.

## Decision 3: Introduce source-backed render metadata only for explicitly supported prose regions

- Decision: Extend the Markdown render pipeline to emit source-backed metadata for supported prose blocks and inline text spans, and treat all unsupported structures as non-selectable in v1.
- Rationale: The current renderer produces HTML only, so reliable source mapping requires render metadata. Limiting the first version to an explicit allowlist of supported prose regions keeps the feature small and avoids silent mis-targeting across headings, list transitions, code fences, images, or unsupported HTML.
- Alternatives considered: Attempting full-document source mapping from day one would add unnecessary complexity. Guessing across unsupported regions would undermine trust and violate the fail-safe requirements.

## Decision 4: Define a schema-first local request payload separate from viewer state and provider request shapes

- Decision: Create a local selection-scoped request payload contract that includes request text, document identity, capture-time document version, selected source text, durable anchor, and a small adjacent Markdown context window.
- Rationale: The repo's contract rules require separate UI, domain, and provider models. A schema-first local payload keeps the current feature focused on safe request creation and prevents provider-specific details from leaking into the popup or viewer state.
- Alternatives considered: Passing raw webview state into later provider code would blur boundaries. Including the full enclosing section or whole document by default would violate the product's data-minimization goals.

## Decision 5: Hide downstream model invocation behind a thin request service boundary

- Decision: Submit the local request payload to an Inlinr-owned request service in the extension host, with the VS Code Language Model API as the default downstream invocation boundary but without implementing full provider response UX in this slice.
- Rationale: ADR 002 explicitly rules out another extension's chat UI as the primary flow and keeps request submission inside Inlinr. A thin service boundary lets feature 002 stop at validated submit orchestration while preserving a stable seam for later provider policies, retries, and suggestion normalization.
- Alternatives considered: Calling the language model API directly from the custom editor provider would couple UI and provider logic too tightly. Building a multi-provider settings surface now would widen scope without helping the current request-capture milestone.

## Decision 6: Test primarily at the unit and extension-integration layers, with one explicit manual rendered-selection check

- Decision: Cover anchor creation, anchor revalidation, supported-selection rules, request payload construction, and message handling with unit and VS Code integration tests, and keep one manual verification path for real DOM selection and popup placement inside the webview.
- Rationale: The current test setup already favors extension-host integration and mock webview panels, which are well suited to contract and controller checks. Real rendered-selection gestures are harder to automate reliably in the current harness, so a targeted manual check is the cheapest trustworthy complement.
- Alternatives considered: Browser-style end-to-end selection automation would add a new test harness before the product needs it. Manual-only testing would leave the trust-sensitive anchor and payload behavior under-specified and regression-prone.