# Data Model: Selection-Scoped Edit Request

## RenderedSelectionCandidate

- Purpose: Represents the raw selection captured in the rendered webview before the extension host accepts it as a valid target.
- Source: Actual webview DOM selection resolved against source-backed render metadata emitted into the rendered DOM.
- Fields:
  - `documentUri`: Markdown document URI.
  - `documentVersion`: Rendered document version at capture time.
  - `selectedText`: Visible selected text as captured in the webview.
  - `renderedRegionIds`: Supported rendered regions touched by the selection.
  - `startMarker`: Source-backed marker for the rendered start boundary.
  - `endMarker`: Source-backed marker for the rendered end boundary.
- Validation rules:
  - Must be non-empty and not whitespace-only.
  - Must stay within supported prose regions.
  - Must not cross structural containers or unsupported rendered regions in v1.
  - Must be derived from the user's actual rendered DOM range rather than from a heuristic fallback region.
  - Must be revalidated against the canonical `TextDocument` before becoming an active request session.

## InlineRequestOverlayState

- Purpose: Represents the transient, webview-owned inline request overlay that is anchored to the live rendered selection.
- Source: Webview controller state derived from the accepted selection plus local draft entry.
- Fields:
  - `sessionId`: Identifier for the currently accepted request session.
  - `documentVersion`: Document version the overlay was opened against.
  - `selectedTextPreview`: Visible text preview shown in the popup.
  - `selectionRect`: Viewport-relative selection bounds or equivalent placement hints used only for UI.
  - `draftText`: Current request text entered in the popup.
  - `uiState`: `drafting | invalid | submitting | submitted`.
  - `message`: Optional user-facing status or recovery text.
- Validation rules:
  - Exists only inside the webview and is not canonical source-of-truth for targeting.
  - May be repositioned on scroll, resize, or selection changes without creating a new host-side session.
  - Must be recreated from host-side session state if the document is rerendered for structural reasons.

## SupportedSelectionRegion

- Purpose: Declares a rendered Markdown region that Inlinr allows for v1 selection capture and source mapping.
- Source: Render pipeline metadata produced during Markdown rendering.
- Fields:
  - `regionId`: Stable identifier for the rendered region within one document version.
  - `documentUri`: Markdown document URI.
  - `documentVersion`: Source version used to generate the region.
  - `kind`: `paragraph | blockquote | table-cell | list-item-prose | inline-span`.
  - `sourceRange`: Canonical Markdown range backing the region.
  - `selectable`: Whether the region is eligible for v1 selection capture.
- Validation rules:
  - Must refer to one source-backed prose region.
  - Must be regenerated whenever the document version changes.
  - Unsupported containers must be omitted or marked non-selectable.

## SelectionAnchor

- Purpose: Durable representation of the intended target range that can be re-found after minor document changes.
- Fields:
  - `documentUri`: Markdown document URI.
  - `capturedDocumentVersion`: Document version when the selection was accepted.
  - `sourceRange`: Canonical source-backed target range.
  - `selectedText`: Source text captured for the intended target.
  - `prefixQuote`: Short Markdown text immediately preceding the target.
  - `suffixQuote`: Short Markdown text immediately following the target.
  - `strategyVersion`: Anchor schema version used for revalidation.
- Validation rules:
  - `selectedText` must match the canonical source range at capture time.
  - Quote windows must stay bounded to minimum necessary context.
  - Revalidation must fail clearly if the target cannot be re-found with high confidence.

## EditRequestDraft

- Purpose: User-authored change request tied to one validated target selection before explicit submit.
- Fields:
  - `draftId`: In-memory identifier for the request draft.
  - `documentUri`: Markdown document URI.
  - `selectionAnchor`: Durable anchor for the target range.
  - `requestText`: User-entered request text.
  - `createdAt`: Timestamp for draft creation.
  - `updatedAt`: Timestamp for latest draft edit.
- Validation rules:
  - May exist only while one active request session is open.
  - `requestText` must be non-empty before submit.
  - Must remain attached to exactly one `SelectionAnchor`.
  - In the preferred architecture for this feature, draft entry is webview-owned until explicit submit and is not required to trigger host-side rerendering on every keystroke.

## ActiveRequestSession

- Purpose: Tracks the single host-authoritative validated request target allowed in v1 for one document and one targeted selection.
- Fields:
  - `sessionId`: Unique in-memory identifier.
  - `documentUri`: Markdown document URI.
  - `selection`: Accepted `RenderedSelectionCandidate` normalized to source-backed coordinates.
  - `selectionAnchor`: Durable anchor for submit-time revalidation.
  - `state`: `drafting | invalid | submitting | submitted | closed`.
  - `validationMessage`: Optional user-facing explanation when submission is blocked.
- Validation rules:
  - Only one `ActiveRequestSession` may exist per extension at a time in v1.
  - `submitting` requires a non-empty draft and a valid revalidated anchor.
  - `invalid` must block downstream request submission.
  - Host-side session state should keep only durable targeting and submit eligibility, not transient overlay coordinates.

## SelectionScopedRequestPayload

- Purpose: The structured local payload created on explicit user submit and handed to the Inlinr request service.
- Fields:
  - `requestId`: Unique request identifier.
  - `documentUri`: Markdown document URI.
  - `documentVersion`: Latest validated version used for submission.
  - `requestText`: User-authored instruction.
  - `selectedMarkdown`: Canonical selected source text.
  - `selectionAnchor`: Durable anchor used to validate the target.
  - `surroundingContext`: Minimal adjacent Markdown context with `prefixMarkdown` and `suffixMarkdown`.
  - `createdAt`: Timestamp of submit.
- Validation rules:
  - Must be created only after explicit user submit.
  - Must not include the full document or full enclosing section by default.
  - Must remain provider-agnostic and separate from any later model-request shape.

## Relationships

- One `MarkdownDocument` version produces many `SupportedSelectionRegion` records.
- One accepted `RenderedSelectionCandidate` resolves to exactly one `SelectionAnchor`.
- One `ActiveRequestSession` may be paired with one active `EditRequestDraft` in the webview and may produce at most one `SelectionScopedRequestPayload`.
- One `SelectionScopedRequestPayload` is derived from one `SelectionAnchor` and one explicit user submit action.

## State Transitions

### ActiveRequestSession

- `drafting -> invalid`: The document changes or the target can no longer be revalidated safely.
- `invalid -> closed`: The user dismisses the popup or reselects.
- `drafting -> submitting`: The user clicks submit and the anchor revalidation succeeds.
- `submitting -> submitted`: The local request payload is created and handed to the request service.
- `submitting -> invalid`: Revalidation fails during submit and the user is asked to reselect.
- `drafting -> closed`: The user cancels the popup.
- `submitted -> closed`: The local handoff finishes and the popup session ends or transitions to a later feature state.

### SelectionAnchor Revalidation

- `captured -> resolved`: The original source range still matches confidently.
- `captured -> refound`: The original range moved, but the selected text plus quote context re-identify the intended target confidently.
- `captured -> ambiguous`: Multiple matches or structural drift prevent a safe target.
- `captured -> missing`: The target can no longer be found.