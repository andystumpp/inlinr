# Feature Specification: Selection-Scoped Edit Request

**Feature Branch**: `002-selection-scoped-edit-request`  
**Created**: 2026-05-19  
**Status**: Draft  
**Input**: User description: "Create the next feature spec for a selection-scoped edit request in rendered Markdown. Users can freely select any contiguous range, from smaller-than-paragraph spans up through section-sized ranges, and invoke an inline request. Block targeting may exist as a convenience, but free selection is the primary interaction model. The user selects in rendered Markdown for sure."

## Clarifications

### Session 2026-05-19

- Q: What rendered-selection boundaries should v1 allow? → A: Allow free contiguous selection across adjacent prose blocks, but block selections that cross structural containers or unsupported rendered regions.
- Q: What should happen immediately after a valid rendered selection is made? → A: Show one anchored inline request popup after selection, with a text box whose placeholder says "Ask for changes" and a submit button.
- Q: How many active request composers or drafts should v1 allow at once? → A: Allow only one active request composer or draft at a time in v1; opening a new one requires canceling or finishing the current draft.
- Q: Where should the request UI appear? → A: Show the request popup anchored near the rendered selection in the document surface.
- Q: How much surrounding document context should be included on submit? → A: Include the exact selected text plus a small amount of adjacent surrounding Markdown context.
- Q: What architectural path should the primary submit flow use? → A: Keep the request flow inside Inlinr and hand the payload to an Inlinr-owned request service rather than routing through another extension-owned chat textbox.
- Q: Where should transient popup interaction state live? → A: Keep the inline popup as webview-owned UI near the live selection, while the extension host remains authoritative for source-backed validation and submit-time payload creation.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Start An Inline Request From Rendered Selection (Priority: P1)

A user selects a specific span of rendered Markdown text and immediately sees one anchored inline request popup near that selection in the document surface, with a request text box and submit control, without leaving the document surface.

**Why this priority**: This is the first real editing interaction the product promises. Without precise rendered-text selection and inline request entry, the product is still only a viewer.

**Independent Test**: Can be fully tested by selecting a non-empty contiguous range in rendered Markdown and confirming that one anchored request popup appears for that exact selection, with a text box labeled by placeholder text `Ask for changes` and a submit button, with no provider call or document mutation until the user submits.

**Acceptance Scenarios**:

1. **Given** a Markdown document is open in the Inlinr surface, **When** the user selects a non-empty contiguous span in rendered Markdown, **Then** an anchored request popup appears for that exact selection.
2. **Given** the user selects text smaller than a full paragraph, **When** the request popup appears, **Then** the product preserves the exact selected scope rather than expanding automatically to the full block.
3. **Given** a request popup is already open for one selection, **When** the user tries to open another request popup for a different selection, **Then** the system requires the current draft to be canceled or finished before opening the next one.
4. **Given** a valid rendered selection is present, **When** the request popup appears, **Then** it is anchored near the selected text inside the document surface rather than shown only in a global toolbar or sidebar.
5. **Given** the request popup is shown, **When** the user views it, **Then** it contains a text box with placeholder text `Ask for changes` and a submit button.

---

### User Story 2 - Support Section-Sized Contiguous Prose Selections (Priority: P2)

A user selects a larger contiguous range that crosses multiple adjacent rendered Markdown prose blocks within one document section and creates one scoped request for that larger range.

**Why this priority**: The product must support both very small and larger structured revision scopes so users can refine a phrase or rewrite a section without changing mental models.

**Independent Test**: Can be fully tested by selecting a range that starts in one rendered prose block and ends in another adjacent rendered prose block, invoking Inlinr, and confirming that the request remains one contiguous targeted range.

**Acceptance Scenarios**:

1. **Given** a user selects from the beginning or middle of one rendered Markdown prose block through the end or middle of another adjacent prose block, **When** they invoke Inlinr, **Then** the product creates one selection-scoped request for that full contiguous range.
2. **Given** a rendered selection spans multiple adjacent prose blocks in a single document, **When** the request composer opens, **Then** the product clearly indicates the full targeted range and does not split it into multiple unrelated requests.

