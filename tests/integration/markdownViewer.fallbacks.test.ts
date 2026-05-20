import assert from 'node:assert/strict';
import * as vscode from 'vscode';
import { createViewerStateForDocument, MarkdownCustomEditorProvider } from '../../src/editors/markdownCustomEditorProvider';
import { closeAllEditors, getActiveCustomTabInput, openWorkspaceFile, waitFor } from './helpers';

suite('Markdown viewer fallbacks', () => {
  teardown(async () => {
    await closeAllEditors();
  });

  test('keeps non-Markdown files on the default editor path', async () => {
    await openWorkspaceFile('plain.txt');

    await waitFor(
      () => vscode.window.tabGroups.activeTabGroup.activeTab,
      (activeTab) => activeTab.label === 'plain.txt'
    );

    const input = getActiveCustomTabInput();
    assert.ok(!input || input.viewType !== MarkdownCustomEditorProvider.viewType);
  });

  test('maps unsupported Markdown content to an in-viewer error state', async () => {
    const document = await vscode.workspace.openTextDocument({
      language: 'markdown',
      content: '# Broken\n\u0000'
    });

    const state = createViewerStateForDocument(document);

    assert.equal(state.kind, 'error');
    assert.equal(state.reasonCode, 'unsupported-content');
    assert.equal(state.canFallbackToDefaultEditor, false);
  });
});