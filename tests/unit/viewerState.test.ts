import assert from 'node:assert/strict';
import { DEFAULT_FIRST_ACTION_GUIDANCE_VIEW_STATE } from '../../src/onboarding/firstActionGuidanceState';
import { assertValidViewerState } from '../../src/webview/viewerState';

suite('Viewer state', () => {
  test('accepts rendered review suggestions with renderedReplacementHtml', () => {
    assert.doesNotThrow(() => {
      assertValidViewerState({
        kind: 'rendered',
        uri: 'file:///contract.md',
        title: 'contract.md',
        documentVersion: 1,
        presentationPreset: 'balanced',
        previewOnly: true,
        sourceMode: false,
        canFallbackToDefaultEditor: false,
        html: '<p>Document body</p>',
        selectionMode: 'enabled',
        firstActionGuidance: DEFAULT_FIRST_ACTION_GUIDANCE_VIEW_STATE,
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
        presentationPreset: 'balanced',
        previewOnly: true,
        sourceMode: false,
        canFallbackToDefaultEditor: false,
        html: '<p>Document body</p>',
        selectionMode: 'enabled',
        firstActionGuidance: DEFAULT_FIRST_ACTION_GUIDANCE_VIEW_STATE,
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
        presentationPreset: 'balanced',
        previewOnly: true,
        sourceMode: false,
        canFallbackToDefaultEditor: false,
        html: '<p>Document body</p>',
        selectionMode: 'enabled',
        firstActionGuidance: {
          ...DEFAULT_FIRST_ACTION_GUIDANCE_VIEW_STATE,
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
        presentationPreset: 'balanced',
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

  test('accepts rendered viewer state with empty html for empty markdown documents', () => {
    assert.doesNotThrow(() => {
      assertValidViewerState({
        kind: 'rendered',
        uri: 'file:///empty.md',
        title: 'empty.md',
        documentVersion: 1,
        presentationPreset: 'balanced',
        previewOnly: true,
        sourceMode: false,
        canFallbackToDefaultEditor: false,
        html: '',
        selectionMode: 'enabled',
        firstActionGuidance: null,
        activeRequest: null,
        selectionMetadata: {
          regions: [],
          markers: []
        }
      });
    });
  });

  test('rejects viewer state payloads with an unknown presentation preset', () => {
    assert.throws(() => {
      assertValidViewerState({
        kind: 'error',
        uri: 'file:///contract.md',
        title: 'contract.md',
        documentVersion: 1,
        presentationPreset: 'storybook',
        previewOnly: true,
        canFallbackToDefaultEditor: false,
        message: 'Preview unavailable.',
        reasonCode: 'render-failed'
      });
    }, /Invalid viewer state payload/i);
  });
});
