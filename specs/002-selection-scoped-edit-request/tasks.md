# Tasks: Selection-Scoped Edit Request

**Input**: Design documents from `/specs/002-selection-scoped-edit-request/`
**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/, quickstart.md

**Tests**: Include test tasks whenever the change affects user-visible behavior, contracts, anchoring,
edit application, provider boundaries, or privacy and security behavior. If automation is not yet practical,
include a manual verification task for the affected workflow.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

**Architecture correction note (2026-05-20)**: The completed tasks below established a first pass at the inline request flow, but manual testing exposed a systemic control-boundary flaw: popup behavior is currently too host-rendered and too lightly exercised through real DOM interaction. Complete the architecture-correction phase below before spending more time on popup bug-fixing.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

- **Single project**: `src/`, `tests/` at repository root
- Paths below follow the VS Code extension structure defined in plan.md

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Prepare the feature-specific source, asset, and test scaffolding for rendered selection work

- [X] T001 Create the selection request source scaffolding in src/requests/requestService.ts, src/requests/requestPayloadBuilder.ts, src/requests/selectionAnchorResolver.ts, src/rendering/renderedSelectionMetadata.ts, and src/webview/viewerProtocol.ts
- [X] T002 [P] Create the selection request webview asset entry point in media/markdownViewer/selectionRequest.js and extend media/markdownViewer/styles.css for popup states
- [X] T003 [P] Add Markdown fixture documents for valid and unsupported selections in tests/fixtures/workspace/selection-request-basic.md and tests/fixtures/workspace/selection-request-unsupported.md
- [X] T004 [P] Create feature test scaffolding in tests/integration/selectionScopedEditRequest.test.ts, tests/integration/selectionRequest.contract.test.ts, tests/unit/selectionSupportPolicy.test.ts, tests/unit/selectionAnchorResolver.test.ts, and tests/unit/requestPayloadBuilder.test.ts

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [X] T005 Define runtime-validated selection message contracts and active request view state in src/webview/viewerProtocol.ts and src/webview/viewerState.ts
- [X] T006 [P] Extend the Markdown render pipeline to emit supported selection metadata in src/rendering/markdownRenderer.ts and src/rendering/renderedSelectionMetadata.ts
- [X] T007 [P] Enable secure webview scripting and bundle the selection request asset in src/editors/markdownCustomEditorProvider.ts and src/webview/getMarkdownViewerHtml.ts
- [X] T008 [P] Add document-level active request session tracking and invalidation hooks in src/sessions/documentSessionController.ts and src/extension.ts
- [X] T009 Define the provider-agnostic request service boundary and local payload validator in src/requests/requestService.ts and src/requests/requestPayloadBuilder.ts
- [X] T010 Implement hybrid selection anchor creation and revalidation primitives in src/requests/selectionAnchorResolver.ts

**Checkpoint**: Render metadata, message contracts, request-session infrastructure, and anchor primitives are ready for story work

---

## Phase 3: User Story 1 - Start An Inline Request From Rendered Selection (Priority: P1) 🎯 MVP

**Goal**: Let a user select a valid rendered Markdown span and immediately get one anchored inline request popup with a draft field and submit control

**Independent Test**: Select a non-empty contiguous rendered prose range and confirm one anchored request popup appears for that exact selection with placeholder text `Ask for changes`, a submit button, visible targeted scope, and no provider call before submit.

### Tests for User Story 1 ⚠️

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [X] T011 [P] [US1] Add an integration test for opening one anchored request popup from a valid rendered selection in tests/integration/selectionScopedEditRequest.test.ts
- [X] T012 [P] [US1] Add a unit test for single-range rendered selection validation in tests/unit/selectionSupportPolicy.test.ts
- [X] T013 [P] [US1] Add a contract test for selection capture, draft change, cancel, and submit message validation in tests/integration/selectionRequest.contract.test.ts

### Implementation for User Story 1

