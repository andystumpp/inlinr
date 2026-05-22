import assert from 'node:assert/strict';
import path from 'node:path';
import * as vscode from 'vscode';
import {
  ExecutionServiceError,
  type ExecutionAvailability,
  type ExecutionResult,
  type ExecutionService
} from '../../src/requests/executionService';
import { extractMarkedDocumentRange, getSelectionMarkerTokens } from '../../src/requests/documentDraftMarkers';
import type { SelectionScopedRequestPayload } from '../../src/requests/requestPayloadBuilder';

export interface FakeExecutionOutcome {
  kind: 'success' | 'failure' | 'unavailable';
  replacementMarkdown?: string;
  draftDocumentMarkdown?: string;
  rangeDisposition?: 'contained' | 'out-of-range';
  message?: string;
}

function buildDraftDocumentMarkdown(payload: SelectionScopedRequestPayload, replacementMarkdown: string): string {
  const originalRange = extractMarkedDocumentRange(payload.markedDocumentMarkdown, payload.selectionMarkerId);
  const { startMarker, endMarker } = getSelectionMarkerTokens(payload.selectionMarkerId);

  return [
    originalRange.beforeMarkdown,
    startMarker,
    replacementMarkdown,
    endMarker,
    originalRange.afterMarkdown
  ].join('');
}

export class FakeExecutionService implements ExecutionService {
  private readonly outcomes: FakeExecutionOutcome[];

  public constructor(outcomes: FakeExecutionOutcome | FakeExecutionOutcome[]) {
    this.outcomes = Array.isArray(outcomes) ? [...outcomes] : [outcomes];
  }

  public async checkAvailability(): Promise<ExecutionAvailability> {
    const nextOutcome = this.outcomes[0];

    if (nextOutcome?.kind === 'unavailable') {
      return {
        available: false,
        reasonCode: 'missing-capability',
        message: nextOutcome.message ?? 'Execution is unavailable.'
      };
    }

    return {
      available: true,
      modelId: 'fake-copilot-model'
    };
  }

  public async execute(payload: SelectionScopedRequestPayload): Promise<ExecutionResult> {
    const nextOutcome = this.outcomes.shift() ?? {
      kind: 'success',
      replacementMarkdown: payload.selectedMarkdown
    };

    if (nextOutcome.kind === 'unavailable') {
      throw new ExecutionServiceError('missing-capability', nextOutcome.message ?? 'Execution is unavailable.');
    }

    if (nextOutcome.kind === 'failure') {
      throw new ExecutionServiceError('execution-error', nextOutcome.message ?? 'Execution failed.');
    }

    return {
      requestId: payload.requestId,
      draftDocumentMarkdown:
        nextOutcome.draftDocumentMarkdown ??
        (nextOutcome.rangeDisposition === 'out-of-range'
          ? `Changed before. ${buildDraftDocumentMarkdown(payload, nextOutcome.replacementMarkdown ?? payload.selectedMarkdown)}`
          : buildDraftDocumentMarkdown(payload, nextOutcome.replacementMarkdown ?? payload.selectedMarkdown)),
      completedAt: new Date().toISOString(),
      modelId: 'fake-copilot-model'
    };
  }
}

export async function closeAllEditors(): Promise<void> {
  await vscode.commands.executeCommand('workbench.action.closeAllEditors');
}

export function getWorkspaceFile(relativePath: string): vscode.Uri {
  const workspaceFolder = vscode.workspace.workspaceFolders?.[0]?.uri;
  assert.ok(workspaceFolder, 'Expected the integration test workspace to be open.');
  return vscode.Uri.joinPath(workspaceFolder, relativePath);
}

export async function openWorkspaceFile(relativePath: string): Promise<vscode.Uri> {
  const target = getWorkspaceFile(relativePath);
  await vscode.commands.executeCommand('vscode.open', target);
  return target;
}

