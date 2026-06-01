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

function stripMarkdownExtension(title: string): string {
  const strippedTitle = title.replace(/\.(?:md|markdown)$/i, '');
  return strippedTitle.length > 0 ? strippedTitle : title;
}

function middleTruncate(value: string, maxLength: number): string {
  if (value.length <= maxLength) {
    return value;
  }

  const ellipsis = '...';
  const remainingLength = maxLength - ellipsis.length;
  const startLength = Math.ceil(remainingLength / 2);
  const endLength = Math.floor(remainingLength / 2);

  return `${value.slice(0, startLength)}${ellipsis}${value.slice(-endLength)}`;
}

function getDocumentPathLabel(uriValue: string): string {
  try {
    const parsedUri = vscode.Uri.parse(uriValue);

    if (parsedUri.scheme === 'file') {
      return parsedUri.fsPath || parsedUri.path || uriValue;
    }

    if (parsedUri.scheme === 'untitled') {
      return parsedUri.path || uriValue;
    }

    return parsedUri.fsPath || parsedUri.path || parsedUri.toString(true);
  } catch {
    return uriValue;
  }
}

function renderBody(state: ViewerState): string {
  if (state.kind === 'rendered') {
    return `
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
      <p class="viewer-error-recovery">
        <a
          class="viewer-link-button"
          data-testid="viewer-error-open-raw-markdown"
          href="command:inlinr.reopenWithDefaultEditor"
        >
          Open Raw Markdown
        </a>
      </p>
      <dl class="viewer-error-meta">
        <div>
          <dt>Reason</dt>
          <dd>${escapeHtml(state.reasonCode)}</dd>
        </div>
        <div>
          <dt>Recovery</dt>
          <dd>Open raw Markdown in the default text editor.</dd>
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
  const documentDisplayTitle = middleTruncate(stripMarkdownExtension(state.title), 44);
  const documentPathLabel = getDocumentPathLabel(state.uri);
  const pageTitle = `${state.title} · Inlinr Markdown Viewer`;

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
    <title>${escapeHtml(pageTitle)}</title>
  </head>
  <body class="viewer-shell" data-state-kind="${state.kind}" data-active-request-state="${state.kind === 'rendered' && state.activeRequest ? state.activeRequest.validationState : 'none'}" data-first-action-guidance-state="${state.kind === 'rendered' && state.firstActionGuidance ? state.firstActionGuidance.completionState : 'hidden'}">
    <div class="first-action-guidance-root" data-first-action-guidance-root hidden></div>
    <header class="viewer-header">
      <div class="viewer-header-content" title="${escapeHtml(documentPathLabel)}">
        <h1 class="viewer-title">${escapeHtml(documentDisplayTitle)}</h1>
      </div>
      <a class="viewer-link-button" data-testid="viewer-open-raw-markdown" href="command:inlinr.reopenWithDefaultEditor">
        Open Raw Markdown
      </a>
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
