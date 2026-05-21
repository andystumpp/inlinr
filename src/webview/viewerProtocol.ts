export interface SelectionCaptureMessage {
  type: 'selection.capture';
  documentVersion: number;
  selectedText: string;
  startMarker: string;
  endMarker: string;
  renderedRegionIds: string[];
  selectionRect?: {
    top: number;
    left: number;
    bottom: number;
    right: number;
  };
}

export interface RequestDraftChangeMessage {
  type: 'request.draftChanged';
  sessionId: string;
  draftText: string;
}

export interface RequestSubmitMessage {
  type: 'request.submit';
  sessionId: string;
  draftText: string;
}

export interface RequestCancelMessage {
  type: 'request.cancel';
  sessionId: string;
}

export type ViewerToExtensionMessage =
  | SelectionCaptureMessage
  | RequestDraftChangeMessage
  | RequestSubmitMessage
  | RequestCancelMessage;

export interface ViewerStateMessage {
  type: 'viewer.state';
}

export interface SelectionAcceptedMessage {
  type: 'selection.accepted';
  sessionId: string;
  selectedTextPreview: string;
  selectedRegionIds: string[];
  draftText: string;
  validationState: 'drafting' | 'invalid' | 'submitting' | 'submitted';
  validationMessage?: string;
}

export interface SelectionRejectedMessage {
  type: 'selection.rejected';
  message: string;
}

export interface RequestInvalidatedMessage {
  type: 'request.invalidated';
  sessionId: string;
  message: string;
}

export interface RequestSubmittedMessage {
  type: 'request.submitted';
  sessionId: string;
  message: string;
}

export type ExtensionToViewerMessage =
  | ViewerStateMessage
  | SelectionAcceptedMessage
  | SelectionRejectedMessage
  | RequestInvalidatedMessage
  | RequestSubmittedMessage;

function isSelectionRect(
  value: unknown
): value is { top: number; left: number; bottom: number; right: number } {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as { top?: unknown; left?: unknown; bottom?: unknown; right?: unknown };

  return (
    isFiniteNumber(candidate.top) &&
    isFiniteNumber(candidate.left) &&
    isFiniteNumber(candidate.bottom) &&
    isFiniteNumber(candidate.right)
  );
}

function isOptionalSelectionRect(
  value: unknown
): value is { top: number; left: number; bottom: number; right: number } | undefined {
  return value === undefined || isSelectionRect(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every(isNonEmptyString);
}

export function isViewerToExtensionMessage(value: unknown): value is ViewerToExtensionMessage {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as Partial<ViewerToExtensionMessage>;

  switch (candidate.type) {
    case 'selection.capture':
      return (
        isFiniteNumber(candidate.documentVersion) &&
        isNonEmptyString(candidate.selectedText) &&
        isNonEmptyString(candidate.startMarker) &&
        isNonEmptyString(candidate.endMarker) &&
        isStringArray(candidate.renderedRegionIds) &&
        isOptionalSelectionRect(candidate.selectionRect)
      );
    case 'request.draftChanged':
      return isNonEmptyString(candidate.sessionId) && typeof candidate.draftText === 'string';
    case 'request.submit':
      return isNonEmptyString(candidate.sessionId) && typeof candidate.draftText === 'string';
    case 'request.cancel':
      return isNonEmptyString(candidate.sessionId);
    default:
      return false;
  }
}

export function assertValidViewerToExtensionMessage(value: unknown): asserts value is ViewerToExtensionMessage {
  if (!isViewerToExtensionMessage(value)) {
    throw new TypeError('Invalid viewer-to-extension message payload.');
  }
}