# Tasks: Empty State Guidance

**Input**: Design documents from `/specs/005-add-empty-state-guidance/`  
**Prerequisites**: `spec.md`, `plan.md`  

**Tests**: Include test tasks because this feature changes user-visible webview behavior, viewer/webview contracts, and local persisted guidance state.

**Organization**: Tasks are grouped by user story to enable incremental delivery and independent validation where the feature shape allows it.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (`[US1]`, `[US2]`, `[US3]`)
- Every task includes an exact file path

## Path Conventions

```text
src/
├── editors/
├── onboarding/
├── telemetry/
└── webview/

media/markdownViewer/

tests/
├── integration/
├── unit/
└── webview/
```

## Phase 1: Setup (Shared Harness and Verification)

**Purpose**: Prepare shared verification assets and test helpers for the first-run guidance flow.

- [X] T001 [P] Add first-run, dismiss, and returning-user verification steps to `specs/005-add-empty-state-guidance/quickstart.md`
- [X] T002 [P] Extend guidance banner selectors, dismiss helpers, and initial-state options in `tests/webview/helpers/selectionRequestHarness.js`
- [X] T003 [P] Add reusable global-state and custom-editor test helpers for guidance scenarios in `tests/integration/helpers.ts`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Create the local persistence boundary and viewer/webview contracts that every story depends on.

**⚠️ CRITICAL**: No user story work should begin until this phase is complete.

- [X] T004 [P] Add unit coverage for local-only first-action guidance state transitions in `tests/unit/firstActionGuidanceState.test.ts`
- [X] T005 [P] Extend rendered viewer-state contract coverage for first-action guidance payloads in `tests/unit/viewerState.test.ts`
- [X] T006 [P] Extend viewer-to-extension message contract coverage for guidance dismissal events in `tests/integration/selectionRequest.contract.test.ts`
- [X] T007 Create the persisted first-action guidance state helper in `src/onboarding/firstActionGuidanceState.ts`
- [X] T008 Update the viewer state and guidance-dismiss message contracts in `src/webview/viewerState.ts` and `src/webview/viewerProtocol.ts`
- [X] T009 Wire the persisted guidance state into activation and custom-editor resolution in `src/extension.ts` and `src/editors/markdownCustomEditorProvider.ts`
- [X] T010 Record the local-only persisted guidance boundary in `architecture/high-level-architecture.md` and `product/ux-principles.md`

**Checkpoint**: Guidance eligibility, persistence, and viewer/webview contracts are ready for story work.

---

## Phase 3: User Story 1 - Discover the first action on open (Priority: P1) 🎯 MVP

**Goal**: Show subtle first-run guidance inside the rendered Markdown view so a new user knows to select text to start editing.

**Independent Test**: Open a Markdown file in Inlinr with no prior guidance completion state and confirm the hint appears immediately without blocking reading, scrolling, or text selection.

### Tests for User Story 1

- [X] T011 [P] [US1] Add integration coverage for first-run guidance visibility on viewer open in `tests/integration/markdownViewer.opening.test.ts`
- [X] T012 [P] [US1] Add webview coverage for rendering the first-action hint in `tests/webview/selectionRequest.test.js`

### Implementation for User Story 1

- [X] T013 [US1] Compute first-run guidance eligibility and message content during document render in `src/editors/markdownCustomEditorProvider.ts`
- [X] T014 [US1] Render the first-action guidance container and serialized state in `src/webview/getMarkdownViewerHtml.ts`
- [X] T015 [US1] Implement visible banner behavior and theme-aware guidance styling in `media/markdownViewer/selectionRequest.js` and `media/markdownViewer/styles.css`

**Checkpoint**: First-time users see in-document guidance and can still use the current selection workflow.

---

## Phase 4: User Story 2 - Remove guidance once the user understands it (Priority: P2)

**Goal**: Dismiss the guidance when the user explicitly closes it or demonstrates understanding by starting the selection/request flow.

**Independent Test**: Open a Markdown file as an eligible user, dismiss the hint or make a qualifying selection, then confirm the hint disappears immediately and does not return on the next eligible open.

### Tests for User Story 2

- [X] T016 [P] [US2] Add integration coverage for dismissal and qualifying-selection completion in `tests/integration/selectionScopedEditRequest.test.ts`
- [X] T017 [P] [US2] Add webview coverage for dismiss-button and selection-triggered removal in `tests/webview/selectionRequest.test.js`

### Implementation for User Story 2

- [X] T018 [US2] Handle guidance dismissal and qualifying-selection completion events in `media/markdownViewer/selectionRequest.js` and `src/webview/viewerProtocol.ts`
- [X] T019 [US2] Persist completion on dismiss, qualifying selection, and first successful request in `src/editors/markdownCustomEditorProvider.ts` and `src/onboarding/firstActionGuidanceState.ts`
- [X] T020 [US2] Keep the active viewer session in sync after guidance completion in `src/editors/markdownCustomEditorProvider.ts` and `src/webview/getMarkdownViewerHtml.ts`

