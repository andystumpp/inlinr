> ⚠️ **STALE**: spec.md was refined on 2026-05-22. Run `/speckit.refine.propagate` to update this plan.

# Tasks: Execute Selection Request

**Input**: Design documents from `/specs/003-execute-selection-request/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/
**Propagated**: 2026-05-21 — Updated from spec.md refinement for broader selection scope, lightweight popup request entry, document-first inline diff review, and list-item deletion semantics

**Tests**: Keep automated coverage for markerized payload construction, full-document draft execution, bounded extraction, deletion proposals, list-item effective-scope removal, popup-opening across list and chapter selections, document-inline diff review, review/apply, consecutive request cycles, drift handling, unavailable capability, and ignored out-of-range draft changes. Keep manual quickstart verification for the live editor flow.

**Organization**: Tasks are grouped by phase and user story so the full-document draft architecture can be delivered and verified incrementally.

## Phase 1: Shared Foundation

**Purpose**: Establish the host-owned request, selection-resolution, and validation primitives required by every user story.

- [X] T001 Add selection marker helpers for full-document draft execution in src/requests/documentDraftMarkers.ts
- [X] T002 Extend request payload construction with `selectionMarkerId` and `markedDocumentMarkdown` in src/requests/requestPayloadBuilder.ts
- [X] T003 Update the Copilot execution service to request a marker-preserving full-document draft in src/requests/executionService.ts
- [ ] T004 Replace draft containment rejection with marker-preserving extraction that allows deletion and ignores unrelated out-of-range draft changes in src/requests/suggestionNormalizer.ts
- [ ] T005 Gate apply-time mutation on anchor revalidation and extracted selected-range proposals, not on full-draft containment, in src/requests/editApplicationService.ts
- [X] T006 Update execution session and viewer contracts for `blended-inline` review in src/webview/viewerState.ts and src/webview/viewerProtocol.ts
- [ ] T007 Refresh provider orchestration to rebuild the anchor at submit time and allow mapped proposals even when the draft changes unrelated out-of-range content in src/editors/markdownCustomEditorProvider.ts
- [ ] T008 Extend deterministic fake execution helpers for deletion proposals and ignored out-of-range full-document drafts in tests/integration/helpers.ts
- [ ] T009 [P] Refresh unit coverage for payload construction, execution prompts, deletion proposals, ignored out-of-range draft changes, and bounded apply in tests/unit/requestPayloadBuilder.test.ts, tests/unit/executionService.test.ts, tests/unit/suggestionNormalizer.test.ts, and tests/unit/editApplicationService.test.ts

**Checkpoint**: The extension can build a markerized full-document request, ask Copilot for a full-document draft, and extract one safe selected-range proposal from marker-preserving output even when the draft contains unrelated out-of-range changes.

---

## Phase 2: User Story 1 - Open And Submit Any Contiguous Selection Request (Priority: P1) 🎯 MVP

**Goal**: Open a lightweight request popup for any contiguous Markdown selection, including list items and chapter-scale selections, submit the request, and surface one extracted proposal or deletion for that selection as an inline diff without mutating the document.

**Independent Test**: Select contiguous content that spans multiple list items, one list item, one section, or multiple chapters, confirm the request popup opens with only an input field and an "Ask for changes" action, submit a request, and confirm the viewer shows pending feedback followed by one proposal-ready inline diff extracted from a full-document draft, with no document mutation before Apply.

### Tests for User Story 1

- [X] T010 [US1] Update submit-to-review integration coverage for list selections, chapter-scale selections, popup-opening behavior, ignored out-of-range draft changes, and deletion proposals in tests/integration/selectionScopedEditRequest.test.ts
- [ ] T011 [US1] Validate the live execute flow against the revised quickstart, including input-only popup behavior, click-away dismissal, and document-inline diff review, in specs/003-execute-selection-request/quickstart.md

### Implementation for User Story 1

- [X] T012 [US1] Expand selection capture and submit-time anchoring to support contiguous list-item, section, and chapter-scale selections in src/editors/markdownCustomEditorProvider.ts and src/requests/selectionSupportPolicy.ts
- [X] T013 [US1] Materialize extracted proposal state for document-first inline diff review, including empty replacements and effective selection scope metadata, in src/requests/suggestionNormalizer.ts and src/sessions/documentSessionController.ts
- [X] T014 [US1] Replace the preview-heavy popup with an input-only request-entry popup that dismisses on outside click and hands off review to document-inline diff rendering in media/markdownViewer/selectionRequest.js and src/webview/viewerProtocol.ts
- [X] T015 [US1] Restyle the lightweight request-entry popup and document-inline diff review states in media/markdownViewer/styles.css
- [X] T028 [US1] Extend rendered selection metadata so any non-empty contiguous visible selection, including multi-item lists and chapter-scale selections, can open the request popup in src/rendering/renderedSelectionMetadata.ts and src/requests/selectionSupportPolicy.ts

**Checkpoint**: User Story 1 is functional when any supported contiguous selection opens the lightweight popup and submit produces one reviewable inline diff proposal or deletion derived from a marker-preserving full-document draft.

---

## Phase 3: User Story 2 - Review, Apply, And Continue Editing (Priority: P2)

**Goal**: Let the user review the proposed revision or deletion as an inline diff, explicitly reject it, or apply it only to the revalidated effective selection scope, then start another scoped request cycle in the same editor session.

**Independent Test**: Execute a valid request against list content and chapter-scale content, review the inline diff, confirm Reject leaves the document unchanged, confirm Apply updates only the revalidated intended scope including full list-item deletion when required, and then confirm a second supported selection can start a fresh request cycle without reloading the editor.

### Tests for User Story 2

- [X] T016 [US2] Revalidate review, reject, apply, list-item deletion, chapter-scale feedback, and consecutive-cycle integration coverage against the extracted-range model in tests/integration/selectionScopedEditRequest.test.ts
- [ ] T027 [US2] Validate back-to-back request cycles after apply and reject against the refined quickstart in specs/003-execute-selection-request/quickstart.md

### Implementation for User Story 2

- [X] T017 [US2] Preserve bounded apply behavior while resolving effective list-item scope and clearing obsolete proposal and request state after apply, reject, or dismissal in src/requests/editApplicationService.ts, src/editors/markdownCustomEditorProvider.ts, and src/sessions/documentSessionController.ts
- [X] T018 [US2] Keep document-inline diff review behavior, apply/reject controls, and selection-capture reset behavior aligned with the refined UX across consecutive cycles in src/webview/viewerProtocol.ts and media/markdownViewer/selectionRequest.js
- [X] T029 [US2] Apply list-item removal requests to the full containing list item when needed to preserve valid list structure in src/requests/selectionAnchorResolver.ts, src/requests/requestPayloadBuilder.ts, and src/requests/editApplicationService.ts

**Checkpoint**: User Stories 1 and 2 are functional when inline diff proposals or deletions can be reviewed, rejected, or applied without unintended boundary widening, full list-item deletion works when appropriate, and a follow-up request can start cleanly from the current document state.

---

## Phase 4: User Story 3 - Fail Closed On Draft Or Range Violations (Priority: P3)

**Goal**: Block review or apply when Copilot is unavailable, the returned draft is malformed, markers are not preserved, the marked range cannot be extracted safely, the effective deletion scope cannot be resolved safely, or the target drifts before apply.

**Independent Test**: Force provider unavailability, malformed marker output, unextractable marked ranges, and pre-apply drift, then confirm the extension blocks mutation and shows recovery guidance.

### Tests for User Story 3

- [X] T019 [US3] Revalidate unavailable, malformed-output, marker-duplication, unextractable-range, unsafe effective-scope resolution, and drift integration coverage in tests/integration/selectionScopedEditRequest.test.ts and tests/integration/selectionRequest.contract.test.ts

### Implementation for User Story 3

- [X] T020 [US3] Reject drafts that remove or duplicate selection markers in src/requests/documentDraftMarkers.ts and src/requests/suggestionNormalizer.ts
- [ ] T021 [US3] Surface extraction-failure and unsafe-scope-resolution messaging before review while keeping the popup lightweight and ignoring unrelated out-of-range draft changes in src/editors/markdownCustomEditorProvider.ts and media/markdownViewer/selectionRequest.js
- [X] T022 [US3] Preserve mutation-blocking apply failure behavior for drifted selections in src/requests/editApplicationService.ts and src/editors/markdownCustomEditorProvider.ts

**Checkpoint**: All user stories are functional when the host validates marker-preserving extraction and blocks unsafe mutations before review or apply.

---

## Phase 5: Validation And Cleanup

**Purpose**: Record what is verified now and what remains blocked only by the local test host environment.

- [X] T023 [P] Compile the revised full-document draft implementation via package.json
- [X] T024 [P] Rerun unit coverage for the current implementation via package.json
- [X] T025 [P] Rerun integration coverage for the current implementation via package.json
- [X] T026 [P] Reconcile the task list with the revised spec, plan, research, data model, and contracts in specs/003-execute-selection-request/

---

## Dependencies & Execution Order

### Phase Dependencies

- Phase 1 blocks all user story work.
- User Story 1 depends on the markerized request, execution, normalization, and broadened contiguous-selection capture foundation.
- User Story 2 depends on User Story 1 because review/apply and follow-up request cycles require an extracted reviewable proposal, document-inline diff UX, and correct post-completion state reset.
- User Story 3 depends on User Stories 1 and 2 because failure handling must cover both review entry and apply.
- Phase 5 depends on the desired user stories being implemented.

### Parallel Opportunities

- T008 and T009 can run in parallel once T001-T007 land.
- T010 and T011 can run in parallel for User Story 1 verification.
- T014 and T015 can run in parallel once the lightweight popup and document-inline diff contract is stable.
- T028 can run in parallel with T012 once the broadened selection rules are settled.
- T016 and T018 can run in parallel once the review flow is stable.
- T027 can run after T016-T018 land.
- T029 can run in parallel with T016 once the effective-scope rule is implemented.
- T019 can run in parallel with any remaining failure-message polish.
- T024 and T025 can run in parallel once the local VS Code test host is launchable again.

---

## Implementation Strategy

### MVP First

1. Finish the markerized full-document request foundation.
2. Deliver User Story 1 end to end so submit produces an extracted proposal or deletion without mutating the document.
3. Validate the live editor flow before expanding apply and failure handling.

### Incremental Delivery

1. Build the host-owned marker and draft-validation primitives.
2. Deliver popup opening and request submission for contiguous multi-block, list-item, and chapter-scale selections.
3. Deliver document-inline diff review and effective-scope deletion behavior on top of the extracted selected-range model.
4. Harden unavailable, malformed, marker-corrupted, unsafe-scope, drift, and repeated-cycle failure paths.
5. Finish with compile, automated regression reruns, and manual quickstart verification.

---

## Notes

- The completed tasks above reflect the architecture pivot from replacement-only output to full-document draft validation.
- The remaining open tasks now represent the next implementation slice required to align code with the revised requirements around broader contiguous selection support, lightweight popup UX, document-inline diff review, list-item deletion semantics, and consecutive request cycles, not a test-environment blocker.
- User Story 1 remains the recommended MVP milestone for this feature.