- [X] T014 [US1] Implement DOM selection capture, popup draft input, and cancel or submit messaging in media/markdownViewer/selectionRequest.js
- [X] T015 [US1] Implement accepted-selection state, single-draft enforcement, and popup lifecycle handling in src/editors/markdownCustomEditorProvider.ts and src/sessions/documentSessionController.ts
- [X] T016 [US1] Render anchored popup state and visible targeted-selection UI in src/webview/getMarkdownViewerHtml.ts, src/webview/viewerState.ts, and media/markdownViewer/styles.css
- [X] T017 [US1] Create the local selection-scoped request payload only on explicit submit in src/requests/requestPayloadBuilder.ts and src/requests/requestService.ts

**Checkpoint**: At this point, a user can open exactly one inline request popup from a valid rendered selection and submit a local request payload independently of later stories

---

## Phase 4: User Story 2 - Support Section-Sized Contiguous Prose Selections (Priority: P2)

**Goal**: Support one contiguous selection that spans multiple adjacent rendered prose blocks while preserving a single targeted request

**Independent Test**: Select text that starts in one rendered prose block and ends in an adjacent prose block, then confirm Inlinr preserves one contiguous targeted range and one popup rather than splitting the request.

### Tests for User Story 2 ⚠️

- [X] T018 [P] [US2] Add an integration test for contiguous multi-block prose selections in tests/integration/selectionScopedEditRequest.test.ts
- [X] T019 [P] [US2] Add a unit test for adjacent-prose selection normalization and supported-region allowlisting in tests/unit/selectionSupportPolicy.test.ts
- [X] T020 [P] [US2] Add a unit test for hybrid anchor capture across multi-block selections in tests/unit/selectionAnchorResolver.test.ts

### Implementation for User Story 2

- [X] T021 [US2] Extend supported rendered-region metadata for adjacent prose blocks and inline spans in src/rendering/markdownRenderer.ts and src/rendering/renderedSelectionMetadata.ts
- [X] T022 [US2] Normalize contiguous multi-block selections into one source-backed target range in src/requests/selectionAnchorResolver.ts and src/webview/viewerProtocol.ts
- [X] T023 [US2] Preserve the full targeted range in popup preview and active request state for larger selections in src/webview/viewerState.ts, src/webview/getMarkdownViewerHtml.ts, and media/markdownViewer/selectionRequest.js

**Checkpoint**: At this point, section-sized prose selections work as one request without breaking the User Story 1 flow

---

## Phase 5: User Story 3 - Fail Safely When Selection Mapping Becomes Ambiguous (Priority: P3)

**Goal**: Block unsafe submissions, invalidate drifted targets clearly, and give the user an explicit reselect path instead of guessing

**Independent Test**: Capture a rendered selection, change the document or target unsupported content so the mapping becomes ambiguous, then confirm submission is blocked and the user is asked to reselect rather than silently targeting nearby text.

### Tests for User Story 3 ⚠️

- [ ] T024 [P] [US3] Add an integration test for ambiguous mapping and submit blocking after document changes in tests/integration/selectionScopedEditRequest.test.ts
- [X] T025 [P] [US3] Add a unit test for anchor revalidation failure and recovery messaging in tests/unit/selectionAnchorResolver.test.ts
- [X] T026 [P] [US3] Add a unit test for minimal-context payload creation and blocked unsupported selections in tests/unit/requestPayloadBuilder.test.ts

### Implementation for User Story 3

- [X] T027 [US3] Implement submit-time anchor revalidation and invalid-session recovery states in src/requests/selectionAnchorResolver.ts, src/requests/requestService.ts, and src/webview/viewerState.ts
- [X] T028 [US3] Block unsupported or drifted selections and surface reselect guidance in src/editors/markdownCustomEditorProvider.ts, src/webview/getMarkdownViewerHtml.ts, and media/markdownViewer/selectionRequest.js
- [X] T029 [US3] Invalidate or revalidate the active draft when the backing TextDocument changes in src/sessions/documentSessionController.ts and src/editors/markdownCustomEditorProvider.ts

**Checkpoint**: All user stories are independently demonstrable with fail-closed selection and submit behavior

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories

- [ ] T030 [P] Document the selection-scoped request workflow and development checks in README.md
- [ ] T031 Tighten keyboard focus, popup accessibility, and theme styling in media/markdownViewer/styles.css and media/markdownViewer/selectionRequest.js
- [ ] T032 [P] Update the final manual verification flow and supported-selection notes in specs/002-selection-scoped-edit-request/quickstart.md
- [ ] T033 Validate CSP, localResourceRoots, no-provider-before-submit behavior, and request-service privacy guards in src/editors/markdownCustomEditorProvider.ts, src/webview/getMarkdownViewerHtml.ts, and src/requests/requestService.ts

