import assert from 'node:assert/strict';
import { assertValidViewerState } from '../../src/webview/viewerState';

suite('Viewer state', () => {
  test('accepts rendered review suggestions with renderedReplacementHtml', () => {
    assert.doesNotThrow(() => {
      assertValidViewerState({
        kind: 'rendered',
        uri: 'file:///contract.md',
        title: 'contract.md',
        documentVersion: 1,
        previewOnly: true,
        sourceMode: false,
        canFallbackToDefaultEditor: false,
        html: '<p>Document body</p>',
        selectionMode: 'enabled',
        firstActionGuidance: {
          title: 'Select text to start editing',
          body: 'Highlight Markdown you want to change, then describe the edit.',
          dismissLabel: 'Got it',
          completionState: 'pending'
        },
        activeRequest: {
          sessionId: 'request-session-0',
          selectedTextPreview: 'Original text',
          selectedRegionIds: ['region-0'],
          validationState: 'review',
          draftText: 'Tighten this',
          suggestion: {
            proposalId: 'proposal-0',
            previewMode: 'blended-inline',
            replacementMarkdown: 'Updated text',
            renderedReplacementHtml: '<p>Updated text</p>'
          }
        },
        selectionMetadata: {
          regions: [],
          markers: []
        }
      });
    });
  });

  test('rejects rendered review suggestions missing renderedReplacementHtml', () => {
    assert.throws(() => {
      assertValidViewerState({
        kind: 'rendered',
        uri: 'file:///contract.md',
        title: 'contract.md',
        documentVersion: 1,
        previewOnly: true,
        sourceMode: false,
        canFallbackToDefaultEditor: false,
        html: '<p>Document body</p>',
        selectionMode: 'enabled',
        firstActionGuidance: {
          title: 'Select text to start editing',
          body: 'Highlight Markdown you want to change, then describe the edit.',
          dismissLabel: 'Got it',
          completionState: 'pending'
        },
        activeRequest: {
          sessionId: 'request-session-0',
          selectedTextPreview: 'Original text',
          selectedRegionIds: ['region-0'],
          validationState: 'review',
          draftText: 'Tighten this',
          suggestion: {
            proposalId: 'proposal-0',
            previewMode: 'blended-inline',
            replacementMarkdown: 'Updated text'
          }
        },
        selectionMetadata: {
          regions: [],
          markers: []
        }
      });
    }, /Invalid viewer state payload/i);
  });

  test('rejects invalid first-action guidance payloads', () => {
    assert.throws(() => {
      assertValidViewerState({
        kind: 'rendered',
        uri: 'file:///contract.md',
        title: 'contract.md',
        documentVersion: 1,
        previewOnly: true,
        sourceMode: false,
        canFallbackToDefaultEditor: false,
        html: '<p>Document body</p>',
        selectionMode: 'enabled',
        firstActionGuidance: {
          title: 'Select text to start editing',
          body: 'Highlight Markdown you want to change, then describe the edit.',
          dismissLabel: 'Got it',
          completionState: 'complete'
        },
        activeRequest: null,
        selectionMetadata: {
          regions: [],
          markers: []
        }
      });
    }, /Invalid viewer state payload/i);
  });

  test('accepts rendered viewer state without first-action guidance', () => {
    assert.doesNotThrow(() => {
      assertValidViewerState({
        kind: 'rendered',
        uri: 'file:///contract.md',
        title: 'contract.md',
        documentVersion: 1,
        previewOnly: true,
        sourceMode: false,
        canFallbackToDefaultEditor: false,
        html: '<p>Document body</p>',
        selectionMode: 'enabled',
        firstActionGuidance: null,
        activeRequest: {
          sessionId: 'request-session-0',
          selectedTextPreview: 'Original text',
          selectedRegionIds: ['region-0'],
          validationState: 'review',
          draftText: 'Tighten this',
          suggestion: {
            proposalId: 'proposal-0',
            previewMode: 'blended-inline',
            replacementMarkdown: 'Updated text',
            renderedReplacementHtml: '<p>Updated text</p>'
          }
        },
        selectionMetadata: {
          regions: [],
          markers: []
        }
      });
    });
  });
});
