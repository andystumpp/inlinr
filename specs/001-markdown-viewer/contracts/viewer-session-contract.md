# Contract: Markdown Viewer Session

**Propagated**: 2026-05-22 — Updated from spec.md refinement for local Mermaid diagram rendering and safe Mermaid block fallback behavior.

## Purpose

Define the stable interface boundaries for the first Inlinr Markdown viewer slice.

## Custom Editor Registration Contract

| Field | Value |
|---|---|
| `viewType` | `inlinr.markdownViewer` |
| `displayName` | `Inlinr Markdown Viewer` |
| `selector` | `*.md` |
| `priority` | `default` |
| Activation expectation | `onCustomEditor:inlinr.markdownViewer` |

Rules:

- The custom editor must become the default open path for targeted Markdown files in v1.
- Non-Markdown files must keep their existing default open behavior.
- The editor must open in the current editor tab rather than a secondary surface.

## Extension-To-Webview State Contract

The extension owns document parsing, render decisions, and failure handling. The webview receives a fully prepared view state.

### Rendered State

```ts
interface ViewerRenderedState {
  kind: 'rendered';
  uri: string;
  title: string;
  documentVersion: number;
  previewOnly: true;
  sourceMode: false;
  canFallbackToDefaultEditor: false;
  html: string;
}
```

### Error State

```ts
interface ViewerErrorState {
  kind: 'error';
  uri: string;
  title: string;
  documentVersion: number;
  previewOnly: true;
  canFallbackToDefaultEditor: false;
  message: string;
  reasonCode: 'missing-document' | 'unreadable-document' | 'render-failed' | 'unsupported-content';
}
```

### Contract Rules

- All state passed to the webview must be JSON-serializable.
- `html` must be produced locally from the canonical Markdown `TextDocument`.
- `html` may include locally rendered Mermaid diagram output and local in-viewer fallback markup for Mermaid blocks that cannot be rendered safely.
- Raw provider responses are not part of this contract in v1.
- Any future extension of this contract for editing or selection must be versioned intentionally and documented alongside validator changes.

## Webview Capability Contract

- `enableScripts`: Disabled unless the chosen local Mermaid rendering path proves a strict need.
- `localResourceRoots`: Restricted to the minimal extension-controlled asset locations needed for the viewer.
- CSP: `default-src 'none'` baseline with only the minimal sources re-enabled for styles, approved local resources, and any strictly local Mermaid rendering assets that prove necessary.
- External provider or network access is not part of the v1 viewer contract.

Rules:

- Any Mermaid rendering capability enabled in the webview must remain local to the extension package and must not introduce network fetches or external provider access.
- Mermaid rendering failures that affect only one block must resolve to local fallback markup inside the rendered viewer state rather than forcing a document-level error state.

## Webview-To-Extension Contract

No webview-to-extension message channel is required for the initial preview-only slice.

If later editing or richer interactions require messages, a follow-up contract must define:

- message types
- payload schemas
- validation rules
- versioning behavior

## Document Refresh Contract

- The canonical source is the VS Code `TextDocument`.
- Viewer refresh is triggered from matching `onDidChangeTextDocument` events.
- A refresh must replace stale rendered state with either a new rendered state or an error state for the updated document version.
- A refresh may replace stale Mermaid diagram output with either freshly rendered diagram output or local fallback markup for individual Mermaid blocks.
- Render failures must remain in the Inlinr viewer and must not reopen the default Markdown editor automatically.
