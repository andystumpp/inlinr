# Implementation Plan: Execute Selection Request

**Branch**: `003-execute-selection-request` | **Date**: 2026-05-20 | **Spec**: `/specs/003-execute-selection-request/spec.md`
**Input**: Feature specification from `/specs/003-execute-selection-request/spec.md`
**Propagated**: 2026-05-23 — Updated from spec.md refinement to require that returned suggestions render in the main document flow at the targeted location itself rather than in a detached review card or popup-like review surface, with the original targeted passage remaining visible and struck through during review.

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/plan-template.md` for the execution workflow.

## Summary

Open a lightweight request popup for any non-empty contiguous document selection, including list items and chapter-scale selections, submit that selection through an extension-host service that uses the supported VS Code Language Model API boundary, send the full document plus explicit range markers, validate one returned full-document draft, extract one bounded suggestion or deletion for the anchored Markdown selection, ignore unrelated out-of-range draft changes, render the returned diff directly in the main document flow at the targeted location itself rather than in a detached review card, keep the original targeted passage visible with a strikethrough treatment during review, apply it only after anchor revalidation confirms the same target range is still safe to mutate, and then allow a fresh follow-up scoped request cycle in the same editor session against the current document state.

## Technical Context

**Language/Version**: TypeScript 5.8.x for the VS Code extension host and minimal browser JavaScript in the webview  
**Primary Dependencies**: `vscode` API (`^1.90.0`), `markdown-it`, Mocha, `@vscode/test-cli`, `@vscode/test-electron`, existing custom editor and request/session modules  
**Storage**: N/A for persisted product state; request execution, suggestion review, and apply state remain in memory against the canonical open `TextDocument`  
**Testing**: `npm run compile`, `npm run test:integration`, `npm run test:unit`, and targeted manual verification in the Extension Development Host  
**Target Platform**: VS Code Desktop extension host on Windows, macOS, and Linux local workspaces  
**Project Type**: Single VS Code desktop extension with a custom text editor, webview UI, and extension-host services  
**Performance Goals**: Show the request popup for valid selections immediately, show pending feedback within 1 second of submit, keep review-state transitions, reject handling, anchor revalidation, and apply/reject actions effectively immediate for typical Markdown documents, and allow a follow-up request cycle to start without editor reload after apply or reject  
**Constraints**: One Markdown document, one contiguous selection range, and one active execution/review flow at a time in v1; any non-empty contiguous visible selection should open the request popup; the popup is request-entry only and does not preview selected content; normalized output is one bounded replacement or deletion extracted from a marker-preserving full-document draft; review is shown as an inline diff in the main document flow at the targeted location itself rather than in a detached review card, floating panel, or popup-like review surface, and the original targeted passage remains visible with a strikethrough treatment during review; list-item deletion may expand the effective scoped mutation to the containing list item when needed to preserve valid list structure; out-of-range draft changes are ignored rather than applied; completed request state must clear cleanly before the next cycle begins; unavailable capability fails closed with no automatic fallback  
**Scale/Scope**: One anchored request execution, one validated full-document draft, one normalized suggestion proposal, and one apply decision at a time, with repeated consecutive request cycles supported against the current document state in the same editor session and contiguous selections ranging from single list items to multiple chapters; no cross-file edits, persisted execution history, or background orchestration in this slice

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- [x] The feature remains selection-scoped to one user-selected contiguous Markdown range in one open document.
- [x] The user review and apply flow remains mandatory for material document changes.
- [x] Provider, logging, and persistence boundaries keep document exposure to the active Markdown document required for the current scoped edit flow.
- [x] Command, provider, suggestion, and edit-application contracts are defined or updated with runtime validation at affected boundaries.
- [x] Tests and manual verification cover anchoring, marker preservation, scoped extraction, deletion proposals, bounded edit application, unavailable capability, malformed or drifted suggestion handling, and now must also cover list-item selection, chapter-scale selection, popup-entry behavior, and document-inline diff review rendered in-flow at the targeted document location rather than in a detached review card.
- [x] No additional architecture update or ADR is required for this slice because it stays within ADR-002 and ADR-003 and adds no cross-file scope, persisted state, background workflow, or fallback provider abstraction.

**Post-Phase 1 Re-check**: Pass. The research, data model, contract, and quickstart artifacts keep the feature selection-scoped, review-before-apply, bounded-at-apply, and aligned with the existing Inlinr host/webview and provider-boundary decisions.

## Project Structure

### Documentation (this feature)

```text
specs/003-execute-selection-request/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── selection-request-execution-contract.md
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
│   ├── executionService.ts
│   ├── suggestionNormalizer.ts
│   ├── editApplicationService.ts
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
    ├── executionService.test.ts
    ├── suggestionNormalizer.test.ts
    └── editApplicationService.test.ts
```

**Structure Decision**: Extend the existing single-project VS Code extension rather than introducing a second provider layer or detached review surface. Keep execution orchestration, full-document draft validation, suggestion normalization, effective scoped mutation, and apply-time mutation in extension-host services; keep lightweight request-entry UI and in-flow document-inline diff interactions in the webview; and reuse the current request payload, anchor, selection metadata, and session infrastructure so the execution slice stays incremental and testable.

## Complexity Tracking

No constitution deviations are required for this plan. The broadened selection scope, simplified popup, in-flow document-first review requirement, and effective list-item deletion behavior all remain within the existing session-controller, provider, rendering, and webview boundaries and do not require a new architecture layer.
