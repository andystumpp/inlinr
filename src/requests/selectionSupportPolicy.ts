import type { SelectionCaptureMessage } from '../webview/viewerProtocol';

export interface SelectionSupportDecision {
  allowed: boolean;
  reason?: string;
}

export function normalizeRenderedRegionIds(renderedRegionIds: string[]): string[] {
  const uniqueRegionIds = new Set<string>();

  for (const renderedRegionId of renderedRegionIds) {
    if (renderedRegionId.length > 0) {
      uniqueRegionIds.add(renderedRegionId);
    }
  }

  return [...uniqueRegionIds];
}

export function evaluateSelectionSupport(message: SelectionCaptureMessage): SelectionSupportDecision {
  if (message.selectedText.trim().length === 0) {
    return {
      allowed: false,
      reason: 'Select non-empty prose before opening a request.'
    };
  }

  if (normalizeRenderedRegionIds(message.renderedRegionIds).length === 0) {
    return {
      allowed: false,
      reason: 'Select supported rendered prose before opening a request.'
    };
  }

  return {
    allowed: true
  };
}