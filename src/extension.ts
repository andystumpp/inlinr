import * as vscode from 'vscode';
import { openWithInlinrViewer } from './commands/openWithInlinrViewer';
import { reopenWithDefaultEditor } from './commands/reopenWithDefaultEditor';
import { MarkdownCustomEditorProvider } from './editors/markdownCustomEditorProvider';
import { FirstActionGuidanceState } from './onboarding/firstActionGuidanceState';
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
  const firstActionGuidanceState = new FirstActionGuidanceState(context.globalState);
  const telemetryAdapter = createTelemetryAdapter({
    environment: process.env,
    cloudRoleName: getTelemetryCloudRoleName(process.env, context.extension.id),
    samplingEnabled: isTelemetrySamplingConfigured(process.env),
    mode: vscode.env.isTelemetryEnabled ? undefined : 'noop'
  });
    const provider = new MarkdownCustomEditorProvider(
      context.extensionUri,
      sessionController,
      requestService,
      executionService,
      telemetryAdapter,
      firstActionGuidanceState
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
    }),
    vscode.commands.registerCommand('inlinr.openWithInlinrViewer', (uri?: vscode.Uri) => {
      return openWithInlinrViewer(uri);
    })
  );
}

export function deactivate(): void {
  // No-op.
}
