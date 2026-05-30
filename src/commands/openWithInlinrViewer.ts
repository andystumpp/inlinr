import * as vscode from 'vscode';
import { MarkdownCustomEditorProvider } from '../editors/markdownCustomEditorProvider';

function getActiveTextEditorUri(): vscode.Uri | undefined {
  const activeTab = vscode.window.tabGroups.activeTabGroup.activeTab;

  if (activeTab?.input instanceof vscode.TabInputText) {
    return activeTab.input.uri;
  }

  return undefined;
}

export async function openWithInlinrViewer(uri?: vscode.Uri): Promise<void> {
  const targetUri = uri ?? getActiveTextEditorUri();

  if (!targetUri) {
    await vscode.window.showInformationMessage(
      'Please open a Markdown file or select one in the explorer before using this command.'
    );
    return;
  }

  await vscode.commands.executeCommand('vscode.openWith', targetUri, MarkdownCustomEditorProvider.viewType);
}
