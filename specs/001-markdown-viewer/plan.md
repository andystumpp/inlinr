# Implementation Plan: Markdown Viewer Opening

**Branch**: `001-markdown-viewer` | **Date**: 2026-05-19 | **Spec**: `/specs/001-markdown-viewer/spec.md`
**Input**: Feature specification from `/specs/001-markdown-viewer/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/plan-template.md` for the execution workflow.

## Summary

Deliver the first Inlinr document surface as a VS Code custom Markdown editor that opens `.md`
files directly into the current editor tab, renders Markdown locally as preview-only content,
keeps the underlying `TextDocument` canonical, and shows an in-viewer error state instead of
falling back to the default Markdown editor. Phase 0 research locks the VS Code extension stack,
local render/security posture, and test approach; Phase 1 design defines the document/session
model, the extension-to-webview contract, and the manual verification flow for the initial plugin.

## Technical Context

**Language/Version**: TypeScript 5.x for a VS Code extension running on the Node.js-based extension host  
**Primary Dependencies**: `vscode`, `markdown-it`, webview HTML/CSS assets, `@vscode/test-cli`, `@vscode/test-electron`, Mocha  
**Storage**: N/A for persisted product state; canonical state lives in the open `TextDocument`  
**Testing**: VS Code extension integration tests plus focused unit tests and manual editor verification  
**Target Platform**: VS Code Desktop extension host on Windows, macOS, and Linux local workspaces
**Project Type**: VS Code desktop extension with a custom text editor and webview UI  
**Performance Goals**: Open and render typical Markdown documents within 2 seconds; refresh the visible viewer promptly after document changes  
**Constraints**: Must replace the current editor tab for `.md` files; preview-only in v1; no provider or network calls on open; strict CSP and minimal webview capabilities; no automatic fallback to the default Markdown editor on render failure  
**Scale/Scope**: Single Markdown document per viewer session; multiple editor instances may share one `TextDocument`; first slice is limited to viewing, refresh, identity, and failure states

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- [x] The feature remains explicitly document-scoped: one user-opened Markdown document is shown in the current editor tab, and broader workspace automation stays out of scope.
- [x] No material document mutations occur in v1, so review-before-apply remains preserved by non-applicability.
- [x] Rendering stays local; provider, logging, and persistence boundaries do not expose document content during open or refresh.
- [x] The custom editor and viewer-state contract is defined in `/specs/001-markdown-viewer/contracts/viewer-session-contract.md`.
- [x] Unit, integration, and manual verification coverage is planned for rendering, routing, non-Markdown fallback, and failure behavior.
- [x] The architecture update and durable decision are already recorded in `/architecture/high-level-architecture.md` and `/architecture/adr-001-custom-markdown-editor-surface.md`.

**Post-Phase 1 Re-check**: Pass. Research and design artifacts keep the feature local, preview-only, privacy-bounded, and document-scoped.

## Project Structure

### Documentation (this feature)

```text
specs/001-markdown-viewer/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── viewer-session-contract.md
└── tasks.md
```

### Source Code (repository root)
```text
package.json
tsconfig.json
src/
├── extension.ts
├── editors/
│   └── markdownCustomEditorProvider.ts
├── sessions/
│   └── documentSessionController.ts
├── rendering/
│   └── markdownRenderer.ts
├── webview/
│   ├── getMarkdownViewerHtml.ts
│   └── viewerState.ts
└── commands/
    └── reopenWithDefaultEditor.ts

media/
└── markdownViewer/

tests/
├── integration/
│   └── markdownViewer.opening.test.ts
└── unit/
    ├── markdownRenderer.test.ts
    └── documentSessionController.test.ts
```

**Structure Decision**: Use a single VS Code extension project. Keep extension-host logic
separate from the webview render helpers so the initial viewer can stay simple while the later
editing flow adds selection, request, review, and apply services without restructuring the document
surface.

## Complexity Tracking

No constitution deviations or extra complexity justifications are required for this plan.
