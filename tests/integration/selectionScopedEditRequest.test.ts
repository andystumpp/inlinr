import assert from 'node:assert/strict';
import * as vscode from 'vscode';
import { MarkdownCustomEditorProvider } from '../../src/editors/markdownCustomEditorProvider';
import type { SelectionScopedRequestPayload } from '../../src/requests/requestPayloadBuilder';
import { InMemoryRequestService } from '../../src/requests/requestService';
import { DocumentSessionController } from '../../src/sessions/documentSessionController';
import { closeAllEditors, createMockWebviewPanel, getExtensionUri, getWorkspaceFile, waitFor } from './helpers';

suite('Selection-scoped edit request integration', () => {
  teardown(async () => {
    await closeAllEditors();
  });

  test('opens one anchored request popup from a valid rendered selection without submitting immediately', async () => {
    const requestService = new InMemoryRequestService<SelectionScopedRequestPayload>();
    const provider = new MarkdownCustomEditorProvider(
      getExtensionUri(),
      new DocumentSessionController(),
      requestService
    );
    const document = await vscode.workspace.openTextDocument(getWorkspaceFile('selection-request-basic.md'));
    const { panel, postedMessages, webview, sendMessageToExtension } = createMockWebviewPanel();

    await provider.resolveCustomTextEditor(document, panel, new vscode.CancellationTokenSource().token);

    assert.match(webview.html, /data-selection-region-id="region-0"/);

    sendMessageToExtension({
      type: 'selection.capture',
      documentVersion: document.version,
      selectedText: 'selectable for the first request flow',
      startMarker: 'marker-0',
      endMarker: 'marker-1',
      renderedRegionIds: ['region-0'],
      selectionRect: {
        top: 164,
        left: 276,
        bottom: 184,
        right: 332
      }
    });

    await waitFor(
      () => postedMessages.find((message) => {
        return typeof message === 'object' && message !== null && 'type' in message && message.type === 'selection.accepted';
      }),
      (message) => Boolean(message)
    );

    const acceptedMessage = postedMessages.find((message) => {
      return typeof message === 'object' && message !== null && 'type' in message && message.type === 'selection.accepted';
    }) as { selectedTextPreview: string; selectedRegionIds: string[] } | undefined;

    assert.ok(acceptedMessage);
    assert.equal(acceptedMessage.selectedTextPreview, 'selectable for the first request flow');
    assert.deepEqual(acceptedMessage.selectedRegionIds, ['region-0']);
    assert.equal(requestService.getLastSubmittedPayload(), null);

    provider.dispose();
  });

  test('submits a local request payload only after explicit submit', async () => {
    const requestService = new InMemoryRequestService<SelectionScopedRequestPayload>();
    const sessionController = new DocumentSessionController();
    const provider = new MarkdownCustomEditorProvider(getExtensionUri(), sessionController, requestService);
    const document = await vscode.workspace.openTextDocument(getWorkspaceFile('selection-request-basic.md'));
    const { panel, postedMessages, sendMessageToExtension } = createMockWebviewPanel();

    await provider.resolveCustomTextEditor(document, panel, new vscode.CancellationTokenSource().token);

    sendMessageToExtension({
      type: 'selection.capture',
      documentVersion: document.version,
      selectedText: 'selectable for the first request flow',
      startMarker: 'marker-0',
      endMarker: 'marker-1',
      renderedRegionIds: ['region-0'],
      selectionRect: {
        top: 164,
        left: 276,
        bottom: 184,
        right: 332
      }
    });
    sendMessageToExtension({
      type: 'request.draftChanged',
      sessionId: 'request-session-0',
      draftText: 'Tighten the wording.'
    });
    sendMessageToExtension({
      type: 'request.submit',
      sessionId: 'request-session-0',
      draftText: 'Tighten the wording.'
    });

    await waitFor(
      () => requestService.getLastSubmittedPayload(),
      (payload): payload is SelectionScopedRequestPayload => payload !== null
    );

    const payload = requestService.getLastSubmittedPayload();

    assert.ok(payload);
    assert.equal(payload.requestText, 'Tighten the wording.');
    assert.equal(payload.selectedMarkdown, 'selectable for the first request flow');
    assert.equal(payload.documentUri, document.uri.toString());

    await waitFor(
      () => sessionController.getActiveRequestSession(document),
      (activeRequest) => activeRequest !== null && activeRequest.validationState === 'submitted'
    );

    await waitFor(
      () => postedMessages.find((message) => {
        return typeof message === 'object' && message !== null && 'type' in message && message.type === 'request.submitted';
      }),
      (message) => Boolean(message)
    );

    const submittedMessage = postedMessages.find((message) => {
      return typeof message === 'object' && message !== null && 'type' in message && message.type === 'request.submitted';
    }) as { message: string } | undefined;

    assert.ok(submittedMessage);
    assert.equal(submittedMessage.message, 'Request captured locally.');

    provider.dispose();
  });

  test('preserves one contiguous targeted range across adjacent prose blocks', async () => {
    const requestService = new InMemoryRequestService<SelectionScopedRequestPayload>();
    const provider = new MarkdownCustomEditorProvider(
      getExtensionUri(),
      new DocumentSessionController(),
      requestService
    );
    const document = await vscode.workspace.openTextDocument(getWorkspaceFile('selection-request-basic.md'));
    const { panel, postedMessages, webview, sendMessageToExtension } = createMockWebviewPanel();
    const selectedText = 'selectable for the first request flow.\n\nThis adjacent paragraph gives the next phase';

    await provider.resolveCustomTextEditor(document, panel, new vscode.CancellationTokenSource().token);

    sendMessageToExtension({
      type: 'selection.capture',
      documentVersion: document.version,
      selectedText,
      startMarker: 'marker-0',
      endMarker: 'marker-3',
      renderedRegionIds: ['region-0', 'region-1'],
      selectionRect: {
        top: 192,
        left: 244,
        bottom: 252,
        right: 488
      }
    });

    await waitFor(
      () => postedMessages.find((message) => {
        return typeof message === 'object' && message !== null && 'type' in message && message.type === 'selection.accepted';
      }),
      (message) => Boolean(message)
    );

    assert.match(webview.html, /data-selection-region-id="region-1"/);

    const acceptedMessage = postedMessages.find((message) => {
      return typeof message === 'object' && message !== null && 'type' in message && message.type === 'selection.accepted';
    }) as { selectedRegionIds: string[] } | undefined;

    assert.ok(acceptedMessage);
    assert.deepEqual(acceptedMessage.selectedRegionIds, ['region-0', 'region-1']);

    sendMessageToExtension({
      type: 'request.draftChanged',
      sessionId: 'request-session-0',
      draftText: 'Condense both paragraphs.'
    });
    sendMessageToExtension({
      type: 'request.submit',
      sessionId: 'request-session-0',
      draftText: 'Condense both paragraphs.'
    });

    await waitFor(
      () => requestService.getLastSubmittedPayload(),
      (payload): payload is SelectionScopedRequestPayload => payload !== null && payload.requestText === 'Condense both paragraphs.'
    );

    const payload = requestService.getLastSubmittedPayload();

    assert.ok(payload);
    assert.equal(
      payload.selectedMarkdown.replace(/\r\n/g, '\n'),
      selectedText.replace(/\r\n/g, '\n')
    );

    provider.dispose();
  });

  test('keeps the active request attached after a small document shift that still resolves confidently', async () => {
    const requestService = new InMemoryRequestService<SelectionScopedRequestPayload>();
    const sessionController = new DocumentSessionController();
    const provider = new MarkdownCustomEditorProvider(getExtensionUri(), sessionController, requestService);
    const document = await vscode.workspace.openTextDocument(getWorkspaceFile('selection-request-basic.md'));
    const { panel, postedMessages, webview, sendMessageToExtension } = createMockWebviewPanel();

    await provider.resolveCustomTextEditor(document, panel, new vscode.CancellationTokenSource().token);

    sendMessageToExtension({
      type: 'selection.capture',
      documentVersion: document.version,
      selectedText: 'selectable for the first request flow',
      startMarker: 'marker-0',
      endMarker: 'marker-1',
      renderedRegionIds: ['region-0'],
      selectionRect: {
        top: 164,
        left: 276,
        bottom: 184,
        right: 332
      }
    });
    sendMessageToExtension({
      type: 'request.draftChanged',
      sessionId: 'request-session-0',
      draftText: 'Tighten the wording after the intro is added.'
    });

    const edit = new vscode.WorkspaceEdit();
    edit.insert(document.uri, new vscode.Position(0, 0), 'Intro paragraph.\n\n');
    await vscode.workspace.applyEdit(edit);
    await document.save();

    await waitFor(
      () => sessionController.getActiveRequestSession(document),
      (activeRequest) => activeRequest !== null && activeRequest.draftText === 'Tighten the wording after the intro is added.'
    );

    assert.doesNotMatch(webview.html, /Render failed/);

    sendMessageToExtension({
      type: 'request.submit',
      sessionId: 'request-session-0',
      draftText: 'Tighten the wording after the intro is added.'
    });

    await waitFor(
      () => requestService.getLastSubmittedPayload(),
      (payload): payload is SelectionScopedRequestPayload => payload !== null
    );

    const payload = requestService.getLastSubmittedPayload();

    assert.ok(payload);
    assert.equal(payload.selectedMarkdown, 'selectable for the first request flow');

    const submittedMessage = postedMessages.find((message) => {
      return typeof message === 'object' && message !== null && 'type' in message && message.type === 'request.submitted';
    }) as { message: string } | undefined;

    assert.ok(submittedMessage);
    assert.equal(submittedMessage.message, 'Request captured locally.');

    provider.dispose();
  });
});