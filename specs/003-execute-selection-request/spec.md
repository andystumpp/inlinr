# Feature Specification: Execute Selection Request

**Feature Branch**: `003-execute-selection-request`  
**Created**: 2026-05-20  
**Status**: Refined  
**Refined**: 2026-05-21 — Clarified consecutive request cycles, broadened selection support to list items and chapters, simplified the request popup, and switched post-submit review to direct inline diff in the document.  
**Input**: User description: "ok let's create the new spec on scope request execution where we execute the request via vs code copilot to actually make the changes to the doc"

## Clarifications

### Session 2026-05-20

- Q: After Copilot generates a scoped edit, how should document mutation work in v1? → A: Show a reviewable suggestion first, then require explicit Apply.
- Q: How should the suggested edit be shown before Apply? → A: Show the proposed revision in place inside the rendered document with a blended inline review state for the selected range.
- Q: What normalized suggestion shape should v1 use before Apply? → A: Use one bounded replacement or deletion extracted from a marker-preserving full-document draft.
- Q: How much Markdown structure may the replacement change inside the selected scope in v1? → A: Allow structural change inside the selected range, but never outside it.
- Q: What should happen if the supported Copilot-backed capability is unavailable in v1? → A: Block execution and show an unavailable message with no fallback.
- Q: What should the execution path return in v1? → A: Return one full Markdown document draft that preserves explicit selection markers.
- Q: Can one selection span multiple rendered blocks in v1? → A: Yes, as long as it remains one contiguous source range in one document.
- Q: What should happen after the user applies or rejects one suggestion and wants to keep editing? → A: The system should let the user immediately start another scoped request in the same editor session against the current document state.
- Q: What document selections should open the request popup in v1? → A: Any non-empty contiguous selection in the document surface should open the request popup, including list items, numbered items, chapters, and multi-chapter selections.
- Q: What should the popup show before submit in v1? → A: Show only the request input field and an "Ask for changes" action; do not repeat the selected text in the popup, and dismiss the popup when the user clicks elsewhere in the document.
- Q: How should review appear after the user submits a request in v1? → A: Do not keep preview content in the popup; instead render the proposed diff directly in the document surface.
- Q: How should deletion work for list items when the visible selection does not include the bullet or number marker? → A: If the request implies removing a list item, the system should remove the entire containing list item line or block and preserve valid surrounding list structure.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Open And Submit Scoped Request (Priority: P1)

A user selects any contiguous range in the rendered Markdown document, including adjacent list items or one or more chapters, opens a lightweight request popup, and submits a scoped request without leaving the document surface.

**Why this priority**: This is the first end-to-end AI execution path. Without executing the request and validating a result back to the targeted range, submit still stops short of useful editing.

**Independent Test**: Can be fully tested by selecting contiguous content such as two bullet items, one numbered-list item, or one or more chapters, opening the popup, submitting a request, and confirming that the user sees pending feedback followed by one validated inline diff for that same targeted range, with no document mutation before explicit apply.

**Acceptance Scenarios**:

1. **Given** the user makes any non-empty contiguous selection in the document surface, **When** the selection is made, **Then** the system opens the request popup for that targeted range, including selections across multiple bullet items, numbered items, sections, or chapters.
2. **Given** the request popup opens, **When** the user views it before submit, **Then** it shows only the request input field and an "Ask for changes" action and does not repeat the selected text.
3. **Given** the request popup is open, **When** the user clicks elsewhere in the document without submitting, **Then** the popup dismisses without requiring a dedicated Cancel button.
4. **Given** a submitted inline request, **When** the system executes it, **Then** it sends the selected Markdown, the user instruction, the durable target anchor, the full current Markdown document content, and explicit selection markers that delimit the targeted range.
5. **Given** the execution completes successfully, **When** the result returns, **Then** the system validates that the returned full-document draft preserves the selection markers and can be mapped back to one bounded proposal for the targeted range before it enters review.
6. **Given** a validated execution result, **When** the review state opens, **Then** the user sees the proposed diff directly in the document surface for the targeted range rather than preview content in the popup or a detached chat response.
7. **Given** one request execution is already pending for the current document, **When** the user attempts to submit another request, **Then** the system prevents overlapping execution for the same editing session until the current request resolves or is dismissed.

---

### User Story 2 - Review And Apply Suggested Edit (Priority: P2)

A user inspects the inline diff for the targeted Markdown range and explicitly chooses to apply or reject it, with document mutation occurring only after the apply action.

