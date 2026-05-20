import assert from 'node:assert/strict';
import * as vscode from 'vscode';
import { MarkdownCustomEditorProvider } from '../../src/editors/markdownCustomEditorProvider';
import { DocumentSessionController } from '../../src/sessions/documentSessionController';
import { closeAllEditors, createMockWebviewPanel, getExtensionUri, getWorkspaceFile } from './helpers';

suite('Markdown viewer opening', () => {
  teardown(async () => {
    await closeAllEditors();
  });

  test('opens Markdown files in the Inlinr custom editor', async () => {
    const provider = new MarkdownCustomEditorProvider(getExtensionUri(), new DocumentSessionController());
    const document = await vscode.workspace.openTextDocument(getWorkspaceFile('sample.md'));
    const { panel, webview } = createMockWebviewPanel();

    await provider.resolveCustomTextEditor(document, panel, new vscode.CancellationTokenSource().token);

    assert.equal(panel.title, 'sample.md Preview');
    assert.match(webview.html, /Inlinr Markdown Viewer/);
    assert.match(webview.html, /This is the first Markdown document\./);

    provider.dispose();
  });
});