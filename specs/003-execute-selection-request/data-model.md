# Data Model: Execute Selection Request

## ExecutedRequest

- Purpose: Represents a submitted inline request that has moved from lightweight request-entry state into one active model-execution flow for a targeted Markdown selection.
- Source: Created by the extension host after `request.submit` succeeds and the request payload is accepted for execution.
- Fields:
  - `requestId`: Unique identifier for the executed request.
  - `sessionId`: Active request session identifier.
  - `documentUri`: Markdown document URI.
  - `documentVersion`: Canonical document version at execution start.
  - `requestText`: User-authored instruction.
  - `selectedMarkdown`: Canonical Markdown text for the targeted execution scope.
  - `selectionAnchor`: Durable anchor used for drift-safe revalidation.
  - `effectiveSelectionScope`: Host-resolved scope metadata for the submitted request.
  - `documentMarkdown`: Full current Markdown document content at submit time.
  - `submittedAt`: Timestamp when execution started.
  - `executionState`: `executing | failed | unavailable | completed`.
- Validation rules:
  - Must be created only after explicit user submit.
  - Must remain tied to exactly one `SelectionAnchor` and one open Markdown document.
  - `selectedMarkdown` may expand from the user's visible text selection to the containing list item when needed to remove one list entry cleanly.
  - Must include the full current Markdown document because full-document draft generation is the execution mode for this slice.

## EffectiveSelectionScope

- Purpose: Represents the host-resolved mutation scope used for execution, review, and apply.
- Source: Produced when the host maps the user's visible contiguous selection into the effective scoped Markdown range.
- Fields:
  - `scopeKind`: `exact-selection | containing-list-item`.
  - `visibleSelectionStart`: Source offset of the user's visible text selection start.
  - `visibleSelectionEnd`: Source offset of the user's visible text selection end.
  - `effectiveSourceStart`: Source offset of the effective scoped mutation start.
  - `effectiveSourceEnd`: Source offset of the effective scoped mutation end.
  - `selectedRegionIds`: Rendered region identifiers covered by the visible selection.
- Validation rules:
  - The visible selection must be non-empty and contiguous in one document.
  - `scopeKind = containing-list-item` is allowed only when expanding to the containing list item is required to preserve valid list structure for the requested scoped change.
  - The effective scope must remain one contiguous range in one document.

## ValidatedDocumentDraft

- Purpose: Represents the full-document draft returned by the model after host-side validation confirms the draft preserves selection markers and that the selected range can be extracted safely.
- Source: Produced by execution-result validation in the extension host before the review state opens.
- Fields:
  - `requestId`: Identifier for the originating `ExecutedRequest`.
  - `documentUri`: Markdown document URI.
  - `baseDocumentVersion`: Canonical document version at validation time.
  - `draftDocumentMarkdown`: Full returned Markdown document draft.
  - `replacementMarkdown`: Extracted replacement text for the targeted range.
  - `selectionMarkerId`: Marker identifier preserved through execution.
  - `validatedAt`: Timestamp when the draft passed validation.
- Validation rules:
  - Selection markers must remain present and resolvable.
  - `replacementMarkdown` may be empty to represent deleting the targeted range.
  - Out-of-range differences elsewhere in the draft are ignored because only the extracted selected-range proposal is consumed.
  - A draft that removes, duplicates, or corrupts the selection markers must not enter review.

## SuggestedEditProposal

- Purpose: Represents the normalized, reviewable candidate change returned for one targeted Markdown selection before apply and rendered as an inline diff in the document surface.
- Source: Produced by the execution service and suggestion normalizer in the extension host.
- Fields:
  - `proposalId`: Unique identifier for the normalized suggestion.
  - `requestId`: Identifier of the `ExecutedRequest` that produced the proposal.
  - `documentUri`: Markdown document URI.
  - `baseDocumentVersion`: Document version used when the proposal was normalized.
  - `selectionAnchor`: Anchor snapshot used for review and apply-time revalidation.
  - `effectiveSelectionScope`: Host-resolved scope metadata used for execution and apply.
  - `validatedDraft`: The `ValidatedDocumentDraft` from which the proposal was extracted.
  - `replacementMarkdown`: Full replacement text for the targeted Markdown range, which may be empty for deletion.
  - `previewMode`: `blended-inline`.
  - `createdAt`: Timestamp when normalization completed.
- Validation rules:
  - `replacementMarkdown` may be empty to represent deletion.
  - The proposal must target exactly one anchored range.
  - The proposal may resolve to the containing list item when list-item removal requires widening from the visible text selection to preserve valid list structure.
  - The proposal may restructure or delete content inside the targeted range.
  - The proposal is derived only from the content between preserved selection markers in the returned draft.

## ExecutionSession