**Checkpoint**: Guidance teaches the first action once, then gets out of the way for the rest of the session and future opens.

---

## Phase 5: User Story 3 - Keep the experience clean for returning users (Priority: P3)

**Goal**: Prevent repeated teaching UI for users who have already completed the discovery experience while preserving the existing request popup and review flow.

**Independent Test**: Mark the user as already completed, reopen or switch between Markdown documents, and confirm the viewer opens cleanly with no guidance banner and no regression in the current selection/request UX.

### Tests for User Story 3

- [X] T021 [P] [US3] Add integration coverage that completed users do not see guidance after reopen or document switching in `tests/integration/markdownViewer.switching.test.ts`
- [X] T022 [P] [US3] Add webview coverage that completed viewer states render without the guidance banner in `tests/webview/selectionRequest.test.js`

### Implementation for User Story 3

- [X] T023 [US3] Recompute no-repeat guidance eligibility across viewer refreshes and document switches in `src/editors/markdownCustomEditorProvider.ts`
- [X] T024 [US3] Keep suppressed guidance from reserving layout space or interfering with request overlays in `media/markdownViewer/selectionRequest.js` and `media/markdownViewer/styles.css`

**Checkpoint**: Returning users see a clean viewer with unchanged inline request behavior.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Align docs, privacy notes, and regression coverage across the completed feature.

- [X] T025 [P] Update privacy and storage notes for first-action guidance in `architecture/security-principles.md` and `specs/005-add-empty-state-guidance/quickstart.md`
- [X] T026 [P] Update shipped behavior references for discovery guidance in `product/user-scenarios.md` and `specs/005-add-empty-state-guidance/spec.md`
- [X] T027 Run the affected regression commands and record the verification checklist in `specs/005-add-empty-state-guidance/quickstart.md`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1: Setup**: No dependencies
- **Phase 2: Foundational**: Depends on Phase 1 and blocks all story work
- **Phase 3: US1**: Depends on Phase 2
- **Phase 4: US2**: Depends on Phase 3 because dismissal/completion logic builds on the visible guidance surface
- **Phase 5: US3**: Depends on Phase 4 because returning-user suppression depends on persisted completion state
- **Phase 6: Polish**: Depends on the stories you intend to ship

### User Story Dependencies

- **US1 (P1)**: First deliverable and MVP slice
- **US2 (P2)**: Builds on US1 guidance rendering and completion triggers
- **US3 (P3)**: Builds on US2 completion persistence and viewer refresh behavior

### Within Each User Story

- Tests should fail before implementation when they cover changed behavior or contracts
- Persistence and contract changes should land before UI wiring that depends on them
- Webview rendering changes should land before dismissal and no-repeat refinements
- Finish each checkpoint before moving to the next story

### Parallel Opportunities

- `T001`-`T003` can run in parallel
- `T004`-`T006` can run in parallel
- `T011` and `T012` can run in parallel
- `T016` and `T017` can run in parallel
- `T021` and `T022` can run in parallel
- `T025` and `T026` can run in parallel

---

## Parallel Example: User Story 1

```bash
Task: "T011 [US1] Add integration coverage for first-run guidance visibility on viewer open in tests/integration/markdownViewer.opening.test.ts"
Task: "T012 [US1] Add webview coverage for rendering the first-action hint in tests/webview/selectionRequest.test.js"
```

## Parallel Example: User Story 2

```bash
Task: "T016 [US2] Add integration coverage for dismissal and qualifying-selection completion in tests/integration/selectionScopedEditRequest.test.ts"
Task: "T017 [US2] Add webview coverage for dismiss-button and selection-triggered removal in tests/webview/selectionRequest.test.js"
```

## Parallel Example: User Story 3

```bash
Task: "T021 [US3] Add integration coverage that completed users do not see guidance after reopen or document switching in tests/integration/markdownViewer.switching.test.ts"
Task: "T022 [US3] Add webview coverage that completed viewer states render without the guidance banner in tests/webview/selectionRequest.test.js"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1 and Phase 2
2. Deliver Phase 3 (US1)
3. Validate first-run guidance in the viewer before moving on

### Incremental Delivery

1. Finish shared setup and contracts
2. Ship US1 so new users can discover the workflow
3. Add US2 so the hint dismisses once the user learns it
4. Add US3 so returning users keep a clean experience

### Parallel Team Strategy

1. One developer handles Phase 1 and Phase 2 groundwork
2. After US1 lands, one developer can handle US2 while another prepares US3 regression coverage
3. Finish with Phase 6 docs and verification updates

---

## Notes

- This task list is grounded in the current repo structure and the existing Markdown viewer, webview, and test files already present in the repository.
- The feature introduces local persisted guidance state, so privacy/storage notes and boundary tests are included explicitly.
- The suggested MVP scope is **User Story 1** after Phase 1 and Phase 2 complete.
