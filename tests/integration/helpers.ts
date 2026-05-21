import assert from 'node:assert/strict';
import path from 'node:path';
import * as vscode from 'vscode';

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