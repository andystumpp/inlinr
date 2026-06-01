import assert from 'node:assert/strict';
import * as vscode from 'vscode';
import { MarkdownCustomEditorProvider } from '../../src/editors/markdownCustomEditorProvider';
import { DEFAULT_FIRST_ACTION_GUIDANCE_VIEW_STATE, FirstActionGuidanceState } from '../../src/onboarding/firstActionGuidanceState';
import { DocumentSessionController } from '../../src/sessions/documentSessionController';
import { closeAllEditors, createMockMemento, createMockWebviewPanel, getExtensionUri, getWorkspaceFile } from './helpers';

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

  test('includes first-action guidance for a first-run user', async () => {
    const provider = new MarkdownCustomEditorProvider(
      getExtensionUri(),
      new DocumentSessionController(),
      undefined,
      undefined,
      undefined,
      new FirstActionGuidanceState(createMockMemento())
    );
    const document = await vscode.workspace.openTextDocument(getWorkspaceFile('sample.md'));
    const { panel, webview } = createMockWebviewPanel();

    await provider.resolveCustomTextEditor(document, panel, new vscode.CancellationTokenSource().token);

    assert.match(webview.html, /data-first-action-guidance-root/);
    assert.ok(webview.html.includes(DEFAULT_FIRST_ACTION_GUIDANCE_VIEW_STATE.title));
    assert.ok(webview.html.includes(DEFAULT_FIRST_ACTION_GUIDANCE_VIEW_STATE.body));

    provider.dispose();
  });
});
