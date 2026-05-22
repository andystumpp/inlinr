import {
  EMPTY_RENDERED_SELECTION_METADATA,
  assertValidRenderedSelectionMetadata,
  type RenderedSelectionMetadata
} from '../rendering/renderedSelectionMetadata';
import type { ActiveRequestState } from '../sessions/documentSessionController';

export type ViewerErrorReasonCode =
  | 'missing-document'
  | 'unreadable-document'
  | 'render-failed'
  | 'unsupported-content';

export interface SuggestedEditViewState {
  proposalId: string;
  previewMode: 'blended-inline';
  replacementMarkdown: string;
}

export interface ActiveRequestViewState {
  sessionId: string;
  selectedTextPreview: string;
  selectedRegionIds: string[];
  validationState: ActiveRequestState;
  validationMessage?: string;
  draftText: string;
  suggestion?: SuggestedEditViewState;
}

export interface ViewerRenderedState {
  kind: 'rendered';
  uri: string;
  title: string;
  documentVersion: number;
  previewOnly: true;
  sourceMode: false;
  canFallbackToDefaultEditor: false;
  html: string;
  selectionMode: 'enabled';
  activeRequest: ActiveRequestViewState | null;
  selectionMetadata: RenderedSelectionMetadata;
}

export interface ViewerErrorState {
  kind: 'error';
  uri: string;
  title: string;
  documentVersion: number;
  previewOnly: true;
  canFallbackToDefaultEditor: false;
  message: string;
  reasonCode: ViewerErrorReasonCode;
}

export type ViewerState = ViewerRenderedState | ViewerErrorState;

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every(isNonEmptyString);
}

function isSuggestedEditViewState(value: unknown): value is SuggestedEditViewState {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as Partial<SuggestedEditViewState>;

  return (
    isNonEmptyString(candidate.proposalId) &&
    candidate.previewMode === 'blended-inline' &&
    typeof candidate.replacementMarkdown === 'string'
  );
}

export function isActiveRequestViewState(value: unknown): value is ActiveRequestViewState {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as Partial<ActiveRequestViewState>;

  return (
    isNonEmptyString(candidate.sessionId) &&
    isNonEmptyString(candidate.selectedTextPreview) &&
    isStringArray(candidate.selectedRegionIds) &&
    isNonEmptyString(candidate.validationState) &&
    typeof candidate.draftText === 'string' &&
    (candidate.validationMessage === undefined || isNonEmptyString(candidate.validationMessage)) &&
    (candidate.suggestion === undefined || isSuggestedEditViewState(candidate.suggestion))
  );
}

export function createRenderedState(input: {
  uri: string;
  title: string;
  documentVersion: number;
  html: string;
  selectionMetadata?: RenderedSelectionMetadata;
  activeRequest?: ActiveRequestViewState | null;
}): ViewerRenderedState {
  return {
    kind: 'rendered',
    uri: input.uri,
    title: input.title,
    documentVersion: input.documentVersion,
    previewOnly: true,
    sourceMode: false,
    canFallbackToDefaultEditor: false,
    html: input.html,
    selectionMode: 'enabled',
    activeRequest: input.activeRequest ?? null,
    selectionMetadata: input.selectionMetadata ?? EMPTY_RENDERED_SELECTION_METADATA
  };
}

export function createErrorState(input: {
  uri: string;
  title: string;
  documentVersion: number;
  message: string;
  reasonCode: ViewerErrorReasonCode;
}): ViewerErrorState {
  return {
    kind: 'error',
    uri: input.uri,
    title: input.title,
    documentVersion: input.documentVersion,
    previewOnly: true,
    canFallbackToDefaultEditor: false,
    message: input.message,
    reasonCode: input.reasonCode
  };
}

export function isViewerState(value: unknown): value is ViewerState {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as Partial<ViewerState>;

  if (!isNonEmptyString(candidate.uri) || !isNonEmptyString(candidate.title) || typeof candidate.documentVersion !== 'number') {
    return false;
  }

  if (candidate.previewOnly !== true || candidate.canFallbackToDefaultEditor !== false) {
    return false;
  }

  if (candidate.kind === 'rendered') {
    return (
      candidate.sourceMode === false &&
      isNonEmptyString(candidate.html) &&
      candidate.selectionMode === 'enabled' &&
      (candidate.activeRequest === null || isActiveRequestViewState(candidate.activeRequest)) &&
      assertRenderedSelectionMetadata(candidate.selectionMetadata)
    );
  }

  if (candidate.kind === 'error') {
    return isNonEmptyString(candidate.message) && isNonEmptyString(candidate.reasonCode);
  }

  return false;
}

export function assertValidViewerState(value: unknown): asserts value is ViewerState {
  if (!isViewerState(value)) {
    throw new TypeError('Invalid viewer state payload.');
  }
}

function assertRenderedSelectionMetadata(value: unknown): boolean {
  try {
    assertValidRenderedSelectionMetadata(value);
    return true;
  } catch {
    return false;
  }
}