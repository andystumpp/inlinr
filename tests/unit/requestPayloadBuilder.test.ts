import assert from 'node:assert/strict';
import { extractMarkedDocumentRange } from '../../src/requests/documentDraftMarkers';
import { buildSelectionScopedRequestPayload } from '../../src/requests/requestPayloadBuilder';
import { createSelectionAnchor } from '../../src/requests/selectionAnchorResolver';

suite('Request payload builder', () => {
  test('builds a provider-agnostic payload with the selected text and full document markdown', () => {
    const markdownSource = 'Prefix context. Selected sentence. Suffix context.';
    const selectedText = 'Selected sentence.';
    const sourceStart = markdownSource.indexOf(selectedText);
    const selectionAnchor = createSelectionAnchor({
      documentUri: 'file:///workspace/selection-request-basic.md',
      capturedDocumentVersion: 1,
      markdownSource,
      sourceStart,
      sourceEnd: sourceStart + selectedText.length
    });

    const payload = buildSelectionScopedRequestPayload({
      documentUri: selectionAnchor.documentUri,
      documentVersion: 1,
      requestText: 'Tighten this sentence.',
      selectedMarkdown: selectedText,
      documentMarkdown: markdownSource,
      selectionAnchor,
      effectiveSelectionScope: {
        scopeKind: 'exact-selection',
        visibleSourceStart: sourceStart,
        visibleSourceEnd: sourceStart + selectedText.length,
        effectiveSourceStart: sourceStart,
        effectiveSourceEnd: sourceStart + selectedText.length,
        selectedRegionIds: ['region-0']
      }
    });

    assert.equal(payload.requestText, 'Tighten this sentence.');
    assert.equal(payload.selectedMarkdown, selectedText);
    assert.equal(payload.documentMarkdown, markdownSource);
    assert.equal(payload.effectiveSelectionScope.scopeKind, 'exact-selection');
    assert.ok(payload.selectionMarkerId.length > 0);

    const markedRange = extractMarkedDocumentRange(payload.markedDocumentMarkdown, payload.selectionMarkerId);

    assert.equal(markedRange.selectedMarkdown, selectedText);
    assert.equal(markedRange.beforeMarkdown, 'Prefix context. ');
    assert.equal(markedRange.afterMarkdown, ' Suffix context.');
  });
});