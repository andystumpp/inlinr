import assert from 'node:assert/strict';
import * as vscode from 'vscode';
import { DocumentSessionController } from '../../src/sessions/documentSessionController';
import { createSelectionAnchor } from '../../src/requests/selectionAnchorResolver';

suite('Document session controller', () => {
  test('refreshes every tracked session for a document', async () => {
    const controller = new DocumentSessionController();
    const document = {
      uri: vscode.Uri.parse('file:///workspace/sample.md')
    } as vscode.TextDocument;
    const refreshedSessions: string[] = [];

    controller.track(document, 'one', async () => {
      refreshedSessions.push('one');
    });
    controller.track(document, 'two', async () => {
      refreshedSessions.push('two');
    });

    await controller.refresh(document);

    assert.deepEqual(refreshedSessions.sort(), ['one', 'two']);
  });

  test('removes disposed sessions from the tracked document set', () => {
    const controller = new DocumentSessionController();
    const document = {
      uri: vscode.Uri.parse('file:///workspace/sample.md')
    } as vscode.TextDocument;

    const disposable = controller.track(document, 'only', () => undefined);

    assert.equal(controller.getSessionCount(document), 1);

    disposable.dispose();

    assert.equal(controller.getSessionCount(document), 0);
  });

  test('invalidates the active request for the matching document only', () => {
    const controller = new DocumentSessionController();
    const document = {
      uri: vscode.Uri.parse('file:///workspace/sample.md')
    } as vscode.TextDocument;

    controller.setActiveRequestSession({
      sessionId: 'request-session-0',
      documentUri: document.uri.toString(),
      documentVersion: 1,
      selectedTextPreview: 'Selected text',
      selectedRegionIds: ['region-0'],
      draftText: 'Tighten the wording.',
      selectionAnchor: createSelectionAnchor({
        documentUri: document.uri.toString(),
        capturedDocumentVersion: 1,
        markdownSource: 'Selected text in markdown.',
        sourceStart: 0,
        sourceEnd: 'Selected text'.length
      }),
      effectiveSelectionScope: {
        scopeKind: 'exact-selection',
        visibleSourceStart: 0,
        visibleSourceEnd: 'Selected text'.length,
        effectiveSourceStart: 0,
        effectiveSourceEnd: 'Selected text'.length,
        selectedRegionIds: ['region-0']
      },
      validationState: 'executing'
    });

    controller.invalidateActiveRequestForDocument(document, 'The execution target changed.');

    const activeRequest = controller.getActiveRequestSession(document);

    assert.ok(activeRequest);
    assert.equal(activeRequest.validationState, 'invalid');
    assert.equal(activeRequest.validationMessage, 'The execution target changed.');
  });
});