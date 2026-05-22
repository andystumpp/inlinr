# Tasks: Markdown Viewer Opening

**Input**: Design documents from `/specs/001-markdown-viewer/`
**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/
**Propagated**: 2026-05-22 — Updated from spec.md refinement for local Mermaid diagram rendering and safe Mermaid block fallback behavior.

**Tests**: Include test tasks whenever the change affects user-visible behavior, contracts, anchoring,
edit application, provider boundaries, privacy and security behavior, or local Mermaid rendering and fallback behavior. If automation is not yet practical,
include a manual verification task for the affected workflow.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

- **Single project**: `src/`, `tests/` at repository root
- Paths below follow the VS Code extension structure defined in plan.md

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Initialize the VS Code extension project and core tooling

- [ ] T001 Initialize the VS Code extension manifest, scripts, engine settings, and required package dependencies in package.json
- [ ] T002 Install and wire the TypeScript compiler plus VS Code test tooling in package.json and create tsconfig.json
- [ ] T003 [P] Configure the VS Code extension test runner in .vscode-test.mjs
- [ ] T004 [P] Create the initial extension entrypoint and test folders in src/extension.ts, tests/integration/, and tests/unit/

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [ ] T005 Define the Markdown custom editor contribution and activation events in package.json
- [ ] T006 [P] Define shared viewer state types and runtime validators in src/webview/viewerState.ts
- [ ] T007 [P] Create the base viewer stylesheet and media folder in media/markdownViewer/styles.css
- [ ] T008 [P] Implement the base webview HTML shell with strict CSP and the minimum capability surface needed for local viewer rendering in src/webview/getMarkdownViewerHtml.ts
- [X] T009 [P] Implement the local Markdown rendering wrapper, including the local Mermaid rendering path, in src/rendering/markdownRenderer.ts
- [ ] T010 Create the document session controller skeleton in src/sessions/documentSessionController.ts

**Checkpoint**: Extension scaffold, custom editor shell, local renderer, and viewer contracts are ready for story work

---

## Phase 3: User Story 1 - Open Markdown In Viewer (Priority: P1) 🎯 MVP

**Goal**: Open Markdown files directly in the current editor tab as an Inlinr-rendered preview surface

**Independent Test**: Open a Markdown file from the VS Code Explorer and confirm the current editor tab becomes the Inlinr viewer with rendered content, file identity, and Mermaid diagrams rendered in place when present.

### Tests for User Story 1 ⚠️

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [ ] T011 [P] [US1] Add an integration test for opening Markdown from the VS Code Explorer in the Inlinr custom editor in tests/integration/markdownViewer.opening.test.ts
- [X] T012 [P] [US1] Add a unit test for local Markdown rendering output, including Mermaid fenced blocks, in tests/unit/markdownRenderer.test.ts
- [X] T013 [P] [US1] Add a rendered viewer state contract test that covers rendered Markdown and Mermaid viewer output in tests/integration/viewerSession.rendered.contract.test.ts

### Implementation for User Story 1

- [ ] T014 [US1] Register the Inlinr Markdown custom editor provider in src/extension.ts
- [ ] T015 [US1] Implement custom editor resolution and initial preview rendering, including Mermaid-capable documents, in src/editors/markdownCustomEditorProvider.ts
- [ ] T016 [US1] Wire rendered viewer state, Mermaid-capable viewer output, and document identity into the webview shell in src/editors/markdownCustomEditorProvider.ts and src/webview/getMarkdownViewerHtml.ts
- [ ] T017 [US1] Implement the current-tab preview presentation, Mermaid diagram presentation, and document identity styling in media/markdownViewer/styles.css

**Checkpoint**: At this point, Markdown files open directly in the Inlinr viewer, including local Mermaid diagram rendering when present, and can be validated independently

---

## Phase 4: User Story 2 - Switch Between Markdown Files (Priority: P2)

**Goal**: Keep the viewer consistent as users open other Markdown files and as open documents refresh

**Independent Test**: Open two different Markdown files from the VS Code Explorer in succession and confirm the viewer updates to the correct file content and metadata each time.

### Tests for User Story 2 ⚠️

- [ ] T018 [P] [US2] Add an integration test for switching between Explorer-opened Markdown files in tests/integration/markdownViewer.switching.test.ts
- [ ] T019 [P] [US2] Add a unit test for document session refresh behavior in tests/unit/documentSessionController.test.ts

### Implementation for User Story 2

- [ ] T020 [US2] Implement per-document viewer session tracking in src/sessions/documentSessionController.ts
- [ ] T021 [US2] Refresh matching viewer sessions from TextDocument changes in src/editors/markdownCustomEditorProvider.ts
- [ ] T022 [US2] Update viewer metadata and document version handling for repeated opens in src/webview/viewerState.ts and src/webview/getMarkdownViewerHtml.ts

**Checkpoint**: At this point, the viewer stays correct across repeated Markdown opens and document refreshes

---

## Phase 5: User Story 3 - Preserve Safe Fallbacks (Priority: P3)

