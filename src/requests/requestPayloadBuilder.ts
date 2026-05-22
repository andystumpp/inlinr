import { randomUUID } from 'node:crypto';
import { buildMarkedDocumentMarkdown } from './documentDraftMarkers';
import type { SelectionAnchor } from './selectionAnchorResolver';

export interface EffectiveSelectionScope {
  scopeKind: 'exact-selection' | 'containing-list-item';
  visibleSourceStart: number;
  visibleSourceEnd: number;
  effectiveSourceStart: number;
  effectiveSourceEnd: number;
  selectedRegionIds: string[];
}

export interface SelectionScopedRequestPayload {
  requestId: string;
  documentUri: string;
  documentVersion: number;
  requestText: string;
  selectedMarkdown: string;
  documentMarkdown: string;
  selectionMarkerId: string;
  markedDocumentMarkdown: string;
  selectionAnchor: SelectionAnchor;
  effectiveSelectionScope: EffectiveSelectionScope;
  createdAt: string;
}

export interface BuildSelectionScopedRequestPayloadInput {
  documentUri: string;
  documentVersion: number;
  requestText: string;
  selectedMarkdown: string;
  documentMarkdown: string;
  selectionAnchor: SelectionAnchor;
  effectiveSelectionScope: EffectiveSelectionScope;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}

export function isSelectionScopedRequestPayload(value: unknown): value is SelectionScopedRequestPayload {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as Partial<SelectionScopedRequestPayload>;

  return (
    isNonEmptyString(candidate.requestId) &&
    isNonEmptyString(candidate.documentUri) &&
    typeof candidate.documentVersion === 'number' &&
    isNonEmptyString(candidate.requestText) &&
    isNonEmptyString(candidate.selectedMarkdown) &&
    isNonEmptyString(candidate.documentMarkdown) &&
    isNonEmptyString(candidate.selectionMarkerId) &&
    isNonEmptyString(candidate.markedDocumentMarkdown) &&
    !!candidate.selectionAnchor &&
    typeof candidate.selectionAnchor === 'object' &&
    isEffectiveSelectionScope(candidate.effectiveSelectionScope) &&
    typeof candidate.createdAt === 'string'
  );
}

export function assertValidSelectionScopedRequestPayload(value: unknown): asserts value is SelectionScopedRequestPayload {
  if (!isSelectionScopedRequestPayload(value)) {
    throw new TypeError('Invalid selection-scoped request payload.');
  }
}

export function buildSelectionScopedRequestPayload(
  input: BuildSelectionScopedRequestPayloadInput
): SelectionScopedRequestPayload {
  const requestId = randomUUID();
  const selectionMarkerId = requestId;
  const payload: SelectionScopedRequestPayload = {
    requestId,
    documentUri: input.documentUri,
    documentVersion: input.documentVersion,
    requestText: input.requestText,
    selectedMarkdown: input.selectedMarkdown,
    documentMarkdown: input.documentMarkdown,
    selectionMarkerId,
    markedDocumentMarkdown: buildMarkedDocumentMarkdown(input.documentMarkdown, input.selectionAnchor, selectionMarkerId),
    selectionAnchor: input.selectionAnchor,
    effectiveSelectionScope: input.effectiveSelectionScope,
    createdAt: new Date().toISOString()
  };

  assertValidSelectionScopedRequestPayload(payload);

  return payload;
}

function isEffectiveSelectionScope(value: unknown): value is EffectiveSelectionScope {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as Partial<EffectiveSelectionScope>;

  return (
    (candidate.scopeKind === 'exact-selection' || candidate.scopeKind === 'containing-list-item') &&
    isFiniteNumber(candidate.visibleSourceStart) &&
    isFiniteNumber(candidate.visibleSourceEnd) &&
    isFiniteNumber(candidate.effectiveSourceStart) &&
    isFiniteNumber(candidate.effectiveSourceEnd) &&
    isStringArray(candidate.selectedRegionIds)
  );
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every(isNonEmptyString);
}