export const PRESENTATION_PRESETS = [
  {
    id: 'balanced',
    label: 'Balanced',
    description: 'Flat default for everyday Markdown reading'
  },
  {
    id: 'dense-spec',
    label: 'Dense Spec',
    description: 'Wider, tighter view for long technical docs'
  },
  {
    id: 'comfortable-reading',
    label: 'Comfortable Reading',
    description: 'Relaxed spacing with a softer surface treatment'
  },
  {
    id: 'review-focus',
    label: 'Review Focus',
    description: 'Flat view with stronger review and selection emphasis'
  }
] as const;

export type PresentationPreset = (typeof PRESENTATION_PRESETS)[number]['id'];

export const DEFAULT_PRESENTATION_PRESET: PresentationPreset = 'balanced';

export function isPresentationPreset(value: unknown): value is PresentationPreset {
  return PRESENTATION_PRESETS.some((preset) => preset.id === value);
}

export function normalizePresentationPreset(value: unknown): PresentationPreset {
  return isPresentationPreset(value) ? value : DEFAULT_PRESENTATION_PRESET;
}

export function getPresentationPresetLabel(preset: PresentationPreset): string {
  return PRESENTATION_PRESETS.find((entry) => entry.id === preset)?.label ?? 'Balanced';
}
