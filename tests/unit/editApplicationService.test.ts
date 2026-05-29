import assert from 'node:assert/strict';
import * as vscode from 'vscode';
import {
  EditApplicationError,
  applySuggestedEdit,
  resolveSuggestedEditRange
} from '../../src/requests/editApplicationService';
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

function createMockDocument(markdownSource: string, options?: {
  isUntitled?: boolean;
  save?: () => Promise<boolean>;
}): vscode.TextDocument {
  return {
    uri: vscode.Uri.parse(options?.isUntitled ? 'untitled:sample.md' : 'file:///workspace/sample.md'),
    version: 2,
    isUntitled: options?.isUntitled ?? false,
    getText: () => markdownSource,
    positionAt: (offset: number) => new vscode.Position(0, offset),
    save: options?.save ?? (async () => true)
  } as unknown as vscode.TextDocument;
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

  test('applies a suggestion and saves the file-backed document to disk', async () => {
    const markdownSource = 'Original paragraph.\n\nTrailing paragraph.';
    const suggestion = createSuggestion(markdownSource, 'Rewritten paragraph.');
    const document = createMockDocument(markdownSource);
    const originalApplyEdit = vscode.workspace.applyEdit;
    let applyEditCalls = 0;
    let saveCalls = 0;

    Object.defineProperty(vscode.workspace, 'applyEdit', {
      value: async (edit: vscode.WorkspaceEdit) => {
        applyEditCalls += 1;
        assert.ok(edit instanceof vscode.WorkspaceEdit);
        return true;
      },
      configurable: true
    });

    Object.defineProperty(document, 'save', {
      value: async () => {
        saveCalls += 1;
        return true;
      },
      configurable: true
    });

    try {
      const result = await applySuggestedEdit(document, suggestion);

      assert.equal(applyEditCalls, 1);
      assert.equal(saveCalls, 1);
      assert.equal(result.proposalId, 'proposal-0');
      assert.equal(result.persistedToDisk, true);
    } finally {
      Object.defineProperty(vscode.workspace, 'applyEdit', {
        value: originalApplyEdit,
        configurable: true
      });
    }
  });

  test('blocks apply before mutation when the document is not yet saved to disk', async () => {
    const markdownSource = 'Original paragraph.\n\nTrailing paragraph.';
    const suggestion = createSuggestion(markdownSource, 'Rewritten paragraph.');
    const document = createMockDocument(markdownSource, {
      isUntitled: true
    });
    const originalApplyEdit = vscode.workspace.applyEdit;
    let applyEditCalls = 0;

    Object.defineProperty(vscode.workspace, 'applyEdit', {
      value: async () => {
        applyEditCalls += 1;
        return true;
      },
      configurable: true
    });

    try {
      await assert.rejects(
        () => applySuggestedEdit(document, suggestion),
        (error: unknown) => {
          assert.ok(error instanceof EditApplicationError);
          assert.equal(error.reasonCode, 'save-required');
          return true;
        }
      );
      assert.equal(applyEditCalls, 0);
    } finally {
      Object.defineProperty(vscode.workspace, 'applyEdit', {
        value: originalApplyEdit,
        configurable: true
      });
    }
  });

  test('reports a clear failure when disk persistence fails after the edit is applied', async () => {
    const markdownSource = 'Original paragraph.\n\nTrailing paragraph.';
    const suggestion = createSuggestion(markdownSource, 'Rewritten paragraph.');
    const document = createMockDocument(markdownSource, {
      save: async () => false
    });
    const originalApplyEdit = vscode.workspace.applyEdit;
    let applyEditCalls = 0;

    Object.defineProperty(vscode.workspace, 'applyEdit', {
      value: async () => {
        applyEditCalls += 1;
        return true;
      },
      configurable: true
    });

    try {
      await assert.rejects(
        () => applySuggestedEdit(document, suggestion),
        (error: unknown) => {
          assert.ok(error instanceof EditApplicationError);
          assert.equal(error.reasonCode, 'save-failed');
          return true;
        }
      );
      assert.equal(applyEditCalls, 1);
    } finally {
      Object.defineProperty(vscode.workspace, 'applyEdit', {
        value: originalApplyEdit,
        configurable: true
      });
    }
  });
});