---

## Phase 7: Architecture Correction - Client-Owned Overlay And DOM-Driven Selection

**Purpose**: Correct the control boundary so transient popup behavior stays in the webview while the extension host remains authoritative for source-backed validation and submit-time payload creation

**⚠️ CRITICAL**: Complete this phase before more popup-positioning or visibility bug-fix work

### Tests for Architecture Correction ⚠️

- [ ] T034 [P] Add a DOM-driven regression path for real rendered selection capture and popup visibility in tests/integration/helpers.ts and tests/integration/selectionScopedEditRequest.test.ts or a new DOM-focused integration test file
- [ ] T035 [P] Add a regression test for scroll-safe popup positioning and live overlay visibility in tests/integration/selectionScopedEditRequest.test.ts or a new DOM-focused integration test file

### Implementation for Architecture Correction

- [X] T036 Emit stable DOM attributes for selectable regions and source-backed markers from src/rendering/markdownRenderer.ts and src/rendering/renderedSelectionMetadata.ts so the webview can resolve actual DOM selections safely
- [X] T037 Replace host-rendered transient popup markup with a client-owned overlay controller in media/markdownViewer/selectionRequest.js, src/webview/getMarkdownViewerHtml.ts, and src/webview/viewerProtocol.ts
- [X] T038 Move popup placement, scroll handling, focus handling, and draft entry to the webview while keeping the extension host authoritative for accepted selection state in media/markdownViewer/selectionRequest.js, src/editors/markdownCustomEditorProvider.ts, src/sessions/documentSessionController.ts, and src/webview/viewerState.ts
- [X] T039 Narrow the extension-host contract to selection acceptance, invalidation, and submit-time draft handoff in src/webview/viewerProtocol.ts, src/editors/markdownCustomEditorProvider.ts, and specs/002-selection-scoped-edit-request/contracts/selection-request-contract.md
- [X] T040 Update the rendered-selection quickstart and manual verification guidance for the client-owned overlay boundary in specs/002-selection-scoped-edit-request/quickstart.md and README.md

**Checkpoint**: The popup is driven by real DOM selection behavior inside the webview, while the extension host keeps durable targeting and submit-time validation under Inlinr control

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies; can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion; blocks all user stories
- **User Story 1 (Phase 3)**: Depends on Foundational completion; establishes the MVP inline request flow
- **User Story 2 (Phase 4)**: Depends on User Story 1 because larger contiguous selections build on the base popup and accepted-selection lifecycle
- **User Story 3 (Phase 5)**: Depends on User Story 1 because ambiguity handling builds on the base request session and submit flow; it can overlap with User Story 2 once the shared anchor primitives are stable
- **Polish (Phase 6)**: Depends on all desired user stories being complete
- **Architecture Correction (Phase 7)**: Must complete before additional popup-visibility or popup-positioning fixes are treated as done; it builds on existing foundational work but should precede further UI bug-fix iteration

### User Story Dependencies

- **User Story 1 (P1)**: Starts after Foundational; no dependencies on later stories
- **User Story 2 (P2)**: Starts after User Story 1; extends selection scope across adjacent prose blocks
- **User Story 3 (P3)**: Starts after User Story 1; hardens anchoring and submit safety without requiring User Story 2 completion

### Within Each User Story

- Tests MUST be written and FAIL before implementation when the change modifies behavior or contracts
- Selection and anchor contracts before popup state wiring
- Popup state wiring before payload creation or submit handling
- Story-specific implementation before cross-story accessibility and privacy polish

### Parallel Opportunities

- `T002`, `T003`, and `T004` can run in parallel during Setup
- `T006`, `T007`, and `T008` can run in parallel during the Foundational phase
- `T011`, `T012`, and `T013` can run in parallel for User Story 1
- `T018`, `T019`, and `T020` can run in parallel for User Story 2
- `T024`, `T025`, and `T026` can run in parallel for User Story 3
- `T030` and `T032` can run in parallel during Polish
- `T034` and `T035` can run in parallel for the architecture-correction test harness