**Goal**: Preserve non-Markdown behavior and keep Markdown render failures inside the Inlinr viewer with a clear error state

**Independent Test**: Open a non-Markdown file, a Markdown file that fails to render, and a Markdown file with invalid Mermaid content, then confirm the normal non-Markdown flow stays unchanged and viewer or diagram failures remain inside the Inlinr viewer.

### Tests for User Story 3 ⚠️

- [X] T023 [P] [US3] Add an integration test for non-Markdown behavior, document render failures, and invalid Mermaid block fallback in tests/integration/markdownViewer.fallbacks.test.ts
- [ ] T024 [P] [US3] Add an error and fallback viewer state contract test for document and Mermaid-block failures in tests/integration/viewerSession.error.contract.test.ts

### Implementation for User Story 3

- [ ] T025 [US3] Implement in-viewer error state rendering and Mermaid block fallback presentation in src/webview/getMarkdownViewerHtml.ts and src/webview/viewerState.ts
- [ ] T026 [US3] Handle unreadable or invalid Markdown documents and Mermaid render failures without automatic fallback in src/editors/markdownCustomEditorProvider.ts and src/rendering/markdownRenderer.ts
- [ ] T027 [US3] Add a manual reopen-with-default-editor recovery command in src/commands/reopenWithDefaultEditor.ts and package.json

**Checkpoint**: All user stories are now independently demonstrable with safe error handling boundaries in place

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories

- [ ] T028 [P] Document the extension setup and custom editor behavior in README.md
- [ ] T029 Tighten theme and accessibility styling for the viewer in media/markdownViewer/styles.css
- [ ] T030 [P] Update the manual verification flow with final implementation notes, including Mermaid render and fallback checks, in specs/001-markdown-viewer/quickstart.md
- [ ] T031 Validate privacy, CSP, and local resource restrictions in src/editors/markdownCustomEditorProvider.ts and src/webview/getMarkdownViewerHtml.ts

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies; can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion; blocks all user stories
- **User Story 1 (Phase 3)**: Depends on Foundational completion; establishes the MVP document surface
- **User Story 2 (Phase 4)**: Depends on User Story 1 because switching behavior builds on the base custom editor open flow
- **User Story 3 (Phase 5)**: Depends on User Story 1 because failure handling builds on the base viewer shell
- **Polish (Phase 6)**: Depends on all desired user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Starts after Foundational; no dependencies on later stories
- **User Story 2 (P2)**: Starts after User Story 1; extends viewer lifecycle and repeated-open behavior
- **User Story 3 (P3)**: Starts after User Story 1; extends failure and recovery behavior without depending on User Story 2

### Within Each User Story

- Tests MUST be written and FAIL before implementation when the change modifies behavior or contracts
- Shared state and contracts before provider wiring
- Provider wiring before styling and recovery polish
- Story-specific implementation before cross-story cleanup

### Parallel Opportunities

- `T003` and `T004` can run in parallel once package initialization starts
- `T006`, `T007`, `T008`, and `T009` can run in parallel in the foundational phase
- `T011`, `T012`, and `T013` can run in parallel for User Story 1
- `T018` and `T019` can run in parallel for User Story 2
- `T023` and `T024` can run in parallel for User Story 3
- `T028` and `T030` can run in parallel in the polish phase

---

## Parallel Example: User Story 1

```bash
# Launch User Story 1 test work together:
Task: "Add an integration test for opening Markdown in the Inlinr custom editor in tests/integration/markdownViewer.opening.test.ts"
Task: "Add a unit test for local Markdown rendering output in tests/unit/markdownRenderer.test.ts"
Task: "Add a rendered viewer state contract test in tests/integration/viewerSession.rendered.contract.test.ts"

# Launch independent User Story 1 UI work together after provider wiring begins:
Task: "Wire rendered viewer state and document identity into the webview shell in src/editors/markdownCustomEditorProvider.ts and src/webview/getMarkdownViewerHtml.ts"
Task: "Implement the current-tab preview presentation and document identity styling in media/markdownViewer/styles.css"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational
3. Complete Phase 3: User Story 1
4. **STOP and VALIDATE**: Confirm Markdown files open into the current-tab Inlinr viewer

### Incremental Delivery

1. Deliver Setup + Foundational to establish the extension shell
2. Deliver User Story 1 to establish the first real document surface
3. Deliver User Story 2 to make repeated file opens and refreshes reliable
4. Deliver User Story 3 to harden non-Markdown and render-failure behavior
5. Finish with cross-cutting polish and verification updates

### Parallel Team Strategy

1. One developer can own scaffold and manifest work while another prepares tests and render helpers during Setup and Foundational
2. After User Story 1 lands, one developer can own session refresh behavior while another owns failure-state handling
3. Final polish can be split between docs/accessibility and security verification

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] labels map each task to a specific user story for traceability
- User Story 1 is the MVP slice and should be releasable on its own
- User Story 2 and User Story 3 deliberately build on the same custom editor shell rather than creating alternative surfaces
- Keep the viewer local, preview-only, privacy-bounded, and locally Mermaid-rendered throughout implementation