---

### User Story 3 - Fail Safely When Selection Mapping Becomes Ambiguous (Priority: P3)

A user sees a clear recovery path when the rendered selection cannot be mapped confidently back to canonical Markdown source or when the targeted range drifts before the request is submitted.

**Why this priority**: Trust depends on never silently targeting the wrong text. Safe failure is more important than forcing a request through with uncertain scope.

**Independent Test**: Can be fully tested by capturing a selection, causing the underlying document or rendered mapping to become ambiguous, and confirming that the system blocks submission and asks the user to reselect instead of guessing.

**Acceptance Scenarios**:

1. **Given** a rendered selection no longer maps cleanly back to one canonical source range, **When** the user tries to continue with the request, **Then** the system shows a clear reselect message and does not submit a request.
2. **Given** the document changes after a selection-scoped request is opened, **When** the anchor can still be resolved confidently, **Then** the request remains attached to the intended range; otherwise the user is asked to reselect.
3. **Given** the user creates a new valid selection while a request draft is already open, **When** they attempt to start another request, **Then** the system must preserve the existing draft until the user explicitly cancels it or finishes it.

---

### Edge Cases

- What happens when the user selects rendered text that includes inline formatting boundaries, links, emphasis, or code spans whose visible text differs from the underlying Markdown source?
- What happens when the user selects a range that includes non-text rendered content such as images, embedded HTML, or unsupported rendered structures?
- What happens when the user creates an empty, collapsed, or whitespace-only selection and invokes Inlinr?
- What happens when the selected rendered range crosses multiple adjacent prose blocks but also includes a structural boundary such as a heading, list transition, or code fence?
- What happens when the user scrolls, changes selection, or edits the document while a request composer for an earlier selection is still open?

## Scope & Boundaries *(mandatory)*

- **Selection Scope**: This feature acts on one user-created, contiguous rendered-Markdown selection inside a single open Markdown document. The selection may be smaller than a paragraph or may span multiple adjacent prose blocks, but it remains one contiguous range and may not cross unsupported structural containers in v1.
- **Review Model**: In this slice, the user sees one anchored request popup immediately after a valid selection, reviews one targeted selection and request draft at a time, and either submits or cancels it. AI-generated suggestions, accept/reject/apply flows, and document mutation are out of scope.
- **Context Exposure**: Selection capture and request drafting remain local. If the user explicitly submits a request, the system prepares only the selected text, its durable anchor, and a small amount of adjacent surrounding Markdown context needed for downstream suggestion generation.
- **Out of Scope**: Multi-file requests, multi-range selection, automatic edit application, provider-specific response UX, source-editor-only selection as the primary interaction model, whole-document autonomous rewriting, mandatory block-only targeting, and routing the primary request flow through a separate chat pane or another extension-owned input field.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST detect a non-empty contiguous user selection made in rendered Markdown.
- **FR-002**: The system MUST support rendered selections smaller than a paragraph as well as selections that span multiple adjacent rendered prose blocks within one Markdown document.
- **FR-003**: The system MUST show one request popup for a valid rendered selection without leaving the document surface.
- **FR-004**: The system MUST anchor the request popup near the rendered selection inside the document surface.
- **FR-005**: The system MUST preserve a visible indication of the currently targeted rendered selection while the request popup is open.
- **FR-006**: The request popup MUST include a text box with placeholder text `Ask for changes`.
- **FR-007**: The request popup MUST include a submit button for the user to send the drafted request.
- **FR-008**: The system MUST map the rendered selection to one canonical source-backed target range or fail clearly if that mapping cannot be resolved confidently.
- **FR-009**: The system MUST record a durable anchor for the targeted range that includes enough information to re-find the intended scope after minor document changes.
- **FR-010**: The system MUST revalidate the anchor before request submission and MUST block submission if the intended target range has become ambiguous.
- **FR-011**: The system MUST create a structured local request payload that includes the user request text, the targeted selection text, the anchor metadata, and a small amount of adjacent surrounding Markdown context required for downstream suggestion generation.
- **FR-012**: The system MUST keep this feature scoped to one Markdown document and one contiguous selection in v1.
- **FR-013**: The system MUST NOT send document content to an external provider during selection capture or while the request popup is merely open.
- **FR-014**: The system MUST require an explicit user submit action before any downstream suggestion-generation step begins.
- **FR-015**: The system MUST reject empty, collapsed, or whitespace-only selections with a clear message instead of creating a request.
- **FR-016**: The system MUST show a clear recovery path when the rendered selection includes unsupported content that cannot be mapped safely to canonical Markdown source.
- **FR-017**: The system MUST block selections that cross structural containers or unsupported rendered regions in v1 and MUST ask the user to reselect within a supported contiguous prose range.
- **FR-018**: The system MUST allow only one active request popup or draft at a time in v1.
- **FR-019**: The system MUST require the user to cancel or finish the current draft before opening a new request popup for another selection.
- **FR-020**: The system MUST NOT include the entire document or entire enclosing section in the request payload by default in v1.
- **FR-021**: When the user submits the request popup, the system MUST create the selection-scoped request payload inside Inlinr and keep the primary request flow in the Inlinr document surface.
- **FR-022**: The v1 primary request-submission flow MUST NOT depend on programmatically writing to or sending from another extension-owned chat input UI.
- **FR-023**: The system MUST derive the targeted rendered selection from the actual rendered DOM boundaries associated with source-backed selection metadata rather than from a heuristic default region.
- **FR-024**: The system MUST keep popup draft entry, placement, and scroll behavior responsive inside the document surface without requiring a full-document rerender for each draft edit or overlay movement.

