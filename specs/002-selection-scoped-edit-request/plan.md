# Implementation Plan: Selection-Scoped Edit Request

**Branch**: `002-selection-scoped-edit-request` | **Date**: 2026-05-20 | **Spec**: `/specs/002-selection-scoped-edit-request/spec.md`
**Input**: Feature specification from `/specs/002-selection-scoped-edit-request/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/plan-template.md` for the execution workflow.

## Summary

Extend the existing Inlinr custom Markdown viewer into the first interactive editing surface by
capturing rendered text selections inside the webview, validating them against source-backed
metadata in the extension host, showing one anchored inline request popup, and building a local
selection-scoped request payload for handoff to an Inlinr-owned request service. This slice stops
at request capture, anchor revalidation, and submit orchestration; suggestion generation, review,
and edit application remain later features.

## Technical Context

**Language/Version**: TypeScript 5.x for a VS Code extension running on the Node.js-based extension host, plus minimal webview-side browser JavaScript for DOM selection handling  
**Primary Dependencies**: `vscode`, `markdown-it`, webview HTML/CSS/JS assets, `@vscode/test-cli`, `@vscode/test-electron`, Mocha, existing custom editor/session infrastructure  
**Storage**: N/A for persisted product state; active request session state remains in memory against the canonical open `TextDocument`  
**Testing**: VS Code extension integration tests, focused unit tests for anchor and payload logic, and one manual rendered-selection verification path  
**Target Platform**: VS Code Desktop extension host on Windows, macOS, and Linux local workspaces  
**Project Type**: VS Code desktop extension with a custom text editor, webview UI, and extension-host request services  
**Performance Goals**: Open the request popup within 1 second for valid rendered selections; keep local anchor revalidation and payload construction effectively immediate for typical Markdown documents  
**Constraints**: One active request draft at a time; fail closed on ambiguous mapping; no external provider call before explicit submit; primary flow must remain inside Inlinr rather than another extension's chat UI; webview capabilities stay minimal apart from the scripts required for selection capture  
**Scale/Scope**: One Markdown document, one contiguous selection, and one active request session in v1; no diff review, apply flow, or persisted history in this slice

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- [x] The feature remains selection-scoped to one explicit user-created rendered selection in one Markdown document, with structural-boundary blocking preserved.
- [x] Material document changes are still not auto-applied; this slice stops before suggestion review or edit application.
- [x] Provider and logging boundaries stay minimal: no external request occurs during selection capture or draft entry, and submitted payloads are limited to the selected text plus small adjacent context.
- [x] The webview message contract, active request session shape, and local request payload contract are defined in `/specs/002-selection-scoped-edit-request/contracts/selection-request-contract.md` with runtime validation expected at the extension boundary.
- [x] Unit, integration, and manual verification coverage is planned for supported selection rules, anchor creation and revalidation, single-draft gating, payload construction, and privacy-preserving submit behavior.
- [x] The architecture change is already documented in `/architecture/high-level-architecture.md` and `/architecture/adr-002-inlinr-owned-request-capture-and-model-invocation.md`.

**Post-Phase 1 Re-check**: Pass. The research and design artifacts keep the feature inline, selection-first, privacy-bounded, and under Inlinr control without expanding into provider-specific or chat-pane-driven workflows.

## Project Structure

### Documentation (this feature)

```text
specs/002-selection-scoped-edit-request/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── selection-request-contract.md
└── tasks.md
```

### Source Code (repository root)

```text
package.json
tsconfig.json
src/
├── extension.ts
├── commands/
│   └── reopenWithDefaultEditor.ts
├── editors/
│   └── markdownCustomEditorProvider.ts
├── rendering/
│   ├── markdownRenderer.ts
│   └── renderedSelectionMetadata.ts
├── requests/
│   ├── requestPayloadBuilder.ts
│   ├── requestService.ts
│   └── selectionAnchorResolver.ts
├── sessions/
│   └── documentSessionController.ts
└── webview/
    ├── getMarkdownViewerHtml.ts
    ├── viewerProtocol.ts
    └── viewerState.ts

media/
└── markdownViewer/
    ├── selectionRequest.js
    └── styles.css

tests/
├── fixtures/
├── integration/
│   └── selectionScopedEditRequest.test.ts
├── runTest.ts
└── unit/
    ├── requestPayloadBuilder.test.ts
    ├── selectionAnchorResolver.test.ts
    └── selectionSupportPolicy.test.ts
```

**Structure Decision**: Use the existing single VS Code extension project and extend the current
custom-editor architecture rather than introducing a second UI shell or detached request surface.
Keep source-backed rendering, selection anchoring, request construction, and webview messaging in
separate modules so the next features can add suggestion review and apply flow without restructuring
the editor model.

## Complexity Tracking

No constitution deviations or extra complexity justifications are required for this plan.
