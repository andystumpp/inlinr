import * as vscode from 'vscode';
import { reopenWithDefaultEditor } from './commands/reopenWithDefaultEditor';
import { MarkdownCustomEditorProvider } from './editors/markdownCustomEditorProvider';
import { DocumentSessionController } from './sessions/documentSessionController';

export function activate(context: vscode.ExtensionContext): void {
  const sessionController = new DocumentSessionController();
  const provider = new MarkdownCustomEditorProvider(context.extensionUri, sessionController);

  context.subscriptions.push(
    provider,
    vscode.window.registerCustomEditorProvider(MarkdownCustomEditorProvider.viewType, provider, {
      supportsMultipleEditorsPerDocument: true
    }),
    vscode.commands.registerCommand('inlinr.reopenWithDefaultEditor', (uri?: vscode.Uri) => {
      return reopenWithDefaultEditor(uri);
    })
  );
}

export function deactivate(): void {
  // No-op.
}