# Quickstart: Markdown Viewer Opening

## Goal

Stand up the first Inlinr plugin slice as a VS Code custom Markdown editor that replaces the default Markdown editor tab with a preview-only Inlinr surface.

## Local setup

1. Run `npm install` from the repository root.
2. Run `npm run compile`.
3. Open Run and Debug, choose `Run Inlinr Extension`, and press `F5` to launch the Extension Development Host.

## Implementation Outline

1. Scaffold or extend the repository into a TypeScript VS Code extension project.
2. Add a custom editor contribution for `*.md` with Inlinr as the default editor.
3. Register a `CustomTextEditorProvider` during extension activation.
4. Implement a document session controller that maps a `TextDocument` to one or more visible Inlinr editor instances.
5. Build a local Markdown render pipeline that converts document text into rendered preview HTML.
6. Configure the webview with a strict CSP and the minimum required capabilities.
7. Render the preview into the current editor tab and include document identity in the surface.
8. Subscribe to `onDidChangeTextDocument` and refresh matching viewer sessions from the canonical document state.
9. Show an in-viewer error state on render failure instead of falling back to the default Markdown editor.
10. Keep editing controls, AI actions, and source-mode display out of scope for this slice.

## Manual Verification Flow

1. Launch the extension using the Extension Development Host workflow created by the scaffold.
2. Open a Markdown file from Explorer and confirm the current editor tab becomes the Inlinr viewer.
3. Open a second Markdown file from Explorer and confirm the viewer updates to the new document.
4. Open a non-Markdown file and confirm the normal editor behavior is unchanged.
5. Open a Markdown document that contains a null character from disk, or rely on the automated error-state tests, and confirm the user remains in the Inlinr viewer with a clear error state.
6. Confirm no document content is sent to external services when opening or refreshing the viewer.

## Test Targets

- Unit tests for Markdown rendering helpers and document-session coordination.
- Integration tests for provider resolution, custom editor state generation, non-Markdown fallback, refresh behavior, and in-viewer error handling.
- Manual verification for accessibility, theme compatibility, and the main open flows.

## Notes

- Do not add provider or AI request plumbing in this slice.
- Keep the webview as capability-minimal as possible.
- Explorer-default routing remains part of manual verification because the VS Code test host does not reliably emulate Explorer click behavior for custom editors.
- Use the current plan as the implementation source of truth for structure and constraints.
