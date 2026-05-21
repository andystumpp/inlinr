import assert from 'node:assert/strict';
import { buildSelectionScopedRequestPayload } from '../../src/requests/requestPayloadBuilder';
import { createSelectionAnchor } from '../../src/requests/selectionAnchorResolver';

suite('Request payload builder', () => {
  test('builds a provider-agnostic payload with only selected text and adjacent context', () => {
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
      selectionAnchor,
      prefixMarkdown: selectionAnchor.prefixQuote,
      suffixMarkdown: selectionAnchor.suffixQuote
    });

    assert.equal(payload.requestText, 'Tighten this sentence.');
    assert.equal(payload.selectedMarkdown, selectedText);
    assert.equal(payload.surroundingContext.prefixMarkdown, selectionAnchor.prefixQuote);
    assert.equal(payload.surroundingContext.suffixMarkdown, selectionAnchor.suffixQuote);
  });
});