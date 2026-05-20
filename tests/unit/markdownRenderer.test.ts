import assert from 'node:assert/strict';
import { renderMarkdown, renderMarkdownDocument } from '../../src/rendering/markdownRenderer';

suite('Markdown renderer', () => {
  test('renders headings and emphasis into HTML', () => {
    const html = renderMarkdown('# Hello\n\nA *test* document.');

    assert.match(html, /<h1>Hello<\/h1>/);
    assert.match(html, /<em>test<\/em>/);
  });

  test('does not allow raw HTML passthrough', () => {
    const html = renderMarkdown('before <script>alert(1)</script> after');

    assert.doesNotMatch(html, /<script>/);
    assert.match(html, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
  });

  test('rejects unsupported null characters', () => {
    assert.throws(() => renderMarkdown('bad\u0000content'), /unsupported null characters/i);
  });

  test('rejects closed documents', () => {
    const document = {
      isClosed: true,
      getText: () => '# Closed'
    };

    assert.throws(() => renderMarkdownDocument(document), /no longer available/i);
  });
});