import assert from 'node:assert/strict';
import path from 'node:path';
import * as vscode from 'vscode';
import {
  VscodeLanguageModelExecutionService,
  type ExecutionAvailability
} from '../../src/requests/executionService';
import { buildSelectionScopedRequestPayload } from '../../src/requests/requestPayloadBuilder';
import { createSelectionAnchor } from '../../src/requests/selectionAnchorResolver';

function createPayload() {
  const markdownSource = 'Original paragraph for execution.';
  let capturedPrompt = '';

  return {
    payload: buildSelectionScopedRequestPayload({
      documentUri: 'file:///workspace/sample.md',
      documentVersion: 1,
      requestText: 'Tighten the wording.',
      selectedMarkdown: markdownSource,
      documentMarkdown: markdownSource,
      selectionAnchor: createSelectionAnchor({
        documentUri: 'file:///workspace/sample.md',
        capturedDocumentVersion: 1,
        markdownSource,
        sourceStart: 0,
        sourceEnd: markdownSource.length
      }),
      effectiveSelectionScope: {
        scopeKind: 'exact-selection',
        visibleSourceStart: 0,
        visibleSourceEnd: markdownSource.length,
        effectiveSourceStart: 0,
        effectiveSourceEnd: markdownSource.length,
        selectedRegionIds: ['region-0']
      }
    }),
    capturePrompt: (prompt: string) => {
      capturedPrompt = prompt;
    },
    getCapturedPrompt: () => capturedPrompt
  };
}

function createContext(canSendRequest: boolean | undefined): vscode.ExtensionContext {
  return {
    extensionPath: path.resolve(__dirname, '../../..'),
    languageModelAccessInformation: {
      onDidChange: new vscode.EventEmitter<void>().event,
      canSendRequest: () => canSendRequest
    }
  } as unknown as vscode.ExtensionContext;
}

suite('Execution service', () => {
  test('reports availability when a supported model can be used', async () => {
    const service = new VscodeLanguageModelExecutionService(createContext(true), async () => {
      return [
        ({
          id: 'copilot-test-model',
          vendor: 'copilot',
          family: 'gpt-test',
          version: '1',
          name: 'Test Model',
          maxInputTokens: 8000,
          sendRequest: async () => ({
            text: (async function* () {})(),
            stream: (async function* () {})()
          }),
          countTokens: async () => 1
        } as unknown as vscode.LanguageModelChat)
      ];
    });

    const availability = await service.checkAvailability();

    assert.deepEqual(availability, {
      available: true,
      modelId: 'copilot-test-model'
    } satisfies ExecutionAvailability);
  });

  test('maps a successful model response to replacement text', async () => {
    const { payload, capturePrompt, getCapturedPrompt } = createPayload();
    const service = new VscodeLanguageModelExecutionService(createContext(true), async () => {
      return [
        ({
          id: 'copilot-test-model',
          vendor: 'copilot',
          family: 'gpt-test',
          version: '1',
          name: 'Test Model',
          maxInputTokens: 8000,
          sendRequest: async (messages: vscode.LanguageModelChatMessage[]) => {
            const promptText = messages[0]?.content
              .filter((part): part is vscode.LanguageModelTextPart => part instanceof vscode.LanguageModelTextPart)
              .map((part) => part.value)
              .join('') ?? '';

            capturePrompt(promptText);

            return ({
            text: (async function* () {
              yield payload.markedDocumentMarkdown.replace('Original paragraph for execution.', 'Rewritten paragraph.');
            })(),
            stream: (async function* () {})()
            });
          },
          countTokens: async () => 1
        } as unknown as vscode.LanguageModelChat)
      ];
    });

    const result = await service.execute(payload);

    assert.match(result.draftDocumentMarkdown, /Rewritten paragraph\./);
    assert.equal(result.modelId, 'copilot-test-model');
    assert.match(getCapturedPrompt(), /Marked full document Markdown:/);
    assert.match(getCapturedPrompt(), /<<<INLINR_SELECTION_START:/);
    assert.match(getCapturedPrompt(), /Original paragraph for execution\./);
  });
});