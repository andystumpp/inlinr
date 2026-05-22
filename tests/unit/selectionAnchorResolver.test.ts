import assert from 'node:assert/strict';
import { createSelectionAnchor, revalidateSelectionAnchor } from '../../src/requests/selectionAnchorResolver';

suite('Selection anchor resolver', () => {
  test('re-finds a contiguous multi-block selection after a small document shift', () => {
    const source = 'First paragraph.\n\nSecond paragraph continues the same request.';
    const selectedText = 'paragraph.\n\nSecond paragraph';
    const sourceStart = source.indexOf(selectedText);
    const sourceEnd = sourceStart + selectedText.length;
    const anchor = createSelectionAnchor({
      documentUri: 'file:///workspace/selection-request-basic.md',
      capturedDocumentVersion: 1,
      markdownSource: source,
      sourceStart,
      sourceEnd
    });
    const shiftedSource = 'Intro line.\n\n' + source;

    const revalidation = revalidateSelectionAnchor(shiftedSource, anchor);

    assert.equal(revalidation.status, 'refound');
    assert.ok(revalidation.match);
    assert.equal(shiftedSource.slice(revalidation.match.sourceStart, revalidation.match.sourceEnd), selectedText);
  });

  test('reports ambiguity when the selected text can match multiple target ranges', () => {
    const source = 'Alpha line.\n\nTarget sentence.\n\nOmega line.';
    const selectedText = 'Target sentence.';
    const sourceStart = source.indexOf(selectedText);
    const sourceEnd = sourceStart + selectedText.length;
    const anchor = createSelectionAnchor({
      documentUri: 'file:///workspace/selection-request-basic.md',
      capturedDocumentVersion: 1,
      markdownSource: source,
      sourceStart,
      sourceEnd,
      prefixWindow: 0,
      suffixWindow: 0
    });
    const ambiguousSource = 'Target sentence.\n\nAlpha line.\n\nTarget sentence.\n\nOmega line.';

    const revalidation = revalidateSelectionAnchor(ambiguousSource, anchor);

    assert.equal(revalidation.status, 'ambiguous');
    assert.equal(revalidation.match, null);
  });

  test('reports missing when the original target no longer exists before apply', () => {
    const source = 'Alpha line.\n\nTarget sentence.\n\nOmega line.';
    const selectedText = 'Target sentence.';
    const sourceStart = source.indexOf(selectedText);
    const sourceEnd = sourceStart + selectedText.length;
    const anchor = createSelectionAnchor({
      documentUri: 'file:///workspace/selection-request-basic.md',
      capturedDocumentVersion: 1,
      markdownSource: source,
      sourceStart,
      sourceEnd
    });
    const removedTargetSource = 'Alpha line.\n\nChanged sentence.\n\nOmega line.';

    const revalidation = revalidateSelectionAnchor(removedTargetSource, anchor);

    assert.equal(revalidation.status, 'missing');
    assert.equal(revalidation.match, null);
  });
});