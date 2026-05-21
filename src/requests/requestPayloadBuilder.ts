import { randomUUID } from 'node:crypto';
import type { SelectionAnchor } from './selectionAnchorResolver';

export interface SelectionScopedRequestPayload {
  requestId: string;
  documentUri: string;
  documentVersion: number;
  requestText: string;
  selectedMarkdown: string;
  selectionAnchor: SelectionAnchor;
  surroundingContext: {
    prefixMarkdown: string;
    suffixMarkdown: string;
  };
  createdAt: string;
}

export interface BuildSelectionScopedRequestPayloadInput {
  documentUri: string;
  documentVersion: number;
  requestText: string;
  selectedMarkdown: string;
  selectionAnchor: SelectionAnchor;
  prefixMarkdown: string;
  suffixMarkdown: string;
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
    !!candidate.selectionAnchor &&
    typeof candidate.selectionAnchor === 'object' &&
    !!candidate.surroundingContext &&
    typeof candidate.surroundingContext === 'object' &&
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
  const payload: SelectionScopedRequestPayload = {
    requestId: randomUUID(),
    documentUri: input.documentUri,
    documentVersion: input.documentVersion,
    requestText: input.requestText,
    selectedMarkdown: input.selectedMarkdown,
    selectionAnchor: input.selectionAnchor,
    surroundingContext: {
      prefixMarkdown: input.prefixMarkdown,
      suffixMarkdown: input.suffixMarkdown
    },
    createdAt: new Date().toISOString()
  };

  assertValidSelectionScopedRequestPayload(payload);

  return payload;
}