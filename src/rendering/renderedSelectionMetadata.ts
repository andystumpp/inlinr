export type SupportedSelectionRegionKind =
  | 'paragraph'
  | 'blockquote'
  | 'table-cell'
  | 'list-item-prose'
  | 'inline-span';

export interface RenderedSelectionMarker {
  markerId: string;
  regionId: string;
  sourceOffset: number;
}

export interface SupportedSelectionRegion {
  regionId: string;
  kind: SupportedSelectionRegionKind;
  sourceStart: number;
  sourceEnd: number;
  selectable: boolean;
}

export interface RenderedSelectionMetadata {
  regions: SupportedSelectionRegion[];
  markers: RenderedSelectionMarker[];
}

export const EMPTY_RENDERED_SELECTION_METADATA: RenderedSelectionMetadata = {
  regions: [],
  markers: []
};

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}

export function isRenderedSelectionMetadata(value: unknown): value is RenderedSelectionMetadata {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as Partial<RenderedSelectionMetadata>;

  if (!Array.isArray(candidate.regions) || !Array.isArray(candidate.markers)) {
    return false;
  }

  return candidate.regions.every((region) => {
    const candidateRegion = region as Partial<SupportedSelectionRegion>;

    return (
      isNonEmptyString(candidateRegion.regionId) &&
      isNonEmptyString(candidateRegion.kind) &&
      isFiniteNumber(candidateRegion.sourceStart) &&
      isFiniteNumber(candidateRegion.sourceEnd) &&
      typeof candidateRegion.selectable === 'boolean'
    );
  }) && candidate.markers.every((marker) => {
    const candidateMarker = marker as Partial<RenderedSelectionMarker>;

    return (
      isNonEmptyString(candidateMarker.markerId) &&
      isNonEmptyString(candidateMarker.regionId) &&
      isFiniteNumber(candidateMarker.sourceOffset)
    );
  });
}

export function assertValidRenderedSelectionMetadata(value: unknown): asserts value is RenderedSelectionMetadata {
  if (!isRenderedSelectionMetadata(value)) {
    throw new TypeError('Invalid rendered selection metadata payload.');
  }
}