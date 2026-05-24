import * as vscode from 'vscode';
import { reopenWithDefaultEditor } from './commands/reopenWithDefaultEditor';
import { MarkdownCustomEditorProvider } from './editors/markdownCustomEditorProvider';
import { VscodeLanguageModelExecutionService } from './requests/executionService';
import { InMemoryRequestService } from './requests/requestService';
import { DocumentSessionController } from './sessions/documentSessionController';
import { createTelemetryAdapter } from './telemetry/telemetryAdapter';
import { getTelemetryCloudRoleName, isTelemetrySamplingConfigured } from './telemetry/applicationInsightsSink';
import type { SelectionScopedRequestPayload } from './requests/requestPayloadBuilder';

export function activate(context: vscode.ExtensionContext): void {
  const sessionController = new DocumentSessionController();
  const requestService = new InMemoryRequestService<SelectionScopedRequestPayload>();
  const executionService = new VscodeLanguageModelExecutionService(context);
  const telemetryAdapter = createTelemetryAdapter({
    environment: process.env,
    cloudRoleName: getTelemetryCloudRoleName(process.env, context.extension.id),
    samplingEnabled: isTelemetrySamplingConfigured(process.env)
  });
  const provider = new MarkdownCustomEditorProvider(
    context.extensionUri,
    sessionController,
    requestService,
    executionService,
    telemetryAdapter
  );

  context.subscriptions.push(
    new vscode.Disposable(() => {
      void telemetryAdapter.dispose();
    }),
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