export async function openWorkspaceFileWithEditor(relativePath: string, viewType: string): Promise<vscode.Uri> {
  const target = getWorkspaceFile(relativePath);
  await vscode.commands.executeCommand('vscode.openWith', target, viewType);
  return target;
}

export async function waitFor<T>(
  getValue: () => T | undefined,
  predicate: (value: T) => boolean,
  timeoutMs = 10000
): Promise<T> {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    const value = getValue();

    if (value !== undefined && predicate(value)) {
      return value;
    }

    await new Promise((resolve) => setTimeout(resolve, 50));
  }

  throw new Error(`Timed out after ${timeoutMs}ms.`);
}

export function findPostedMessage<T extends { type: string }>(
  postedMessages: unknown[],
  type: T['type']
): T | undefined {
  return postedMessages.find((message): message is T => {
    return typeof message === 'object' && message !== null && 'type' in message && message.type === type;
  });
}

export function createSuccessfulExecutionOutcome(replacementMarkdown: string): FakeExecutionOutcome {
  return {
    kind: 'success',
    replacementMarkdown
  };
}

export function createSuccessfulDraftExecutionOutcome(draftDocumentMarkdown: string): FakeExecutionOutcome {
  return {
    kind: 'success',
    draftDocumentMarkdown
  };
}

export function createOutOfRangeExecutionOutcome(replacementMarkdown: string): FakeExecutionOutcome {
  return {
    kind: 'success',
    replacementMarkdown,
    rangeDisposition: 'out-of-range'
  };
}

export function createFailedExecutionOutcome(message: string): FakeExecutionOutcome {
  return {
    kind: 'failure',
    message
  };
}

export function createUnavailableExecutionOutcome(message: string): FakeExecutionOutcome {
  return {
    kind: 'unavailable',
    message
  };
}

export function getActiveCustomTabInput(): vscode.TabInputCustom | undefined {
  const input = vscode.window.tabGroups.activeTabGroup.activeTab?.input;
  return input instanceof vscode.TabInputCustom ? input : undefined;
}

export function getExtensionUri(): vscode.Uri {
  return vscode.Uri.file(path.resolve(__dirname, '..', '..', '..'));
}

export function createMockWebviewPanel(): {
  panel: vscode.WebviewPanel;
  webview: vscode.Webview;
  postedMessages: unknown[];
  sendMessageToExtension: (message: unknown) => void;
} {
  const didDisposeEmitter = new vscode.EventEmitter<void>();
  const didChangeViewStateEmitter = new vscode.EventEmitter<vscode.WebviewPanelOnDidChangeViewStateEvent>();
  const didReceiveMessageEmitter = new vscode.EventEmitter<unknown>();
  const postedMessages: unknown[] = [];
  const webview = {
    html: '',
    options: {},
    cspSource: 'https://inlinr.test',
    asWebviewUri: (uri: vscode.Uri) => uri,
    onDidReceiveMessage: didReceiveMessageEmitter.event,
    postMessage: async (message: unknown) => {
      postedMessages.push(message);
      return true;
    }
  } as unknown as vscode.Webview;

  const panel = {
    viewType: 'inlinr.markdownViewer',
    title: '',
    description: undefined,
    iconPath: undefined,
    active: true,
    visible: true,
    viewColumn: vscode.ViewColumn.Active,
    webview,
    onDidDispose: didDisposeEmitter.event,
    onDidChangeViewState: didChangeViewStateEmitter.event,
    reveal: () => undefined,
    dispose: () => {
      didDisposeEmitter.fire();
      didDisposeEmitter.dispose();
      didChangeViewStateEmitter.dispose();
      didReceiveMessageEmitter.dispose();
    }
  } as unknown as vscode.WebviewPanel;

  return {
    panel,
    webview,
    postedMessages,
    sendMessageToExtension: (message: unknown) => {
      didReceiveMessageEmitter.fire(message);
    }
  };
}