---

## Parallel Example: User Story 1

```bash
# Launch User Story 1 test work together:
Task: "Add an integration test for opening one anchored request popup from a valid rendered selection in tests/integration/selectionScopedEditRequest.test.ts"
Task: "Add a unit test for single-range rendered selection validation in tests/unit/selectionSupportPolicy.test.ts"
Task: "Add a contract test for selection capture, draft change, cancel, and submit message validation in tests/integration/selectionRequest.contract.test.ts"

# Launch independent User Story 1 implementation work together after foundational contracts land:
Task: "Implement DOM selection capture, popup draft input, and cancel or submit messaging in media/markdownViewer/selectionRequest.js"
Task: "Render anchored popup state and visible targeted-selection UI in src/webview/getMarkdownViewerHtml.ts, src/webview/viewerState.ts, and media/markdownViewer/styles.css"
```

---

## Parallel Example: User Story 2

```bash
# Launch User Story 2 test work together:
Task: "Add an integration test for contiguous multi-block prose selections in tests/integration/selectionScopedEditRequest.test.ts"
Task: "Add a unit test for adjacent-prose selection normalization and supported-region allowlisting in tests/unit/selectionSupportPolicy.test.ts"
Task: "Add a unit test for hybrid anchor capture across multi-block selections in tests/unit/selectionAnchorResolver.test.ts"

# Launch independent User Story 2 implementation work together:
Task: "Extend supported rendered-region metadata for adjacent prose blocks and inline spans in src/rendering/markdownRenderer.ts and src/rendering/renderedSelectionMetadata.ts"
Task: "Preserve the full targeted range in popup preview and active request state for larger selections in src/webview/viewerState.ts, src/webview/getMarkdownViewerHtml.ts, and media/markdownViewer/selectionRequest.js"
```

---

## Parallel Example: User Story 3

```bash
# Launch User Story 3 test work together:
Task: "Add an integration test for ambiguous mapping and submit blocking after document changes in tests/integration/selectionScopedEditRequest.test.ts"
Task: "Add a unit test for anchor revalidation failure and recovery messaging in tests/unit/selectionAnchorResolver.test.ts"
Task: "Add a unit test for minimal-context payload creation and blocked unsupported selections in tests/unit/requestPayloadBuilder.test.ts"

# Launch independent User Story 3 implementation work together:
Task: "Block unsupported or drifted selections and surface reselect guidance in src/editors/markdownCustomEditorProvider.ts, src/webview/getMarkdownViewerHtml.ts, and media/markdownViewer/selectionRequest.js"
Task: "Invalidate or revalidate the active draft when the backing TextDocument changes in src/sessions/documentSessionController.ts and src/editors/markdownCustomEditorProvider.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational
3. Complete Phase 3: User Story 1
4. **STOP and VALIDATE**: Confirm one anchored inline request popup opens from a valid rendered selection and submit stays local

### Incremental Delivery

1. Deliver Setup + Foundational to establish metadata, messaging, and anchor primitives
2. Deliver User Story 1 to establish the MVP inline request flow
3. Deliver User Story 2 to expand selection scope across adjacent prose blocks
4. Deliver User Story 3 to harden ambiguity handling and submit safety
5. Complete Phase 7 to move transient popup behavior into the webview and add DOM-driven regression coverage
6. Finish with cross-cutting accessibility, privacy, and documentation updates

### Parallel Team Strategy

1. One developer can own render metadata and anchor primitives while another prepares webview assets and test scaffolding during Setup and Foundational
2. After Foundational lands, one developer can own popup behavior while another owns local request payload creation for User Story 1
3. After User Story 1 lands, one developer can extend multi-block selection support while another hardens ambiguity handling and document-change invalidation
4. Before further popup bug-fix iteration, one developer should own the DOM-driven test seam while another refactors the popup to a client-owned overlay controller

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] labels map each task to a specific user story for traceability
- User Story 1 is the MVP slice and should be releasable on its own
- User Story 2 and User Story 3 deliberately extend the same custom editor surface rather than creating alternative request entry paths
- Keep the request flow local, selection-scoped, and privacy-bounded throughout implementation