**Why this priority**: The product promise is not just model execution. It is reviewable, selection-scoped editing that preserves user control over document changes.

**Independent Test**: Can be fully tested by executing a valid request against a multi-block contiguous range, a list selection, and a chapter-scale selection, receiving an inline diff in the document, and confirming that apply updates only the intended Markdown range while reject leaves the document unchanged.

**Acceptance Scenarios**:

1. **Given** a suggested edit is available for a targeted range, **When** the user reviews it, **Then** the product shows the proposed revision as an inline diff in the document for that selected scope with no duplicate preview kept in the popup.
2. **Given** a suggested edit is available, **When** the user chooses Apply, **Then** the system updates only the intended Markdown range in the canonical document and refreshes the rendered view.
3. **Given** a suggested edit is available, **When** the user chooses Reject, **Then** the document remains unchanged and the suggestion is dismissed without hidden side effects.
4. **Given** a suggested edit is available, **When** the user applies it, **Then** the resulting document may restructure or remove content inside the targeted range but preserves Markdown content outside that range because only the selected range is mutated.
5. **Given** the targeted range falls within a bullet list, numbered list, or similar list structure, **When** the user requests removal of one item, **Then** the applied result removes the full containing list item line or block, including its marker when necessary, and leaves the surrounding list structurally valid.
5. **Given** a suggestion has just been applied or rejected, **When** the user makes another supported selection in the same document session, **Then** the system allows a new scoped request cycle to start against the current document state without requiring the editor to reload or the document to reopen.
6. **Given** a prior suggestion changed the document, **When** the user submits a follow-up request on the updated content, **Then** the system captures a fresh target anchor and reviews the new suggestion independently of the previous proposal state.

---

### User Story 3 - Fail Safely On Execution Or Apply Mismatch (Priority: P3)

A user gets a clear recovery path when request execution fails, when the returned draft cannot be mapped safely back to the selected scope, or when the target drifts before apply.

**Why this priority**: Model execution adds a new trust boundary. The system must fail closed rather than silently applying the wrong text or accepting malformed output.

**Independent Test**: Can be fully tested by forcing provider failure, missing-marker or unextractable full-document drafts, or document drift before apply, and confirming that the system blocks mutation and presents a clear retry or reselect path.

**Acceptance Scenarios**:

1. **Given** request execution fails or times out, **When** the execution completes unsuccessfully, **Then** the system shows a clear failure state and leaves the document unchanged.
2. **Given** the returned full-document draft removes or duplicates selection markers, or otherwise cannot be mapped safely back to the intended selection, **When** the system validates the result, **Then** it blocks review and apply and asks the user to retry or reselect.
3. **Given** the returned full-document draft also changes content outside the selected range, **When** the system can still extract the marked selected range safely, **Then** it ignores those out-of-range draft changes and keeps only the bounded selected-range proposal for review and apply.
4. **Given** the document changes after execution begins or after a suggestion is returned, **When** the user attempts to apply the suggestion, **Then** the system revalidates the target and either reattaches confidently or blocks apply with a clear recovery message.
5. **Given** the execution path is unavailable because the required Copilot-backed capability cannot run in the current environment, **When** the user submits a request, **Then** the system shows a clear unavailable-state message and does not mutate the document.

---

### Edge Cases

- What happens when the Copilot-backed execution path is unavailable because the user is not signed in, not entitled, or the capability is disabled in the current VS Code environment?
- What happens when the returned full-document draft is empty, malformed, removes the selection markers, duplicates the selection markers, or cannot be mapped back to the targeted selection?
- What happens when the user edits the document or changes the active selection while execution is still pending?
- What happens when the returned suggestion changes Markdown structure inside the targeted scope in a way that is desirable, such as summarizing two bullets into one paragraph?
- What happens when one contiguous selection spans multiple adjacent rendered blocks, such as two bullets or two paragraphs?
- What happens when a user selects list item text but not the bullet or number marker and asks to remove that item?
- What happens when a user selects one full chapter or multiple chapters and asks for feedback?
- What happens when the user selects any visible document content that was previously not opening the request popup?
- What happens when the user retries the same request after a provider error, timeout, rejected suggestion, or a valid deletion proposal?
- What happens when the user applies one suggestion and immediately submits a second scoped request on the updated content in the same editor session?
- What happens when stale review state from the first request could interfere with a follow-up request after apply or reject?

