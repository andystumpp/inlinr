import * as vscode from 'vscode';

function getActiveCustomEditorUri(): vscode.Uri | undefined {
  const activeTab = vscode.window.tabGroups.activeTabGroup.activeTab;

  if (activeTab?.input instanceof vscode.TabInputCustom) {
    return activeTab.input.uri;
  }

  return undefined;
}

export async function reopenWithDefaultEditor(uri?: vscode.Uri): Promise<void> {
  const targetUri = uri ?? getActiveCustomEditorUri();

  if (!targetUri) {
    await vscode.window.showInformationMessage('Open an Inlinr Markdown viewer before using this command.');
    return;
  }

  await vscode.commands.executeCommand('vscode.openWith', targetUri, 'default');
}