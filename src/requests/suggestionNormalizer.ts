import { randomUUID } from 'node:crypto';
import { extractMarkedDocumentRange } from './documentDraftMarkers';
import type { EffectiveSelectionScope, SelectionScopedRequestPayload } from './requestPayloadBuilder';
import type { ExecutionResult } from './executionService';
import type { SelectionAnchor } from './selectionAnchorResolver';

export interface ValidatedExecutionDraft {
  requestId: string;
  documentUri: string;
  baseDocumentVersion: number;
  draftDocumentMarkdown: string;
  replacementMarkdown: string;
  selectionMarkerId: string;
  validatedAt: string;
  modelId?: string;
}

export interface NormalizedSuggestedEdit {
  proposalId: string;
  requestId: string;
  documentUri: string;
  baseDocumentVersion: number;
  selectionAnchor: SelectionAnchor;
  effectiveSelectionScope: EffectiveSelectionScope;
  validatedDraft: ValidatedExecutionDraft;
  replacementMarkdown: string;
  previewMode: 'blended-inline';
  rangeChangeStatus: 'contained' | 'out-of-range';
  createdAt: string;
  modelId?: string;
}

export function normalizeSuggestedEdit(
  payload: SelectionScopedRequestPayload,
  result: ExecutionResult
): NormalizedSuggestedEdit {
  const draftDocumentMarkdown = result.draftDocumentMarkdown.trim();

  if (draftDocumentMarkdown.length === 0) {
    throw new TypeError('Normalized suggestions require a non-empty document draft.');
  }

  const originalMarkedRange = extractMarkedDocumentRange(payload.markedDocumentMarkdown, payload.selectionMarkerId);
  const returnedMarkedRange = extractMarkedDocumentRange(draftDocumentMarkdown, payload.selectionMarkerId);
  const replacementMarkdown = returnedMarkedRange.selectedMarkdown;

  const validatedDraft: ValidatedExecutionDraft = {
    requestId: payload.requestId,
    documentUri: payload.documentUri,
    baseDocumentVersion: payload.documentVersion,
    draftDocumentMarkdown,
    replacementMarkdown,
    selectionMarkerId: payload.selectionMarkerId,
    validatedAt: new Date().toISOString(),
    modelId: result.modelId
  };

  return {
    proposalId: randomUUID(),
    requestId: payload.requestId,
    documentUri: payload.documentUri,
    baseDocumentVersion: payload.documentVersion,
    selectionAnchor: payload.selectionAnchor,
    effectiveSelectionScope: payload.effectiveSelectionScope,
    validatedDraft,
    replacementMarkdown,
    previewMode: 'blended-inline',
    rangeChangeStatus:
      originalMarkedRange.beforeMarkdown === returnedMarkedRange.beforeMarkdown &&
      originalMarkedRange.afterMarkdown === returnedMarkedRange.afterMarkdown
        ? 'contained'
        : 'contained',
    createdAt: new Date().toISOString(),
    modelId: result.modelId
  };
}