- Purpose: Tracks the combined request-entry, pending, review, failure, unavailable, and apply lifecycle for one active execution attached to one selection.
- Source: Host-authoritative session state stored by `DocumentSessionController`.
- Fields:
  - `sessionId`: Unique in-memory identifier.
  - `documentUri`: Markdown document URI.
  - `documentVersion`: Latest known document version for the session.
  - `selectedTextPreview`: Captured text for the targeted visible selection; stored for anchoring and continuity but not repeated in the request-entry popup.
  - `selectedRegionIds`: Rendered region identifiers used for scope highlighting.
  - `draftText`: Latest request text associated with the session.
  - `selectionAnchor`: Durable anchor for the targeted range.
  - `effectiveSelectionScope`: Host-resolved scope metadata for the selection.
  - `executionState`: `drafting | executing | review | failed | unavailable | applying | applied | invalid`.
  - `validationMessage`: Optional user-facing status or recovery text.
  - `executedRequest`: Optional `ExecutedRequest` once submit begins.
  - `validatedDraft`: Optional `ValidatedDocumentDraft` once full-document validation succeeds.
  - `suggestedEdit`: Optional `SuggestedEditProposal` once normalization succeeds.
- Validation rules:
  - Only one `ExecutionSession` may be active at a time in v1.
  - `drafting` represents the lightweight request-entry popup state, not a preview surface for the returned suggestion.
  - `review` requires a valid `SuggestedEditProposal`.
  - `applying` requires a valid proposal plus a successful apply-time anchor revalidation.
  - `invalid`, `failed`, and `unavailable` must block mutation.

## ExecutionCapabilityState

- Purpose: Captures whether the supported Copilot-backed execution capability can run in the current environment.
- Source: Host-side preflight and runtime checks before model invocation.
- Fields:
  - `status`: `available | unavailable`.
  - `reasonCode`: `missing-capability | access-denied | not-signed-in | quota-exceeded | execution-error`.
  - `message`: User-facing explanation.
  - `checkedAt`: Timestamp of latest availability check.
- Validation rules:
  - `status = unavailable` must block execution.
  - The unavailable path must not trigger automatic fallback to another provider or placeholder mode in v1.

## ApplyDecision

- Purpose: Represents the explicit user choice to apply or reject a normalized suggestion shown as an inline diff in the document.
- Source: Webview review UI action validated by the extension host.
- Fields:
  - `proposalId`: Target proposal identifier.
  - `sessionId`: Current execution session identifier.
  - `decision`: `apply | reject`.
  - `decidedAt`: Timestamp of the explicit user decision.
- Validation rules:
  - Must reference the currently active proposal for the session.
  - `apply` must revalidate the anchor before mutation.
  - `reject` must leave the document unchanged.

## DocumentMutation

- Purpose: Represents the bounded update to the canonical Markdown document after an explicit apply.
- Source: Produced by the edit-application service after successful anchor revalidation.
- Fields:
  - `documentUri`: Markdown document URI.
  - `sourceStart`: Revalidated source start offset.
  - `sourceEnd`: Revalidated source end offset.
  - `effectiveSelectionScope`: The effective scoped mutation that was applied.
  - `replacementMarkdown`: Replacement text from the accepted proposal.
  - `appliedAt`: Timestamp when the edit was applied.
- Validation rules:
  - Must target exactly one revalidated range in one open document.
  - Must not mutate text outside the revalidated effective scope.
  - May restructure content inside the targeted range or the containing list item selected as the effective scope, but must not mutate content outside it.

## Relationships

- One `ExecutionSession` may produce at most one active `EffectiveSelectionScope`, one active `ExecutedRequest`, one active `ValidatedDocumentDraft`, and one active `SuggestedEditProposal` at a time.
- One `ExecutedRequest` resolves to zero or one `ValidatedDocumentDraft`.
- One `ValidatedDocumentDraft` resolves to zero or one `SuggestedEditProposal`.
- One `SuggestedEditProposal` may receive exactly one terminal `ApplyDecision` in v1.
- One `ApplyDecision` with `decision = apply` may produce one `DocumentMutation`.
- One `ExecutionCapabilityState` influences whether an `ExecutedRequest` can be created at all.

## State Transitions

### ExecutionSession

- `drafting -> executing`: The user submits a non-empty request and capability preflight passes.
- `drafting -> cleared`: The user clicks away or otherwise dismisses the lightweight request-entry popup before submit.
- `drafting -> unavailable`: Capability preflight fails before execution begins.
- `executing -> review`: Model execution succeeds, full-document validation passes, and normalization returns a valid inline-diff proposal.
- `executing -> failed`: Execution, draft validation, or normalization fails.
- `executing -> unavailable`: Runtime capability loss or access failure prevents completion.
- `review -> applying`: The user explicitly chooses Apply and apply-time revalidation begins.
- `review -> drafting`: The user rejects the proposal but keeps the request in the document surface for refinement.
- `review -> invalid`: Apply-time revalidation or proposal validation fails.
- `applying -> applied`: The bounded document mutation succeeds.
- `applying -> invalid`: Anchor drift or mutation validation failure blocks the change.
- `failed -> drafting`: The user retries or refines the request without leaving the document surface.
- `unavailable -> drafting`: Capability becomes available later and the user retries.
- `applied -> drafting`: The document refreshes and the session returns to normal editor state.

### SuggestedEditProposal

- `created -> reviewable`: The replacement or deletion is extracted from a marker-preserving full-document draft and passes review-entry validation.
- `created -> invalid`: The full-document draft removed, duplicated, or corrupted the selection markers or could not be mapped safely back to the target range.
- `reviewable -> applied`: The user applies the proposal and the edit is accepted.
- `reviewable -> rejected`: The user rejects the proposal.
- `reviewable -> invalid`: Anchor drift or document change prevents safe application.