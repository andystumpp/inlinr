import type { SelectionAnchor } from './selectionAnchorResolver';

export interface SelectionMarkerTokens {
  selectionMarkerId: string;
  startMarker: string;
  endMarker: string;
}

export interface MarkedDocumentRange {
  beforeMarkdown: string;
  selectedMarkdown: string;
  afterMarkdown: string;
}

export function getSelectionMarkerTokens(selectionMarkerId: string): SelectionMarkerTokens {
  return {
    selectionMarkerId,
    startMarker: `<<<INLINR_SELECTION_START:${selectionMarkerId}>>>`,
    endMarker: `<<<INLINR_SELECTION_END:${selectionMarkerId}>>>`
  };
}

export function buildMarkedDocumentMarkdown(
  documentMarkdown: string,
  selectionAnchor: Pick<SelectionAnchor, 'sourceStart' | 'sourceEnd'>,
  selectionMarkerId: string
): string {
  const { startMarker, endMarker } = getSelectionMarkerTokens(selectionMarkerId);

  return [
    documentMarkdown.slice(0, selectionAnchor.sourceStart),
    startMarker,
    documentMarkdown.slice(selectionAnchor.sourceStart, selectionAnchor.sourceEnd),
    endMarker,
    documentMarkdown.slice(selectionAnchor.sourceEnd)
  ].join('');
}

export function extractMarkedDocumentRange(
  markedDocumentMarkdown: string,
  selectionMarkerId: string
): MarkedDocumentRange {
  const { startMarker, endMarker } = getSelectionMarkerTokens(selectionMarkerId);
  const startIndex = markedDocumentMarkdown.indexOf(startMarker);
  const endIndex = markedDocumentMarkdown.indexOf(endMarker);

  if (startIndex === -1 || endIndex === -1 || endIndex < startIndex) {
    throw new TypeError('The generated draft did not preserve the selected range markers.');
  }

  const secondStartIndex = markedDocumentMarkdown.indexOf(startMarker, startIndex + startMarker.length);
  const secondEndIndex = markedDocumentMarkdown.indexOf(endMarker, endIndex + endMarker.length);

  if (secondStartIndex !== -1 || secondEndIndex !== -1) {
    throw new TypeError('The generated draft duplicated the selected range markers.');
  }

  return {
    beforeMarkdown: markedDocumentMarkdown.slice(0, startIndex),
    selectedMarkdown: markedDocumentMarkdown.slice(startIndex + startMarker.length, endIndex),
    afterMarkdown: markedDocumentMarkdown.slice(endIndex + endMarker.length)
  };
}