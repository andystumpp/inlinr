# Feature Specification: Empty State Guidance

**Feature Branch**: `005-add-empty-state-guidance`  
**Created**: 2026-05-29  
**Status**: Implemented  
**Input**: User description: "Issue #122: Add empty state guidance so users know how to start their first request."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Discover the first action on open (Priority: P1)

A new user opens a Markdown document in Inlinr and immediately sees subtle guidance in the rendered view that tells them how to start the core editing workflow by selecting text.

**Why this priority**: The product's primary inline editing experience is not valuable if new users do not discover how to begin.

**Independent Test**: Can be fully tested by opening a Markdown document in Inlinr as a first-time user and confirming that a clear, non-blocking first-action hint appears without any external setup or explanation.

**Acceptance Scenarios**:

1. **Given** a user has not yet completed or dismissed the first-run guidance, **When** they open a Markdown document in Inlinr, **Then** the rendered view shows a subtle first-action hint that tells them to select text to start editing.
2. **Given** the first-action hint is visible, **When** the user reads the document, **Then** the hint remains visible enough to teach the interaction model without blocking document content or preventing scrolling and selection.
3. **Given** a user opens a Markdown document for the first time in Inlinr, **When** the viewer finishes loading, **Then** the guidance appears in the document surface itself rather than relying on separate onboarding flows or external documentation.

---

### User Story 2 - Remove guidance once the user understands it (Priority: P2)

After the user demonstrates understanding of the workflow or explicitly dismisses the hint, Inlinr removes the guidance so the document surface can stay focused on reading and editing.

**Why this priority**: First-run help should teach the workflow quickly, then get out of the way before it becomes repetitive or distracting.

**Independent Test**: Can be fully tested by opening a Markdown document as an eligible user, then making a qualifying text selection or dismissing the hint and confirming that the guidance disappears and stays dismissed afterward.

**Acceptance Scenarios**:

1. **Given** the first-action hint is visible, **When** the user makes their first qualifying text selection in the rendered document, **Then** the hint is dismissed for the current view and is treated as completed for future eligible opens.
2. **Given** the first-action hint is visible, **When** the user explicitly dismisses it, **Then** the hint disappears immediately and does not reappear on later Markdown documents for that user.
3. **Given** the user has already submitted their first inline request, **When** they later open another Markdown document in Inlinr, **Then** the first-action hint is not shown again.

---

### User Story 3 - Keep the experience clean for returning users (Priority: P3)

A returning user who already understands Inlinr's interaction model opens Markdown documents without seeing repeated teaching UI, preserving a clean rendered view.

**Why this priority**: Discovery help should improve activation without degrading the everyday experience for repeat users.

**Independent Test**: Can be fully tested by marking a user as already taught, opening multiple Markdown documents in Inlinr, and confirming that the viewer stays free of first-run guidance while the existing editing workflow remains available.

**Acceptance Scenarios**:

1. **Given** a user has already completed or dismissed the guidance, **When** they open any later Markdown document in Inlinr, **Then** the rendered view opens without the first-action hint.
2. **Given** a user moves between Markdown documents during the same session after completing the guidance, **When** each document opens, **Then** the viewer stays focused on content and existing inline editing affordances rather than re-teaching the first action.
3. **Given** a user is already familiar with Inlinr, **When** they open a document, **Then** the feature does not add blocking prompts, forced steps, or repeated instructional messaging before they can work.

---

### Edge Cases

- What happens when the document is empty, extremely short, or starts with content that would normally occupy the same top-of-document space as the guidance?
- How does the experience behave when a user dismisses the hint in one document and immediately opens another Markdown document in the same or a later session?
- What happens when a user makes a transient selection that is cleared right away or selects content that does not proceed to an inline request?
- How does the guidance remain readable and non-disruptive across supported color themes, zoom levels, and document widths?

## Scope & Boundaries *(mandatory)*

- **Selection Scope**: This feature applies to the rendered Markdown document surface shown in Inlinr and focuses on helping first-time users discover the existing selection-based editing workflow.
- **Review Model**: The user may ignore the guidance, dismiss it directly, or make the qualifying interaction that removes it; the feature does not add a new suggestion review or approval flow.
- **Context Exposure**: The guidance is generated from product-owned copy and local viewer state only. This feature does not require sending document content or user selections to an external provider.
- **Out of Scope**: Full onboarding tours, multi-step tutorials, example prompts, command-palette-first teaching, blocking modals, non-Markdown surfaces, per-document teaching state, and redesign of the core inline request flow.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST show first-action guidance to users who have not yet completed or dismissed the new-user discovery experience when they open a Markdown document in Inlinr.
- **FR-002**: The first-action guidance MUST tell users, in plain language, that selecting text is how they begin the inline editing workflow.
- **FR-003**: The first-action guidance MUST appear within the Inlinr document experience itself and MUST be visible without requiring users to open separate help, documentation, or walkthrough surfaces.
- **FR-004**: The guidance MUST be visually subtle, theme-aware, and accessible so it teaches the workflow without feeling like a blocking interruption.
- **FR-005**: The guidance MUST allow the user to dismiss it directly.
- **FR-006**: The system MUST dismiss the guidance automatically after the user's first qualifying text selection in the rendered document.
- **FR-007**: The system MUST treat a direct dismissal, a qualifying first selection, or a first successful inline request as completion of the discovery experience for that user.
- **FR-008**: The system MUST preserve the user's completion state so the guidance does not reappear for later Markdown documents once the discovery experience is completed.
- **FR-009**: The guidance MUST NOT prevent reading, scrolling, selecting text, or invoking the existing inline request workflow.
- **FR-010**: The system MUST keep this feature scoped to Markdown documents opened in Inlinr and MUST leave broader onboarding and non-Markdown experiences unchanged.
- **FR-011**: The system MUST avoid showing repeated first-action guidance to users who have already demonstrated familiarity with the workflow.

### Key Entities *(include if feature involves data)*

- **First-Action Guidance**: A subtle teaching element shown in the rendered Markdown view that explains how to begin an inline edit.
- **Discovery Completion State**: The per-user status that records whether first-run guidance still needs to be shown.
- **Qualifying Interaction**: A user action that demonstrates understanding of the workflow, such as dismissing the hint, selecting text in the rendered document, or successfully starting an inline request.
- **Viewer Open Session**: A single document-open experience in which Inlinr decides whether guidance should appear and whether it should remain visible.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: In first-run usability testing, at least 80% of new users who open a Markdown document in Inlinr make their first qualifying text selection within 60 seconds without external instruction.
- **SC-002**: In first-run usability testing, at least 80% of new users who see the guidance successfully invoke their first inline request within 60 seconds of first noticing the hint.
- **SC-003**: In first-run testing, at least 90% of participants report that they understood how to start editing after opening the document.
- **SC-004**: In acceptance testing, 100% of sampled users who have completed the discovery experience do not see the first-action guidance again on later Markdown documents.
- **SC-005**: In acceptance testing, 100% of sampled eligible first-run opens show the guidance without blocking document reading or preventing normal text selection.

## Assumptions

- The existing inline request workflow already works once a user selects text in the rendered Markdown experience.
- A single subtle first-action hint is sufficient for v1 and does not need to explain the entire product.
- Discovery state should be treated as user-level guidance rather than a per-document reminder.
- Discovery completion is stored as local extension state only and does not include document content.
- Markdown documents opened outside Inlinr or non-Markdown files are outside the scope of this feature.
- The rendered view remains the primary entry surface for this first-run experience.
