import assert from 'node:assert/strict';
import {
  evaluateSelectionSupport,
  normalizeRenderedRegionIds
} from '../../src/requests/selectionSupportPolicy';

suite('Selection support policy', () => {
  test('accepts non-empty selection capture within supported regions', () => {
    const decision = evaluateSelectionSupport({
      type: 'selection.capture',
      documentVersion: 1,
      selectedText: 'Selected text',
      startMarker: 'marker-0',
      endMarker: 'marker-1',
      renderedRegionIds: ['region-0']
    });

    assert.equal(decision.allowed, true);
  });

  test('rejects whitespace-only selections', () => {
    const decision = evaluateSelectionSupport({
      type: 'selection.capture',
      documentVersion: 1,
      selectedText: '   ',
      startMarker: 'marker-0',
      endMarker: 'marker-1',
      renderedRegionIds: ['region-0']
    });

    assert.equal(decision.allowed, false);
    assert.match(decision.reason ?? '', /non-empty content/i);
  });

  test('normalizes rendered region ids for adjacent multi-block selections', () => {
    const normalizedRegionIds = normalizeRenderedRegionIds(['region-0', 'region-0', 'region-1']);

    assert.deepEqual(normalizedRegionIds, ['region-0', 'region-1']);
  });
});