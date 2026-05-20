import assert from 'node:assert/strict';
import * as vscode from 'vscode';
import { createViewerStateForDocument } from '../../src/editors/markdownCustomEditorProvider';
import { assertValidViewerState } from '../../src/webview/viewerState';

suite('Error viewer state contract', () => {
  test('produces a valid error state when rendering fails', async () => {
    const document = await vscode.workspace.openTextDocument({
      language: 'markdown',
      content: 'bad\u0000content'
    });

    const state = createViewerStateForDocument(document);

    assertValidViewerState(state);
    assert.equal(state.kind, 'error');
    assert.equal(state.reasonCode, 'unsupported-content');
    assert.equal(state.previewOnly, true);
    assert.equal(state.canFallbackToDefaultEditor, false);
  });
});