import * as vscode from 'vscode';
import { reopenWithDefaultEditor } from './commands/reopenWithDefaultEditor';
import { MarkdownCustomEditorProvider } from './editors/markdownCustomEditorProvider';
import { InMemoryRequestService } from './requests/requestService';
import { DocumentSessionController } from './sessions/documentSessionController';
import type { SelectionScopedRequestPayload } from './requests/requestPayloadBuilder';

export function activate(context: vscode.ExtensionContext): void {
  const sessionController = new DocumentSessionController();
  const requestService = new InMemoryRequestService<SelectionScopedRequestPayload>();
  const provider = new MarkdownCustomEditorProvider(context.extensionUri, sessionController, requestService);

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