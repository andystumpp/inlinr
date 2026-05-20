import assert from 'node:assert/strict';
import * as vscode from 'vscode';
import { DocumentSessionController } from '../../src/sessions/documentSessionController';

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
});