## Scope & Boundaries *(mandatory)*

- **Selection Scope**: This feature acts on one submitted inline request for one contiguous rendered-Markdown range in one open Markdown document. The selected range may span multiple adjacent blocks, list items, sections, or chapters, but disjoint multi-range selection remains out of scope.
- **Popup Model**: On selection, the popup is only a lightweight request-entry surface. It should not repeat the selected text, and it should dismiss when the user clicks elsewhere in the document.
- **Review Model**: The user submits a scoped request, sees pending execution feedback, receives one full-document draft from the model, and then reviews an inline diff in the document that is extracted from the marked selected range only after host-side mapping succeeds. Successful execution in v1 MUST NOT auto-apply document changes.
- **Context Exposure**: On explicit submit, the system sends the user request, the targeted Markdown range, its durable anchor, the full current Markdown document content, and explicit selection markers for scoped suggestion generation.
- **Out of Scope**: Multi-file edits, disjoint multi-range selection, hidden or automatic apply without review, background autonomous editing loops, unsupported chat UI automation, direct whole-document apply from returned model drafts, persisted request history, and provider-specific chat-pane UX as the system of record.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST execute a submitted selection-scoped request through the configured Copilot-backed model execution path supported by VS Code integration boundaries.
- **FR-002**: The system MUST start execution only after explicit user submit from an accepted inline request session.
- **FR-002a**: The system MUST open the request popup for any non-empty contiguous user selection made in the document surface, including selections inside list items and selections spanning one or more chapters.
- **FR-003**: The system MUST show visible pending-state feedback for a submitted request while execution is in progress.
- **FR-004**: The system MUST keep the targeted selection range visible while execution and review are in progress.
- **FR-004a**: The request popup MUST show only request-entry controls before submit and MUST NOT repeat the currently selected text.
- **FR-004b**: The request popup MUST dismiss when the user clicks elsewhere in the document without submitting.
- **FR-005**: The system MUST send the selected Markdown, the user instruction, the durable anchor, the full current Markdown document content, and explicit selection markers that delimit the targeted range for scoped suggestion generation.
- **FR-006**: The system MUST NOT route the primary execution path by programmatically writing to or sending from another extension-owned chat input UI.
- **FR-006a**: The system MUST request one full Markdown document draft or equivalent document-complete representation from the execution path and MUST require the returned draft to preserve the explicit selection markers.
- **FR-007**: The system MUST normalize returned model output into one predictable suggested-edit shape before the review and apply flow consumes it.
- **FR-007a**: The v1 normalized suggested-edit shape MUST be one bounded replacement or deletion extracted from a marker-preserving full-document draft for the targeted Markdown range.
- **FR-007b**: The normalized suggested-edit shape MAY contain an empty replacement to represent deleting the targeted range.
- **FR-008**: The system MUST block malformed, marker-missing, marker-duplicated, or otherwise unextractable execution results from entering the review or apply flow.
- **FR-009**: The system MUST present the returned suggestion as an inline diff attached to the targeted selection inside the document experience.
- **FR-009a**: Once the request is submitted, the popup MUST NOT remain the primary preview surface for the returned suggestion.
- **FR-010**: The system MUST require an explicit Apply action before mutating the Markdown document.
- **FR-011**: The system MUST allow the user to reject a suggested edit without changing the document.
- **FR-012**: The system MUST update only the intended Markdown range when the user applies a suggested edit.
- **FR-013**: The system MUST allow structural changes or deletion inside the targeted range when they are part of the requested transformation, but MUST preserve Markdown content outside the targeted range in the final applied document.
- **FR-013a**: When the user requests removal of content inside a list item and the selected text does not include the list marker, the system MUST still remove the full containing list item line or block if that is the intended scoped change.
- **FR-013b**: When applying list-item removal, the system MUST preserve valid surrounding list structure, numbering, and spacing.
- **FR-014**: The system MUST revalidate the target anchor before applying a suggested edit and MUST block apply if the intended scope has become ambiguous.
- **FR-014a**: The system MUST derive the reviewable proposal only from the content between preserved selection markers in the returned full-document draft.
- **FR-014b**: The system MUST ignore out-of-range differences elsewhere in the returned full-document draft instead of applying or surfacing them as document changes.
- **FR-015**: The system MUST show a clear retry, reject, or reselect recovery path when execution fails or when the returned suggestion cannot be trusted for the selected scope.
- **FR-015a**: If the supported Copilot-backed capability is unavailable in the current environment, the system MUST block execution, show a clear unavailable-state message, and MUST NOT fall back automatically to another provider or placeholder execution mode in v1.
- **FR-016**: The system MUST allow only one active execution or review flow per request session in v1.
- **FR-016a**: Once a request cycle ends through apply, reject, failure recovery, or explicit dismissal, the system MUST clear obsolete request-review state so a new scoped request can begin in the same editor session.
- **FR-017**: The system MUST leave the document unchanged when execution fails, when the user rejects the suggestion, or when apply is blocked by validation.
- **FR-018**: The system MUST record enough local execution and apply state to keep the request, returned full-document draft, derived suggestion, and target scope attached during pending, review, and apply transitions.
- **FR-019**: The system MUST support iterative retry or refinement after a failed or rejected execution without requiring the user to leave the document surface.
- **FR-019a**: The system MUST support consecutive scoped request cycles after a successful apply by rebuilding selection capture, anchor state, and review state from the current document without requiring an editor reload.
- **FR-019b**: The system MUST ensure that proposal identifiers, viewer state, and apply/reject controls from a completed request do not block or contaminate a subsequent request cycle.
- **FR-020**: The system MUST keep the end-to-end flow scoped to Markdown documents and one contiguous selection-based editing range in v1.

