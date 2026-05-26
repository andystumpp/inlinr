import assert from 'node:assert/strict';
import path from 'node:path';
import { PromptLoader } from '../../src/requests/promptLoader';

suite('Prompt loader', () => {
  test('loads and renders the selection-scoped prompt template', () => {
    const loader = new PromptLoader(path.resolve(__dirname, '../../../prompts'));
    const rendered = loader.render('selection-scoped-edit', {
      requestText: 'Tighten the wording.',
      selectedMarkdown: 'Original paragraph for execution.',
      selectionMarkerId: 'selection-id-123',
      markedDocumentMarkdown: '<<<INLINR_SELECTION_START:selection-id-123>>>Original paragraph<<<INLINR_SELECTION_END:selection-id-123>>>'
    });

    assert.equal(rendered.promptVersion, 'selection-scoped-edit-v1');
    assert.match(rendered.promptText, /Rewrite only the Markdown content inside the explicit selection markers/);
    assert.match(rendered.promptText, /Do not include commentary or code fences\./);
    assert.match(rendered.promptText, /Tighten the wording\./);
    assert.match(rendered.promptText, /selection-id-123/);
    assert.match(rendered.promptText, /Marked full document Markdown:/);
    assert.doesNotMatch(rendered.promptText, /{{\s*[a-zA-Z0-9_]+\s*}}/);
  });

  test('throws when required variables are missing', () => {
    const loader = new PromptLoader(path.resolve(__dirname, '../../../prompts'));

    assert.throws(
      () =>
        loader.render('selection-scoped-edit', {
          requestText: 'Tighten the wording.',
          selectedMarkdown: 'Original paragraph for execution.',
          markedDocumentMarkdown:
            '<<<INLINR_SELECTION_START:selection-id-123>>>Original paragraph<<<INLINR_SELECTION_END:selection-id-123>>>'
        }),
      /missing variables: selectionMarkerId/
    );
  });
});
