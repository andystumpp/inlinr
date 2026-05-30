import assert from 'node:assert/strict';
import {
  assertValidViewerToExtensionMessage,
  type ViewerToExtensionMessage
} from '../../src/webview/viewerProtocol';

suite('Selection request contract', () => {
  test('accepts the supported selection request message shapes', () => {
    const validMessages: ViewerToExtensionMessage[] = [
      {
        type: 'selection.capture',
        documentVersion: 1,
        selectedText: 'Selected text',
        startMarker: 'marker-0',
        endMarker: 'marker-1',
        renderedRegionIds: ['region-0'],
        selectionRect: {
          top: 148,
          left: 212,
          bottom: 168,
          right: 264
        }
      },
      {
        type: 'request.draftChanged',
        sessionId: 'request-session-0',
        draftText: 'Ask for changes'
      },
      {
        type: 'request.submit',
        sessionId: 'request-session-0',
        draftText: 'Ask for changes'
      },
      {
        type: 'request.cancel',
        sessionId: 'request-session-0'
      },
      {
        type: 'firstActionGuidance.dismiss'
      },
      {
        type: 'suggestion.apply',
        sessionId: 'request-session-0',
        proposalId: 'proposal-0'
      },
      {
        type: 'suggestion.reject',
        sessionId: 'request-session-0',
        proposalId: 'proposal-0'
      }
    ];

    for (const message of validMessages) {
      assert.doesNotThrow(() => {
        assertValidViewerToExtensionMessage(message);
      });
    }
  });

  test('rejects malformed selection capture payloads', () => {
    assert.throws(() => {
      assertValidViewerToExtensionMessage({
        type: 'selection.capture',
        documentVersion: '1',
        selectedText: 'Selected text',
        startMarker: 'marker-0',
        endMarker: 'marker-1',
        renderedRegionIds: ['region-0'],
        selectionRect: {
          top: '148',
          left: 212,
          bottom: 168,
          right: 264
        }
      });
    }, /Invalid viewer-to-extension message payload/i);
  });

  test('rejects unrecognized first-action guidance message types', () => {
    assert.throws(() => {
      assertValidViewerToExtensionMessage({
        type: 'firstActionGuidance.dismissed'
      });
    }, /Invalid viewer-to-extension message payload/i);
  });
});
