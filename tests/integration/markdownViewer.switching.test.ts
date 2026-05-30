import assert from 'node:assert/strict';
import * as vscode from 'vscode';
import { MarkdownCustomEditorProvider } from '../../src/editors/markdownCustomEditorProvider';
import { FirstActionGuidanceState } from '../../src/onboarding/firstActionGuidanceState';
import { DocumentSessionController } from '../../src/sessions/documentSessionController';
import { closeAllEditors, createMockMemento, createMockWebviewPanel, getExtensionUri, getWorkspaceFile } from './helpers';

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

  test('keeps first-action guidance suppressed for returning users across document switches', async () => {
    const guidanceState = new FirstActionGuidanceState(createMockMemento());
    await guidanceState.markCompleted('dismissed');

    const provider = new MarkdownCustomEditorProvider(
      getExtensionUri(),
      new DocumentSessionController(),
      undefined,
      undefined,
      undefined,
      guidanceState
    );
    const firstDocument = await vscode.workspace.openTextDocument(getWorkspaceFile('sample.md'));
    const secondDocument = await vscode.workspace.openTextDocument(getWorkspaceFile('second.md'));
    const firstPanel = createMockWebviewPanel();
    const secondPanel = createMockWebviewPanel();
    const token = new vscode.CancellationTokenSource().token;

    await provider.resolveCustomTextEditor(firstDocument, firstPanel.panel, token);
    await provider.resolveCustomTextEditor(secondDocument, secondPanel.panel, token);

    assert.doesNotMatch(firstPanel.webview.html, /Select text to start editing/);
    assert.doesNotMatch(secondPanel.webview.html, /Select text to start editing/);
    assert.match(secondPanel.webview.html, /data-first-action-guidance-state="hidden"/);

    provider.dispose();
  });
});
