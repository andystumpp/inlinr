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
  createTemporaryMarkdownDocument,
  getExtensionUri,
  getWorkspaceFile
} from './helpers';

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
    assert.match(webview.html, /<h1 class="viewer-title">sample<\/h1>/);
    assert.doesNotMatch(webview.html, /Preview only/);
    assert.doesNotMatch(webview.html, /Version \d+/);
    assert.match(webview.html, /This is the first Markdown document\./);

    provider.dispose();
  });

  test('uses a compact document-context header for long file names', async () => {
    const provider = new MarkdownCustomEditorProvider(getExtensionUri(), new DocumentSessionController());
    const { document, uri, cleanup } = await createTemporaryMarkdownDocument(
      'very-long-selection-request-document-name-for-header-truncation-behavior-check',
      '# Header\n\nBody'
    );
    const { panel, webview } = createMockWebviewPanel();
    const expectedTitleStem = uri.path.split('/').pop()?.replace(/\.md$/i, '');

    try {
      await provider.resolveCustomTextEditor(document, panel, new vscode.CancellationTokenSource().token);

      const titleMatch = webview.html.match(/<h1 class="viewer-title">([^<]+)<\/h1>/);
      assert.ok(titleMatch, 'Expected the rendered header title to exist.');
      assert.ok(expectedTitleStem, 'Expected the temporary document title stem to exist.');
      assert.equal(titleMatch[1].includes('.md'), false);
      assert.equal(titleMatch[1].includes('...'), true);
      assert.equal(titleMatch[1].startsWith(expectedTitleStem.slice(0, 10)), true);
      assert.equal(titleMatch[1].endsWith(expectedTitleStem.slice(-10)), true);

      const headerContextMatch = webview.html.match(/<div class="viewer-header-content" title="([^"]+)">/);
      assert.ok(headerContextMatch, 'Expected the header context tooltip to exist.');
      assert.equal(headerContextMatch[1], uri.fsPath);
      assert.doesNotMatch(webview.html, /Preview only/);
      assert.doesNotMatch(webview.html, /Version \d+/);
    } finally {
      provider.dispose();
      await cleanup();
    }
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

  test('hydrates the stored presentation preset into the viewer header', async () => {
    const provider = new MarkdownCustomEditorProvider(
      getExtensionUri(),
      new DocumentSessionController(),
      undefined,
      undefined,
      undefined,
      undefined,
      new PresentationPresetState(createMockMemento({
        'inlinr.presentationPreset': 'comfortable-reading'
      }))
    );
    const document = await vscode.workspace.openTextDocument(getWorkspaceFile('sample.md'));
    const { panel, webview } = createMockWebviewPanel();

    try {
      await provider.resolveCustomTextEditor(document, panel, new vscode.CancellationTokenSource().token);

      assert.match(webview.html, /data-presentation-preset="comfortable-reading"/);
      assert.match(webview.html, /data-testid="viewer-preset-select"/);
      assert.match(webview.html, /<option value="comfortable-reading" selected>Comfortable Reading<\/option>/);
    } finally {
      panel.dispose();
      provider.dispose();
    }
  });
});