### Key Entities *(include if feature involves data)*

- **Selection Range**: The user-defined contiguous rendered-Markdown selection, including its visible start and end boundaries within one document.
- **Selection Anchor**: The durable representation of the selected range, including source-backed location information and nearby context used to re-find the intended target.
- **Edit Request Draft**: The user-authored request text associated with one targeted selection before any provider call or suggestion generation occurs.
- **Active Request Session**: The single in-progress request-composer state allowed in v1, including the targeted selection, draft text, and anchor-validation state.
- **Selection-Scoped Request Payload**: The structured local payload that combines the request draft, selected text, anchor data, and minimal surrounding context for a later suggestion step.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: In usability testing, at least 90% of users can create a request draft from a rendered Markdown selection on their first attempt without being told to switch to a source editor.
- **SC-002**: In acceptance testing, 95% of sampled valid rendered selections open the inline request composer within 1 second of the invoke action.
- **SC-003**: In acceptance testing, 100% of sampled valid requests show the correct targeted text boundaries in the request draft before submission.
- **SC-004**: In failure-path testing, 100% of ambiguous or unmappable rendered selections are blocked from submission and present a clear reselect or recovery message.
- **SC-005**: In acceptance testing, 100% of sampled v1 requests remain scoped to a single contiguous selection in one Markdown document.
- **SC-006**: In end-to-end rendered-selection testing, 100% of sampled valid selections produce a visible inline request popup near the selected text without relying on synthetic message injection.

## Assumptions

- The Inlinr Markdown surface remains the primary document experience for targeted Markdown opens.
- Users select directly in rendered Markdown, even though the canonical document model remains the underlying Markdown source.
- The product can derive a stable source-backed anchor from supported rendered-text selections without requiring users to switch to raw source view.
- Supported v1 selections may cross adjacent prose blocks but do not cross structural containers or unsupported rendered regions.
- Block-level shortcut affordances may be added later, but arbitrary free selection is the primary interaction model for this slice.
- Only one request popup or draft needs to be active at a time in v1; richer multi-draft queue behavior can be added later.
- Submitted request context is limited to the selected text and a small amount of adjacent surrounding Markdown context rather than the full section or full document.
- The primary request-submission path remains Inlinr-owned rather than depending on another extension's chat UI.
- AI response generation, diff review, and edit application belong to later features and are not required for this specification.