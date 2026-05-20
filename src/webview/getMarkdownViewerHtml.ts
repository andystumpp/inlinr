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

function renderBody(state: ViewerState): string {
  if (state.kind === 'rendered') {
    return `<article class="viewer-document markdown-body">${state.html}</article>`;
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

  const csp = [
    "default-src 'none'",
    `style-src ${webview.cspSource}`,
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
  <body class="viewer-shell" data-state-kind="${state.kind}">
    <header class="viewer-header">
      <p class="viewer-kicker">Inlinr Markdown Viewer</p>
      <h1 class="viewer-title">${escapeHtml(state.title)}</h1>
      <p class="viewer-meta">${escapeHtml(state.uri)} | Version ${state.documentVersion} | Preview only</p>
    </header>
    <main class="viewer-main">
      ${renderBody(state)}
    </main>
  </body>
</html>`;
}