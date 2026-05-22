import * as vscode from 'vscode';
import type { SelectionScopedRequestPayload } from './requestPayloadBuilder';

export type ExecutionFailureReasonCode =
  | 'missing-capability'
  | 'access-denied'
  | 'quota-exceeded'
  | 'execution-error';

export interface ExecutionAvailability {
  available: boolean;
  reasonCode?: ExecutionFailureReasonCode;
  message?: string;
  modelId?: string;
}

export interface ExecutionResult {
  requestId: string;
  draftDocumentMarkdown: string;
  completedAt: string;
  modelId?: string;
}

export interface ExecutionService {
  checkAvailability(): Promise<ExecutionAvailability>;
  execute(payload: SelectionScopedRequestPayload, token?: vscode.CancellationToken): Promise<ExecutionResult>;
}

export class ExecutionServiceError extends Error {
  public constructor(
    public readonly reasonCode: ExecutionFailureReasonCode,
    message: string
  ) {
    super(message);
    this.name = 'ExecutionServiceError';
  }
}

type ChatModelResolver = () => Thenable<readonly vscode.LanguageModelChat[] | vscode.LanguageModelChat[]>;

function buildExecutionPrompt(payload: SelectionScopedRequestPayload): string {
  return [
    'Rewrite only the Markdown content inside the explicit selection markers according to the user request.',
    'You may restructure content inside the selection markers if needed.',
    'Do not change any Markdown content outside the selection markers.',
    'Return the full Markdown document and preserve the selection markers exactly.',
    'Do not include commentary or code fences.',
    '',
    'User request:',
    payload.requestText,
    '',
    'Selected Markdown:',
    payload.selectedMarkdown,
    '',
    'Selection marker id:',
    payload.selectionMarkerId,
    '',
    'Marked full document Markdown:',
    payload.markedDocumentMarkdown
  ].join('\n');
}

function toExecutionServiceError(error: unknown): ExecutionServiceError {
  if (error instanceof ExecutionServiceError) {
    return error;
  }

  if (error instanceof vscode.LanguageModelError) {
    switch (error.code) {
      case 'NotFound':
        return new ExecutionServiceError('missing-capability', error.message || 'No supported Copilot-backed model is available.');
      case 'NoPermissions':
        return new ExecutionServiceError('access-denied', error.message || 'The current environment does not allow model execution.');
      case 'Blocked':
        return new ExecutionServiceError('quota-exceeded', error.message || 'Model execution is currently blocked.');
      default:
        return new ExecutionServiceError('execution-error', error.message || 'Model execution failed.');
    }
  }

  if (error instanceof Error) {
    return new ExecutionServiceError('execution-error', error.message || 'Model execution failed.');
  }

  return new ExecutionServiceError('execution-error', 'Model execution failed.');
}

export class UnsupportedExecutionService implements ExecutionService {
  public async checkAvailability(): Promise<ExecutionAvailability> {
    return {
      available: false,
      reasonCode: 'missing-capability',
      message: 'The current environment does not expose a supported Copilot-backed execution path.'
    };
  }

  public async execute(
    _payload: SelectionScopedRequestPayload,
    _token?: vscode.CancellationToken
  ): Promise<ExecutionResult> {
    throw new ExecutionServiceError(
      'missing-capability',
      'The current environment does not expose a supported Copilot-backed execution path.'
    );
  }
}

export class VscodeLanguageModelExecutionService implements ExecutionService {
  public constructor(
    private readonly extensionContext: vscode.ExtensionContext,
    private readonly resolveChatModels: ChatModelResolver = () => vscode.lm.selectChatModels({ vendor: 'copilot' })
  ) {}

  public async checkAvailability(): Promise<ExecutionAvailability> {
    try {
      const model = await this.resolveModel();

      return {
        available: true,
        modelId: model.id
      };
    } catch (error) {
      const executionError = toExecutionServiceError(error);

      return {
        available: false,
        reasonCode: executionError.reasonCode,
        message: executionError.message
      };
    }
  }

  public async execute(
    payload: SelectionScopedRequestPayload,
    token: vscode.CancellationToken = new vscode.CancellationTokenSource().token
  ): Promise<ExecutionResult> {
    const model = await this.resolveModel();

    try {
      const response = await model.sendRequest(
        [vscode.LanguageModelChatMessage.User(buildExecutionPrompt(payload))],
        {
          justification: 'Generate a selection-scoped Markdown rewrite for text the user explicitly selected in Inlinr.'
        },
        token
      );

      let draftDocumentMarkdown = '';

      for await (const chunk of response.text) {
        draftDocumentMarkdown += chunk;
      }

      const normalizedDraft = draftDocumentMarkdown.trim();

      if (normalizedDraft.length === 0) {
        throw new ExecutionServiceError('execution-error', 'The model returned no document draft.');
      }

      return {
        requestId: payload.requestId,
        draftDocumentMarkdown: normalizedDraft,
        completedAt: new Date().toISOString(),
        modelId: model.id
      };
    } catch (error) {
      throw toExecutionServiceError(error);
    }
  }

  private async resolveModel(): Promise<vscode.LanguageModelChat> {
    const models = [...(await this.resolveChatModels())];

    if (models.length === 0) {
      throw new ExecutionServiceError('missing-capability', 'No supported Copilot-backed model is available.');
    }

    const explicitlyAllowedModel = models.find((model) => {
      return this.extensionContext.languageModelAccessInformation.canSendRequest(model) !== false;
    });

    if (explicitlyAllowedModel) {
      return explicitlyAllowedModel;
    }

    throw new ExecutionServiceError('access-denied', 'The current environment does not allow model execution.');
  }
}