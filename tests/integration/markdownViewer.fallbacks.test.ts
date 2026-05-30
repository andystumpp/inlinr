import assert from 'node:assert/strict';
import * as vscode from 'vscode';
import { createViewerStateForDocument, MarkdownCustomEditorProvider } from '../../src/editors/markdownCustomEditorProvider';
import {
  closeAllEditors,
  createMockWebviewPanel,
  getActiveCustomTabInput,
  getExtensionUri,
  getWorkspaceFile,
  openWorkspaceFile,
  openWorkspaceFileWithEditor,
  waitFor
} from './helpers';
import { DocumentSessionController } from '../../src/sessions/documentSessionController';

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

  test('keeps invalid Mermaid content inside a rendered viewer state with block fallback markup', async () => {
    const document = await vscode.workspace.openTextDocument({
      language: 'markdown',
      content: '# Diagram\n\n```mermaid\nthis is not valid mermaid\n```'
    });

    const state = createViewerStateForDocument(document);

    assert.equal(state.kind, 'rendered');
    assert.match(state.html, /data-mermaid-block/);
    assert.match(state.html, /data-mermaid-fallback/);
  });

  test('reopenWithDefaultEditor opens the active custom editor URI with the default editor', async () => {
    const markdownUri = await openWorkspaceFileWithEditor('sample.md', MarkdownCustomEditorProvider.viewType);

    await waitFor(
      () => getActiveCustomTabInput(),
      (input): input is vscode.TabInputCustom =>
        Boolean(input && input.viewType === MarkdownCustomEditorProvider.viewType)
    );

    await vscode.commands.executeCommand('inlinr.reopenWithDefaultEditor');

    await waitFor(
      () => vscode.window.tabGroups.activeTabGroup.activeTab?.input,
      (input): input is vscode.TabInputText =>
        input instanceof vscode.TabInputText && input.uri.toString() === markdownUri.toString()
    );
  });

  test('reopenWithDefaultEditor opens explicit URI with the default editor', async () => {
    const markdownUri = getWorkspaceFile('second.md');

    await vscode.commands.executeCommand('inlinr.reopenWithDefaultEditor', markdownUri);

    await waitFor(
      () => vscode.window.tabGroups.activeTabGroup.activeTab?.input,
      (input): input is vscode.TabInputText =>
        input instanceof vscode.TabInputText && input.uri.toString() === markdownUri.toString()
    );
  });

  test('renders an obvious raw Markdown recovery CTA in viewer header and error state', async () => {
    const provider = new MarkdownCustomEditorProvider(getExtensionUri(), new DocumentSessionController());
    const document = await vscode.workspace.openTextDocument({ language: 'markdown', content: '# Broken\n\u0000' });
    const { panel, webview } = createMockWebviewPanel();

    try {
      await provider.resolveCustomTextEditor(document, panel, new vscode.CancellationTokenSource().token);

      assert.match(
        webview.html,
        /data-testid="viewer-open-raw-markdown"[\s\S]*href="command:inlinr\.reopenWithDefaultEditor"/
      );
      assert.match(
        webview.html,
        /data-testid="viewer-error-open-raw-markdown"[\s\S]*href="command:inlinr\.reopenWithDefaultEditor"/
      );
    } finally {
      panel.dispose();
      provider.dispose();
    }
  });
});