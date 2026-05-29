import * as vscode from 'vscode';
import { revalidateSelectionAnchor } from './selectionAnchorResolver';
import type { NormalizedSuggestedEdit } from './suggestionNormalizer';

export interface ApplySuggestedEditResult {
  proposalId: string;
  appliedDocumentVersion: number;
  sourceStart: number;
  sourceEnd: number;
  appliedAt: string;
  persistedToDisk: boolean;
}

export class EditApplicationError extends Error {
  public constructor(
    public readonly reasonCode:
      | 'ambiguous-target'
      | 'missing-target'
      | 'incompatible-suggestion'
      | 'apply-failed'
      | 'save-required'
      | 'save-failed',
    message: string
  ) {
    super(message);
    this.name = 'EditApplicationError';
  }
}

function ensureDocumentCanPersist(document: vscode.TextDocument): void {
  if (!document.isUntitled && document.uri.scheme === 'file') {
    return;
  }

  throw new EditApplicationError(
    'save-required',
    'Save the Markdown document to disk before applying suggestions.'
  );
}

export function resolveSuggestedEditRange(markdownSource: string, suggestion: NormalizedSuggestedEdit): {
  sourceStart: number;
  sourceEnd: number;
  replacementMarkdown: string;
} {
  const revalidation = revalidateSelectionAnchor(markdownSource, suggestion.selectionAnchor);

  if (!revalidation.match || revalidation.status === 'missing') {
    throw new EditApplicationError('missing-target', 'The target changed. Reselect before applying.');
  }

  if (revalidation.status === 'ambiguous') {
    throw new EditApplicationError('ambiguous-target', 'The target changed. Reselect before applying.');
  }

  return {
    sourceStart: revalidation.match.sourceStart,
    sourceEnd: revalidation.match.sourceEnd,
    replacementMarkdown: suggestion.replacementMarkdown
  };
}

export async function applySuggestedEdit(
  document: vscode.TextDocument,
  suggestion: NormalizedSuggestedEdit
): Promise<ApplySuggestedEditResult> {
  ensureDocumentCanPersist(document);
  const mutation = resolveSuggestedEditRange(document.getText(), suggestion);
  const edit = new vscode.WorkspaceEdit();

  edit.replace(
    document.uri,
    new vscode.Range(document.positionAt(mutation.sourceStart), document.positionAt(mutation.sourceEnd)),
    mutation.replacementMarkdown
  );

  const applied = await vscode.workspace.applyEdit(edit);

  if (!applied) {
    throw new EditApplicationError('apply-failed', 'The suggested edit could not be applied.');
  }

  const saved = await document.save();

  if (!saved) {
    throw new EditApplicationError(
      'save-failed',
      'The suggestion changed the editor buffer but could not be saved to disk. Save the document manually before continuing.'
    );
  }

  return {
    proposalId: suggestion.proposalId,
    appliedDocumentVersion: document.version,
    sourceStart: mutation.sourceStart,
    sourceEnd: mutation.sourceEnd,
    appliedAt: new Date().toISOString(),
    persistedToDisk: true
  };
}
