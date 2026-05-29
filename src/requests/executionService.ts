import fs from 'node:fs';
import path from 'node:path';
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

const SELECTION_SCOPED_PROMPT_FILE_NAME = 'selection-scoped-edit.md';
const SONNET_MODEL_HINT_PATTERN = /\bsonnet\b/i;

function renderPromptTemplate(template: string, variables: Record<string, string>): string {
  const placeholderMatches = [...template.matchAll(/{{\s*([a-zA-Z0-9_]+)\s*}}/g)];
  const placeholderNames = [...new Set(placeholderMatches.map((match) => match[1]))];
  const missingVariables = placeholderNames.filter((variableName) => variables[variableName] === undefined);

  if (missingVariables.length > 0) {
    throw new Error(`Prompt template is missing variables: ${missingVariables.join(', ')}`);
  }

  return template.replace(/{{\s*([a-zA-Z0-9_]+)\s*}}/g, (_match, variableName: string) => {
    return variables[variableName];
  });
}

function loadSelectionScopedPromptTemplate(extensionPath: string): string {
  const promptFilePath = path.join(extensionPath, 'prompts', SELECTION_SCOPED_PROMPT_FILE_NAME);

  return fs.readFileSync(promptFilePath, 'utf8');
}

function buildExecutionPrompt(promptTemplate: string, payload: SelectionScopedRequestPayload): string {
  return renderPromptTemplate(promptTemplate, {
    requestText: payload.requestText,
    selectedMarkdown: payload.selectedMarkdown,
    selectionMarkerId: payload.selectionMarkerId,
    markedDocumentMarkdown: payload.markedDocumentMarkdown
  });
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
  private readonly selectionScopedPromptTemplate: string;

  public constructor(
    private readonly extensionContext: vscode.ExtensionContext,
    private readonly resolveChatModels: ChatModelResolver = () => vscode.lm.selectChatModels({ vendor: 'copilot' })
  ) {
    if (!extensionContext.extensionPath) {
      throw new ExecutionServiceError('execution-error', 'Unable to load prompts because extensionPath is unavailable.');
    }

    this.selectionScopedPromptTemplate = loadSelectionScopedPromptTemplate(extensionContext.extensionPath);
  }

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
    const promptText = buildExecutionPrompt(this.selectionScopedPromptTemplate, payload);

    try {
      const response = await model.sendRequest(
        [vscode.LanguageModelChatMessage.User(promptText)],
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

    const explicitlyAllowedModels = models.filter((model) => {
      return this.extensionContext.languageModelAccessInformation.canSendRequest(model) !== false;
    });

    if (explicitlyAllowedModels.length > 0) {
      return explicitlyAllowedModels
        .map((model, index) => ({ model, index, preferenceRank: getModelPreferenceRank(model) }))
        .sort((left, right) => {
          if (left.preferenceRank !== right.preferenceRank) {
            return left.preferenceRank - right.preferenceRank;
          }

          return left.index - right.index;
        })[0].model;
    }

    throw new ExecutionServiceError('access-denied', 'The current environment does not allow model execution.');
  }
}

function getModelPreferenceRank(model: vscode.LanguageModelChat): number {
  if (SONNET_MODEL_HINT_PATTERN.test(getModelIdentity(model))) {
    return 0;
  }

  return 1;
}

function getModelIdentity(model: vscode.LanguageModelChat): string {
  return [model.id, model.name, model.family]
    .filter((value): value is string => typeof value === 'string' && value.length > 0)
    .join(' ');
}