### Key Entities *(include if feature involves data)*

- **Executed Request**: A submitted inline request that has moved from local draft state into one active model-execution flow for a targeted Markdown range.
- **Validated Document Draft**: The full-document draft returned by the execution path after host-side validation confirms that selection markers are preserved and that the selected range can be extracted safely.
- **Suggested Edit Proposal**: The normalized, reviewable candidate change extracted from a validated document draft for the targeted selection before any apply action occurs.
- **Effective Selection Scope**: The host-resolved mutation scope used for execution and apply. This may expand from the visible text selection to the containing list item when that is required to remove one list entry cleanly.
- **Apply Decision**: The explicit user choice to apply or reject the suggested edit.
- **Execution Session**: The combined pending, review, and recovery state that keeps one executed request attached to one target selection through result handling and possible apply.
- **Document Mutation**: The bounded update to the canonical Markdown document that occurs only after explicit apply and successful target revalidation.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: In acceptance testing, at least 90% of valid submitted requests show visible pending feedback within 1 second of submit.
- **SC-002**: In acceptance testing, at least 90% of sampled successful executions return one validated reviewable suggestion without requiring the user to leave the document surface.
- **SC-003**: In acceptance testing, 100% of sampled applied suggestions mutate only the intended targeted Markdown range or fail clearly before mutation.
- **SC-004**: In failure-path testing, 100% of malformed, marker-missing, marker-duplicated, ambiguous, or unextractable execution results are blocked from review/apply and surface a clear recovery path.
- **SC-005**: In usability testing, at least 85% of users can complete the full flow from selection to reviewed apply on their first attempt without switching to a separate chat tool.
- **SC-006**: In consecutive-use acceptance testing, at least 90% of sampled two-step editing flows can complete two scoped request cycles back to back in the same open editor session, including one follow-up request after a successful apply, without requiring a reload or manual state reset.
- **SC-007**: In acceptance testing, at least 95% of sampled non-empty contiguous selections in the document surface open the request popup, including bullet lists, numbered lists, and chapter-scale selections.
- **SC-008**: In list-edit acceptance testing, 100% of sampled remove-item requests delete the full intended list item and leave the surrounding list structurally valid even when the user's visible selection omitted the bullet or number marker.

## Assumptions

- The user has access to the supported Copilot-backed execution capability inside their VS Code environment.
- The selection-scoped request capture flow from feature `002-selection-scoped-edit-request` remains the upstream entry point for this slice.
- The default safety model remains review-before-apply rather than hidden or automatic document mutation.
- The execution path can return one full-document draft that preserves explicit selection markers for the targeted range.
- The returned model output can be normalized into one scoped suggested-edit proposal or deletion for the targeted selection in v1 even when unrelated out-of-range draft changes are ignored.
- The feature remains limited to one Markdown document and one contiguous selection range at a time in v1, though that range may span multiple adjacent blocks.
- Sending and receiving the full current Markdown document content is acceptable for the early execution slice to improve scoped suggestion quality.
- Multi-provider routing, provider fallback policy, and persisted execution history can be added later if required by future specs.
