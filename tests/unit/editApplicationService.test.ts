import assert from 'node:assert/strict';
import { resolveSuggestedEditRange } from '../../src/requests/editApplicationService';
import { createSelectionAnchor } from '../../src/requests/selectionAnchorResolver';
import type { NormalizedSuggestedEdit } from '../../src/requests/suggestionNormalizer';

function createSuggestion(markdownSource: string, replacementMarkdown: string): NormalizedSuggestedEdit {
  return {
    proposalId: 'proposal-0',
    requestId: 'request-0',
    documentUri: 'file:///workspace/sample.md',
    baseDocumentVersion: 1,
    selectionAnchor: createSelectionAnchor({
      documentUri: 'file:///workspace/sample.md',
      capturedDocumentVersion: 1,
      markdownSource,
      sourceStart: 0,
      sourceEnd: 'Original paragraph.'.length
    }),
    effectiveSelectionScope: {
      scopeKind: 'exact-selection',
      visibleSourceStart: 0,
      visibleSourceEnd: 'Original paragraph.'.length,
      effectiveSourceStart: 0,
      effectiveSourceEnd: 'Original paragraph.'.length,
      selectedRegionIds: ['region-0']
    },
    validatedDraft: {
      requestId: 'request-0',
      documentUri: 'file:///workspace/sample.md',
      baseDocumentVersion: 1,
      draftDocumentMarkdown: replacementMarkdown,
      replacementMarkdown,
      selectionMarkerId: 'proposal-0',
      validatedAt: new Date().toISOString()
    },
    replacementMarkdown,
    previewMode: 'blended-inline',
    rangeChangeStatus: 'contained',
    createdAt: new Date().toISOString()
  };
}

suite('Edit application service', () => {
  test('resolves a bounded replacement range for a compatible suggestion', () => {
    const markdownSource = 'Original paragraph.\n\nTrailing paragraph.';
    const suggestion = createSuggestion(markdownSource, 'Rewritten paragraph.');

    const mutation = resolveSuggestedEditRange(markdownSource, suggestion);

    assert.equal(mutation.sourceStart, 0);
    assert.equal(mutation.sourceEnd, 'Original paragraph.'.length);
    assert.equal(mutation.replacementMarkdown, 'Rewritten paragraph.');
  });

  test('allows deletion suggestions to resolve the same bounded range', () => {
    const markdownSource = 'Original paragraph.\n\nTrailing paragraph.';
    const suggestion = createSuggestion(markdownSource, '');

    const mutation = resolveSuggestedEditRange(markdownSource, suggestion);

    assert.equal(mutation.sourceStart, 0);
    assert.equal(mutation.sourceEnd, 'Original paragraph.'.length);
    assert.equal(mutation.replacementMarkdown, '');
  });
});