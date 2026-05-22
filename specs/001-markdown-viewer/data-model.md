# Data Model: Markdown Viewer Opening

**Propagated**: 2026-05-22 — Updated from spec.md refinement for local Mermaid diagram rendering and safe Mermaid block fallback behavior.

## MarkdownDocument

- Purpose: Represents the canonical Markdown source that Inlinr opens and displays.
- Source: VS Code `TextDocument`.
- Fields:
  - `uri`: Unique document URI.
  - `displayName`: Human-readable file name shown in the viewer.
  - `languageId`: Expected to resolve to Markdown.
  - `version`: VS Code document version used to coordinate refresh.
  - `text`: Current Markdown source content.
  - `isDirty`: Whether the source document has unsaved changes.
- Validation rules:
  - Must come from a supported Markdown open path.
  - Must remain the canonical source of truth for the viewer session.
  - Must not be mutated by the v1 viewer flow.

## OpenRequest

- Purpose: Captures a user action that attempts to open a document in Inlinr.
- Fields:
  - `documentUri`: Target file URI.
  - `origin`: Supported VS Code open path that triggered the request; Explorer clicks are the required v1 origin.
  - `requestedViewType`: Expected custom editor view type for Inlinr.
- Validation rules:
  - Must target a Markdown document selected for the custom editor.
  - Must support Explorer-triggered Markdown opens in v1.
  - Must not rewrite non-Markdown open behavior.

## ViewerSession

- Purpose: Tracks one visible Inlinr editor instance for a Markdown document.
- Fields:
  - `sessionId`: Unique in-memory session identifier.
  - `documentUri`: Back-reference to the canonical `MarkdownDocument`.
  - `viewType`: Inlinr custom editor view type.
  - `editorColumn`: Current VS Code editor column.
  - `state`: `resolving | rendered | error | disposed`.
  - `previewOnly`: Always `true` in v1.
- Validation rules:
  - Must be hosted in the current editor tab for the open request.
  - Must not expose source editing controls in v1.
  - May share the same `MarkdownDocument` with another session if the editor is split.

## RenderedPreview

- Purpose: Represents the successful rendered output sent to the viewer surface.
- Fields:
  - `documentUri`: Source document URI.
  - `documentVersion`: Source version used for the render.
  - `title`: Viewer title or document label.
  - `html`: Rendered preview HTML.
  - `containsMermaid`: Whether the rendered preview includes Mermaid diagram blocks.
  - `generatedLocally`: Always `true` in v1.
- Validation rules:
  - Must be derived only from local document content.
  - May include locally rendered Mermaid diagrams or local Mermaid fallback blocks.
  - Must comply with the webview CSP and resource restrictions.
  - Must not require provider calls or external content generation.

## MermaidDiagramBlock

- Purpose: Represents one Mermaid fenced code block discovered during local Markdown rendering.
- Fields:
  - `documentUri`: Source document URI.
  - `documentVersion`: Source version used for diagram handling.
  - `sourceFence`: Original Mermaid fenced block source.
  - `renderState`: `rendered | fallback`.
  - `fallbackMessage`: Optional user-visible fallback text when the block cannot be rendered safely.
- Validation rules:
  - Must be derived only from local Markdown content.
  - Must not trigger provider or network calls.
  - `renderState = fallback` must preserve the rest of the surrounding Markdown preview.

## RenderFailure

- Purpose: Represents a failed attempt to show Markdown content in the viewer.
- Fields:
  - `documentUri`: Source document URI.
  - `documentVersion`: Source version that failed.
  - `message`: Human-readable error for the in-viewer state.
  - `reasonCode`: `missing-document | unreadable-document | render-failed | unsupported-content`.
  - `recoverable`: Whether the same viewer can recover after another refresh.
- Validation rules:
  - Must keep the user inside the Inlinr viewer.
  - Must not silently reopen the default Markdown editor.
  - Must never modify the source document.

## Relationships

- One `MarkdownDocument` can have one or more `ViewerSession` instances.
- One `OpenRequest` targets exactly one `MarkdownDocument`.
- One `ViewerSession` resolves to either one `RenderedPreview` or one `RenderFailure` at any point in time.
- One `RenderedPreview` may contain zero or more `MermaidDiagramBlock` instances.

## State Transitions

### ViewerSession

- `resolving -> rendered`: Markdown content renders successfully.
- `resolving -> error`: Document load or render fails.
- `rendered -> resolving`: Source document changes and the viewer refreshes.
- `error -> resolving`: A retry or source change triggers another render attempt.
- `rendered -> disposed`: The editor tab is closed.
- `error -> disposed`: The editor tab is closed.

### MarkdownDocument Refresh

- `version n -> version n+1`: The underlying `TextDocument` changes.
- Matching viewer sessions must refresh from the updated document version.
