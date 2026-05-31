import type * as vscode from 'vscode';
import type { FirstActionGuidanceViewState } from '../webview/viewerState';

const FIRST_ACTION_GUIDANCE_STORAGE_KEY = 'inlinr.firstActionGuidance';

export type FirstActionGuidanceCompletionSource = 'dismissed' | 'selection' | 'successful-request';

export interface FirstActionGuidanceCompletionRecord {
  completionSource: FirstActionGuidanceCompletionSource;
  completedAt: string;
}

function isCompletionSource(value: unknown): value is FirstActionGuidanceCompletionSource {
  return value === 'dismissed' || value === 'selection' || value === 'successful-request';
}

function isCompletionRecord(value: unknown): value is FirstActionGuidanceCompletionRecord {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as Partial<FirstActionGuidanceCompletionRecord>;

  return isCompletionSource(candidate.completionSource) && typeof candidate.completedAt === 'string' && candidate.completedAt.length > 0;
}

export class FirstActionGuidanceState {
  public constructor(
    private readonly globalState: Pick<vscode.Memento, 'get' | 'update'>,
    private readonly now: () => Date = () => new Date()
  ) {}

  public getCompletionRecord(): FirstActionGuidanceCompletionRecord | null {
    const storedValue = this.globalState.get<unknown>(FIRST_ACTION_GUIDANCE_STORAGE_KEY);

    return isCompletionRecord(storedValue) ? storedValue : null;
  }

  public isCompleted(): boolean {
    return this.getCompletionRecord() !== null;
  }

  public getPendingViewState(): FirstActionGuidanceViewState | null {
    if (this.isCompleted()) {
      return null;
    }

    return {
      title: 'Welcome to Inlinr — edit Markdown by asking, right where you select',
      body: 'Highlight Markdown you want to change, then describe the edit.',
      dismissLabel: 'Got it',
      completionState: 'pending'
    };
  }

  public async markCompleted(completionSource: FirstActionGuidanceCompletionSource): Promise<void> {
    if (this.isCompleted()) {
      return;
    }

    await this.globalState.update(FIRST_ACTION_GUIDANCE_STORAGE_KEY, {
      completionSource,
      completedAt: this.now().toISOString()
    } satisfies FirstActionGuidanceCompletionRecord);
  }

  public async reset(): Promise<void> {
    await this.globalState.update(FIRST_ACTION_GUIDANCE_STORAGE_KEY, undefined);
  }
}
