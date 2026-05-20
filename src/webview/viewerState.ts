export type ViewerErrorReasonCode =
  | 'missing-document'
  | 'unreadable-document'
  | 'render-failed'
  | 'unsupported-content';

export interface ViewerRenderedState {
  kind: 'rendered';
  uri: string;
  title: string;
  documentVersion: number;
  previewOnly: true;
  sourceMode: false;
  canFallbackToDefaultEditor: false;
  html: string;
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

export function createRenderedState(input: {
  uri: string;
  title: string;
  documentVersion: number;
  html: string;
}): ViewerRenderedState {
  return {
    kind: 'rendered',
    uri: input.uri,
    title: input.title,
    documentVersion: input.documentVersion,
    previewOnly: true,
    sourceMode: false,
    canFallbackToDefaultEditor: false,
    html: input.html
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
    return candidate.sourceMode === false && isNonEmptyString(candidate.html);
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