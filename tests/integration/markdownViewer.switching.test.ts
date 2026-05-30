import assert from 'node:assert/strict';
import * as vscode from 'vscode';
import { MarkdownCustomEditorProvider } from '../../src/editors/markdownCustomEditorProvider';
import { DocumentSessionController } from '../../src/sessions/documentSessionController';
import {
  closeAllEditors,
  createMockWebviewPanel,
  getExtensionUri,
  getWorkspaceFile,
  openWorkspaceFile,
  waitFor
} from './helpers';

suite('Markdown viewer switching', () => {
  teardown(async () => {
    await closeAllEditors();
  });

  test('updates the active custom editor when a second Markdown file opens', async () => {
    const provider = new MarkdownCustomEditorProvider(getExtensionUri(), new DocumentSessionController());
    const firstDocument = await vscode.workspace.openTextDocument(getWorkspaceFile('sample.md'));
    const secondDocument = await vscode.workspace.openTextDocument(getWorkspaceFile('second.md'));
    const firstPanel = createMockWebviewPanel();
    const secondPanel = createMockWebviewPanel();
    const token = new vscode.CancellationTokenSource().token;

    await provider.resolveCustomTextEditor(firstDocument, firstPanel.panel, token);
    await provider.resolveCustomTextEditor(secondDocument, secondPanel.panel, token);

    assert.equal(firstPanel.panel.title, 'sample.md Preview');
    assert.equal(secondPanel.panel.title, 'second.md Preview');
    assert.match(secondPanel.webview.html, /Second Document/);
    assert.doesNotMatch(secondPanel.webview.html, /This is the first Markdown document\./);

    provider.dispose();
  });

  test('openWithInlinrViewer reopens an active Markdown text editor in the Inlinr viewer', async () => {
    const markdownUri = await openWorkspaceFile('sample.md');

    await vscode.commands.executeCommand('inlinr.openWithInlinrViewer');

    await waitFor(
      () => vscode.window.tabGroups.activeTabGroup.activeTab?.input,
      (input): input is vscode.TabInputCustom =>
        input instanceof vscode.TabInputCustom &&
        input.viewType === MarkdownCustomEditorProvider.viewType &&
        input.uri.toString() === markdownUri.toString()
    );
  });

  test('openWithInlinrViewer reopens an explicit Markdown URI in the Inlinr viewer', async () => {
    const markdownUri = getWorkspaceFile('second.md');

    await vscode.commands.executeCommand('inlinr.openWithInlinrViewer', markdownUri);

    await waitFor(
      () => vscode.window.tabGroups.activeTabGroup.activeTab?.input,
      (input): input is vscode.TabInputCustom =>
        input instanceof vscode.TabInputCustom &&
        input.viewType === MarkdownCustomEditorProvider.viewType &&
        input.uri.toString() === markdownUri.toString()
    );
  });
});