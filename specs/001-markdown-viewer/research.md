# Research: Markdown Viewer Opening

**Propagated**: 2026-05-22 — Updated from spec.md refinement for local Mermaid diagram rendering and safe Mermaid block fallback behavior.

## Decision 1: Implement the initial plugin as a TypeScript VS Code extension

- Decision: Use a TypeScript-based VS Code desktop extension scaffold for the initial Inlinr plugin.
- Rationale: Official VS Code guidance treats TypeScript as the default developer experience for extensions, and the custom editor, webview, and test samples all assume typed extension-host code. TypeScript also helps keep the future extension-to-webview and selection/edit contracts explicit.
- Alternatives considered: Plain JavaScript was simpler to start but weaker for contract-heavy editor and webview boundaries. A separate desktop or web app was rejected because the product is explicitly VS Code-first.

## Decision 2: Use `CustomTextEditorProvider` as the document model boundary

- Decision: Build the Markdown surface on `CustomTextEditorProvider` instead of `CustomEditorProvider` or `CustomReadonlyEditorProvider`.
- Rationale: `.md` is a text format, and the VS Code custom editor docs recommend `CustomTextEditorProvider` for text-based files because VS Code then keeps `TextDocument` as the canonical model and handles save, hot exit, and standard text lifecycle behavior. This matches ADR 001 and keeps the later editing surface on the same document model.
- Alternatives considered: `CustomReadonlyEditorProvider` was simpler for a preview-only slice but would create migration pressure once the same surface needs editing. `CustomEditorProvider` was rejected because it would force Inlinr to own save and backup behavior unnecessarily for a text file.

## Decision 3: Render Markdown locally with a minimal extension-host pipeline

- Decision: Render Markdown locally inside the extension using a lightweight Markdown parser such as `markdown-it`, with raw HTML disabled in v1, and add a local Mermaid rendering path for supported Mermaid fenced blocks.
- Rationale: The spec requires that opening a Markdown file not send document content to external providers or services. A local render pipeline satisfies that requirement, keeps the viewer fast, and avoids coupling the initial document surface to AI infrastructure. Supporting Mermaid at the same local boundary keeps the viewer useful for technical documents while preserving the same privacy and trust posture. Disabling raw HTML in v1 still narrows the webview attack surface and avoids adding a larger sanitizer stack to the first slice.
- Alternatives considered: Reusing the built-in Markdown preview was faster but would not establish Inlinr's own durable editor surface. Rendering raw HTML with a sanitizer stack was viable later but added security and implementation complexity not needed for the first slice. Deferring Mermaid entirely was rejected because the refined viewer spec now treats Mermaid as part of the expected rendered Markdown experience.

## Decision 4: Keep the webview capability-minimal in v1

- Decision: Use a webview with strict CSP, narrow `localResourceRoots`, and no scripts unless the chosen local Mermaid rendering path proves a strict need, in which case scripts must remain limited to local viewer rendering only.
- Rationale: Official webview guidance recommends enabling the minimum capabilities required. A preview-only Markdown viewer should still prefer extension-driven HTML updates and avoid message passing or retained background state. Mermaid is the one refined rendering requirement that may justify a narrowly scoped local script path depending on the implementation choice, so the correct posture is capability-minimal by default with a documented exception only when needed for local diagram rendering.
- Alternatives considered: Enabling scripts from day one would make later interactivity easier but expands the attack surface immediately. Rejecting any script capability categorically would constrain viable local Mermaid rendering paths without improving privacy if the rendering still stays fully local. `retainContextWhenHidden` was rejected for v1 because the official guidance warns about memory overhead and the viewer can be re-rendered from the canonical document state.

## Decision 5: Test the feature as a VS Code extension, not as a detached UI widget

- Decision: Use VS Code extension integration tests with `@vscode/test-cli`, `@vscode/test-electron`, and Mocha, plus focused unit tests for renderer and session helpers.
- Rationale: The critical behavior is editor routing, custom editor resolution, document refresh, and non-Markdown fallback inside the VS Code host. These are extension behaviors, so the primary automated checks need to run in the Extension Development Host. Unit tests still add value for local render and session logic.
- Alternatives considered: Manual verification alone was rejected because the spec has multiple required routing and failure behaviors. Browser-only tests were rejected because they would not validate VS Code custom editor integration.

## Decision 6: Use stateless refresh from `TextDocument` updates

- Decision: Treat the `TextDocument` as the single source of truth and re-render viewer instances when that document changes.
- Rationale: Official custom text editor guidance expects the extension to respond to `onDidChangeTextDocument` and update all associated views. This model also supports future split editors and later editing capabilities without adding separate persisted viewer state in v1.
- Alternatives considered: Keeping a separate mutable render model inside the webview was rejected because it would drift from the canonical document and complicate later review and apply flows.

## Decision 7: Fail Mermaid blocks safely without failing the whole viewer

- Decision: Treat Mermaid block failures as local diagram-level fallback conditions when the surrounding Markdown can still render, and reserve full viewer error states for document-level failures.
- Rationale: The refined spec requires invalid or unsupported Mermaid content to preserve the rest of the document preview. This keeps the viewer trustworthy for mixed Markdown documents where only one diagram block is problematic and avoids over-escalating one local rendering failure into a full document failure.
- Alternatives considered: Failing the entire viewer on any Mermaid issue was simpler to implement but violates the refined fallback behavior. Leaving invalid Mermaid as silent raw source was rejected because it hides the failure boundary instead of making it explicit in the viewer.
