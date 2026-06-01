import assert from 'node:assert/strict';
import * as vscode from 'vscode';
import { MarkdownCustomEditorProvider } from '../../src/editors/markdownCustomEditorProvider';
import { DEFAULT_FIRST_ACTION_GUIDANCE_VIEW_STATE, FirstActionGuidanceState } from '../../src/onboarding/firstActionGuidanceState';
import { PresentationPresetState } from '../../src/presentation/presentationPresetState';
import { DocumentSessionController } from '../../src/sessions/documentSessionController';
import {
  closeAllEditors,
  createMockMemento,
  createMockWebviewPanel,
  getExtensionUri,
  getWorkspaceFile,
  openWorkspaceFileWithEditor,
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

    assert.equal(firstPanel.webview.html.includes(DEFAULT_FIRST_ACTION_GUIDANCE_VIEW_STATE.title), false);
    assert.equal(secondPanel.webview.html.includes(DEFAULT_FIRST_ACTION_GUIDANCE_VIEW_STATE.title), false);
    assert.match(secondPanel.webview.html, /data-first-action-guidance-state="hidden"/);

    provider.dispose();
  });

  test('openWithInlinrViewer reopens an active Markdown text editor in the Inlinr viewer', async () => {
    const markdownUri = await openWorkspaceFileWithEditor('sample.md', 'default');

    await waitFor(
      () => vscode.window.tabGroups.activeTabGroup.activeTab?.input,
      (input): input is vscode.TabInputText =>
        input instanceof vscode.TabInputText && input.uri.toString() === markdownUri.toString()
    );

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

  test('rerenders open viewers when the header preset selector changes', async () => {
    const presetStore = createMockMemento();
    const provider = new MarkdownCustomEditorProvider(
      getExtensionUri(),
      new DocumentSessionController(),
      undefined,
      undefined,
      undefined,
      undefined,
      new PresentationPresetState(presetStore)
    );
    const document = await vscode.workspace.openTextDocument(getWorkspaceFile('sample.md'));
    const { panel, webview, sendMessageToExtension } = createMockWebviewPanel();
    const token = new vscode.CancellationTokenSource().token;

    try {
      await provider.resolveCustomTextEditor(document, panel, token);
      sendMessageToExtension({
        type: 'presentationPreset.change',
        preset: 'dense-spec'
      });

      await waitFor(
        () => webview.html,
        (html) => /data-presentation-preset="dense-spec"/.test(html)
      );

      assert.deepEqual(presetStore.snapshot(), {
        'inlinr.presentationPreset': 'dense-spec'
      });
    } finally {
      panel.dispose();
      provider.dispose();
    }
  });
});
