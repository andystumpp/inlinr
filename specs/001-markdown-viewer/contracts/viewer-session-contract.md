# Contract: Markdown Viewer Session

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
- Raw provider responses are not part of this contract in v1.
- Any future extension of this contract for editing or selection must be versioned intentionally and documented alongside validator changes.

## Webview Capability Contract

- `enableScripts`: Disabled unless implementation proves a strict need.
- `localResourceRoots`: Restricted to the minimal extension-controlled asset locations needed for the viewer.
- CSP: `default-src 'none'` baseline with only the minimal sources re-enabled for styles and approved local resources.
- External provider or network access is not part of the v1 viewer contract.

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
- Render failures must remain in the Inlinr viewer and must not reopen the default Markdown editor automatically.
