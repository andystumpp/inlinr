import assert from 'node:assert/strict';
import * as vscode from 'vscode';
import { createViewerStateForDocument } from '../../src/editors/markdownCustomEditorProvider';
import { assertValidViewerState } from '../../src/webview/viewerState';

suite('Rendered viewer state contract', () => {
  test('produces a valid rendered state for Markdown documents', async () => {
    const document = await vscode.workspace.openTextDocument({
      language: 'markdown',
      content: '# Contract\n\nRendered body'
    });

    const state = createViewerStateForDocument(document);

    assertValidViewerState(state);
    assert.equal(state.kind, 'rendered');
    assert.equal(state.previewOnly, true);
    assert.equal(state.sourceMode, false);
    assert.match(state.html, /<h1>Contract<\/h1>/);
  });
});