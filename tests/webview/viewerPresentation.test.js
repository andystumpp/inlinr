const fs = require('node:fs');
const path = require('node:path');
const { test, expect } = require('@playwright/test');

const viewerStyles = fs.readFileSync(
  path.resolve(__dirname, '..', '..', 'media', 'markdownViewer', 'styles.css'),
  'utf8'
);

test.describe('viewer presentation stylesheet', () => {
  test('ships typography rules for headings, prose, lists, tables, rules, and code', () => {
    expect(viewerStyles).toContain('.viewer-document :where(h1, h2, h3, h4, h5, h6)');
    expect(viewerStyles).toContain('.viewer-document :where(p, ul, ol, blockquote, hr)');
    expect(viewerStyles).toContain('.viewer-document li::marker');
    expect(viewerStyles).toContain('.viewer-document code');
    expect(viewerStyles).toContain('.viewer-document pre code');
    expect(viewerStyles).toContain('.viewer-document table');
    expect(viewerStyles).toContain('.viewer-document thead th');
    expect(viewerStyles).toContain('.viewer-document hr');
  });

  test('keeps selection and review affordance styling in the viewer stylesheet', () => {
    expect(viewerStyles).toContain('::highlight(inlinr-active-selection)');
    expect(viewerStyles).toContain('.viewer-document [data-selection-region-id].selection-request-target');
    expect(viewerStyles).toContain('.viewer-document [data-selection-region-id].selection-request-target-review');
  });
});
