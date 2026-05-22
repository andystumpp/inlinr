import assert from 'node:assert/strict';
import { extractMarkedDocumentRange, getSelectionMarkerTokens } from '../../src/requests/documentDraftMarkers';
import { normalizeSuggestedEdit } from '../../src/requests/suggestionNormalizer';
import { buildSelectionScopedRequestPayload } from '../../src/requests/requestPayloadBuilder';
import { createSelectionAnchor } from '../../src/requests/selectionAnchorResolver';

function createPayload(selectedMarkdown: string) {
  return buildSelectionScopedRequestPayload({
    documentUri: 'file:///workspace/sample.md',
    documentVersion: 1,
    requestText: 'Rewrite the paragraph.',
    selectedMarkdown,
    documentMarkdown: selectedMarkdown,
    selectionAnchor: createSelectionAnchor({
      documentUri: 'file:///workspace/sample.md',
      capturedDocumentVersion: 1,
      markdownSource: selectedMarkdown,
      sourceStart: 0,
      sourceEnd: selectedMarkdown.length
    }),
    effectiveSelectionScope: {
      scopeKind: 'exact-selection',
      visibleSourceStart: 0,
      visibleSourceEnd: selectedMarkdown.length,
      effectiveSourceStart: 0,
      effectiveSourceEnd: selectedMarkdown.length,
      selectedRegionIds: ['region-0']
    }
  });
}

suite('Suggestion normalizer', () => {
  test('normalizes a validated draft into a contained suggestion proposal', () => {
    const payload = createPayload('Original paragraph.');
    const { startMarker, endMarker } = getSelectionMarkerTokens(payload.selectionMarkerId);
    const suggestion = normalizeSuggestedEdit(payload, {
      requestId: payload.requestId,
      draftDocumentMarkdown: [
        startMarker,
        'Rewritten paragraph.',
        endMarker
      ].join(''),
      completedAt: new Date().toISOString(),
      modelId: 'copilot-test-model'
    });

    assert.equal(suggestion.previewMode, 'blended-inline');
    assert.equal(suggestion.rangeChangeStatus, 'contained');
    assert.equal(suggestion.replacementMarkdown, 'Rewritten paragraph.');
    assert.equal(suggestion.effectiveSelectionScope.scopeKind, 'exact-selection');
    assert.equal(
      extractMarkedDocumentRange(suggestion.validatedDraft.draftDocumentMarkdown, payload.selectionMarkerId).selectedMarkdown,
      'Rewritten paragraph.'
    );
  });

  test('keeps the extracted proposal when the draft also changes content outside the selected range', () => {
    const payload = createPayload('Original paragraph.');
    const { startMarker, endMarker } = getSelectionMarkerTokens(payload.selectionMarkerId);
    const suggestion = normalizeSuggestedEdit(payload, {
      requestId: payload.requestId,
      draftDocumentMarkdown: [
        'Changed before ',
        startMarker,
        'Rewritten paragraph.',
        endMarker
      ].join(''),
      completedAt: new Date().toISOString()
    });

    assert.equal(suggestion.rangeChangeStatus, 'contained');
    assert.equal(suggestion.replacementMarkdown, 'Rewritten paragraph.');
  });

  test('allows empty replacement markdown for deletion proposals', () => {
    const payload = createPayload('Original paragraph.');
    const { startMarker, endMarker } = getSelectionMarkerTokens(payload.selectionMarkerId);
    const suggestion = normalizeSuggestedEdit(payload, {
      requestId: payload.requestId,
      draftDocumentMarkdown: [startMarker, endMarker].join(''),
      completedAt: new Date().toISOString()
    });

    assert.equal(suggestion.rangeChangeStatus, 'contained');
    assert.equal(suggestion.replacementMarkdown, '');
  });
});