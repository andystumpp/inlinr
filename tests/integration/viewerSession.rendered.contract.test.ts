import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import * as vscode from 'vscode';
import { createViewerStateForDocument } from '../../src/editors/markdownCustomEditorProvider';
import { getMarkdownViewerHtml } from '../../src/webview/getMarkdownViewerHtml';
import { assertValidViewerState } from '../../src/webview/viewerState';
import { getExtensionUri } from './helpers';

suite('Rendered viewer state contract', () => {
  test('produces a valid rendered state for Markdown documents', async () => {
    const document = await vscode.workspace.openTextDocument({
      language: 'markdown',
      content: '# Contract\n\nRendered body\n\n```mermaid\ngraph TD\n  A-->B\n```'
    });

    const state = createViewerStateForDocument(document);

    assertValidViewerState(state);
    assert.equal(state.kind, 'rendered');
    assert.equal(state.previewOnly, true);
    assert.equal(state.sourceMode, false);
    assert.match(state.html, /<h1[^>]*>Contract<\/h1>/);
    assert.match(state.html, /data-mermaid-block/);

    const html = getMarkdownViewerHtml({
      cspSource: 'https://inlinr.test',
      asWebviewUri: (uri: vscode.Uri) => uri
    } as vscode.Webview, getExtensionUri(), state);

    assert.match(html, /node_modules[\\/]mermaid[\\/]dist[\\/]mermaid\.min\.js/);
    assert.match(html, /data-selection-inline-review-root/);
    assert.match(html, /data-selection-request-root/);
  });

  test('selection request popup script includes quick bold and italic actions', () => {
    const scriptPath = path.join(getExtensionUri().fsPath, 'media', 'markdownViewer', 'selectionRequest.js');
    const script = fs.readFileSync(scriptPath, 'utf8');

    assert.match(script, /data-selection-request-format-kind="bold"/);
    assert.match(script, /data-selection-request-format-kind="italic"/);
  });

  test('selection request popup script captures selection from mouse and keyboard interactions', () => {
    const scriptPath = path.join(getExtensionUri().fsPath, 'media', 'markdownViewer', 'selectionRequest.js');
    const script = fs.readFileSync(scriptPath, 'utf8');

    assert.match(script, /document\.addEventListener\('mouseup', captureSelection\)/);
    assert.match(script, /document\.addEventListener\('keyup', captureSelection\)/);
  });
});
