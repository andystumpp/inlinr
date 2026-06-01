import type * as vscode from 'vscode';
import {
  normalizePresentationPreset,
  type PresentationPreset
} from './presentationPresets';

const PRESENTATION_PRESET_STORAGE_KEY = 'inlinr.presentationPreset';

export class PresentationPresetState {
  public constructor(private readonly globalState: Pick<vscode.Memento, 'get' | 'update'>) {}

  public getCurrentPreset(): PresentationPreset {
    return normalizePresentationPreset(this.globalState.get<unknown>(PRESENTATION_PRESET_STORAGE_KEY));
  }

  public async setCurrentPreset(preset: PresentationPreset): Promise<void> {
    if (preset === this.getCurrentPreset()) {
      return;
    }

    await this.globalState.update(PRESENTATION_PRESET_STORAGE_KEY, preset);
  }

  public async reset(): Promise<void> {
    await this.globalState.update(PRESENTATION_PRESET_STORAGE_KEY, undefined);
  }
}

export { DEFAULT_PRESENTATION_PRESET } from './presentationPresets';
