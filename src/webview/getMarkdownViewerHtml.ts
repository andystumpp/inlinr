import * as vscode from 'vscode';
import { assertValidViewerState, type ViewerState } from './viewerState';

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function escapeJsonForHtml(value: string): string {
  return value.replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/&/g, '\\u0026');
}

function renderBody(state: ViewerState): string {
  if (state.kind === 'rendered') {
    return `
      <aside class="first-action-guidance-root" data-first-action-guidance-root hidden></aside>
      <article class="viewer-document markdown-body" data-selection-mode="${state.selectionMode}">${state.html}</article>
      <section class="selection-inline-review-root" data-selection-inline-review-root hidden></section>
      <aside class="selection-request-root" data-selection-request-root hidden></aside>
    `;
  }

  return `
    <section class="viewer-error" role="alert" aria-live="polite">
      <p class="viewer-error-badge">Render failed</p>
      <h2 class="viewer-error-title">Preview unavailable</h2>
      <p class="viewer-error-message">${escapeHtml(state.message)}</p>
      <dl class="viewer-error-meta">
        <div>
          <dt>Reason</dt>
          <dd>${escapeHtml(state.reasonCode)}</dd>
        </div>
        <div>
          <dt>Recovery</dt>
          <dd>Run Inlinr: Reopen With Default Text Editor from the Command Palette.</dd>
        </div>
      </dl>
    </section>
  `;
}

export function getMarkdownViewerHtml(
  webview: vscode.Webview,
  extensionUri: vscode.Uri,
  state: ViewerState
): string {
  assertValidViewerState(state);

  const stylesheetUri = webview.asWebviewUri(
    vscode.Uri.joinPath(extensionUri, 'media', 'markdownViewer', 'styles.css')
  );
  const mermaidScriptUri = webview.asWebviewUri(
    vscode.Uri.joinPath(extensionUri, 'node_modules', 'mermaid', 'dist', 'mermaid.min.js')
  );
  const selectionScriptUri = webview.asWebviewUri(
    vscode.Uri.joinPath(extensionUri, 'media', 'markdownViewer', 'selectionRequest.js')
  );
  const serializedState = escapeJsonForHtml(JSON.stringify(state));

  const csp = [
    "default-src 'none'",
    `style-src ${webview.cspSource}`,
    `script-src ${webview.cspSource}`,
    `img-src ${webview.cspSource} data:`,
    `font-src ${webview.cspSource}`
  ].join('; ');

  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta http-equiv="Content-Security-Policy" content="${csp}" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="color-scheme" content="light dark" />
    <link rel="stylesheet" href="${stylesheetUri}" />
    <title>${escapeHtml(state.title)}</title>
  </head>
  <body class="viewer-shell" data-state-kind="${state.kind}" data-active-request-state="${state.kind === 'rendered' && state.activeRequest ? state.activeRequest.validationState : 'none'}" data-first-action-guidance-state="${state.kind === 'rendered' && state.firstActionGuidance ? state.firstActionGuidance.completionState : 'hidden'}">
    <header class="viewer-header">
      <p class="viewer-kicker">Inlinr Markdown Viewer</p>
      <h1 class="viewer-title">${escapeHtml(state.title)}</h1>
      <p class="viewer-meta">${escapeHtml(state.uri)} | Version ${state.documentVersion} | Preview only</p>
    </header>
    <main class="viewer-main">
      ${renderBody(state)}
    </main>
    <script id="inlinr-viewer-state" type="application/json">${serializedState}</script>
    <script src="${mermaidScriptUri}" defer></script>
    <script src="${selectionScriptUri}" defer></script>
  </body>
</html>`;
}
