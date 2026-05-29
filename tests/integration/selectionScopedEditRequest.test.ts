import assert from 'node:assert/strict';
import * as vscode from 'vscode';
import { MarkdownCustomEditorProvider } from '../../src/editors/markdownCustomEditorProvider';
import { renderMarkdownWithMetadata } from '../../src/rendering/markdownRenderer';
import type { SelectionScopedRequestPayload } from '../../src/requests/requestPayloadBuilder';
import { InMemoryRequestService } from '../../src/requests/requestService';
import { DocumentSessionController } from '../../src/sessions/documentSessionController';
import {
  FakeExecutionService,
  closeAllEditors,
  createMockWebviewPanel,
  createOutOfRangeExecutionOutcome,
  createSuccessfulExecutionOutcome,
  createUnavailableExecutionOutcome,
  findPostedMessage,
  getExtensionUri,
  getWorkspaceFile,
  waitFor
} from './helpers';

function findSourceRange(markdownSource: string, selectedText: string): { sourceStart: number; sourceEnd: number } {
  const sourceStart = markdownSource.indexOf(selectedText);

  if (sourceStart !== -1) {
    return {
      sourceStart,
      sourceEnd: sourceStart + selectedText.length
    };
  }

  const normalizedSource = markdownSource.replace(/\r\n/g, '\n');
  const normalizedSelectedText = selectedText.replace(/\r\n/g, '\n');
  const normalizedStart = normalizedSource.indexOf(normalizedSelectedText);

  if (normalizedStart === -1) {
    throw new Error(`Could not map selected text to the Markdown source: ${selectedText}`);
  }

  const toOriginalIndex = (normalizedIndex: number): number => {
    let originalIndex = 0;
    let currentNormalizedIndex = 0;

    while (originalIndex < markdownSource.length && currentNormalizedIndex < normalizedIndex) {
      if (markdownSource[originalIndex] === '\r' && markdownSource[originalIndex + 1] === '\n') {
        originalIndex += 2;
        currentNormalizedIndex += 1;
        continue;
      }

      originalIndex += 1;
      currentNormalizedIndex += 1;
    }

    return originalIndex;
  };

  return {
    sourceStart: toOriginalIndex(normalizedStart),
    sourceEnd: toOriginalIndex(normalizedStart + normalizedSelectedText.length)
  };
}

function buildSelectionCaptureFromText(markdownSource: string, selectedText: string): {
  startMarker: string;
  endMarker: string;
  renderedRegionIds: string[];
} {
  const sourceRange = findSourceRange(markdownSource, selectedText);
  const selectionMetadata = renderMarkdownWithMetadata(markdownSource).selectionMetadata;
  const selectedRegions = selectionMetadata.regions.filter((region) => {
    return region.sourceStart < sourceRange.sourceEnd && region.sourceEnd > sourceRange.sourceStart;
  });

  if (selectedRegions.length === 0) {
    throw new Error(`No rendered selection regions intersect the selected text: ${selectedText}`);
  }

  const firstRegion = selectedRegions[0];
  const lastRegion = selectedRegions[selectedRegions.length - 1];
  const startMarker = selectionMetadata.markers.find((marker) => {
    return marker.regionId === firstRegion.regionId && marker.sourceOffset === firstRegion.sourceStart;
  })?.markerId;
  const endMarker = selectionMetadata.markers.find((marker) => {
    return marker.regionId === lastRegion.regionId && marker.sourceOffset === lastRegion.sourceEnd;
  })?.markerId;

  if (!startMarker || !endMarker) {
    throw new Error(`Could not resolve rendered markers for selected text: ${selectedText}`);
  }

  return {
    startMarker,
    endMarker,
    renderedRegionIds: selectedRegions.map((region) => region.regionId)
  };
}

suite('Selection-scoped edit request integration', () => {
  teardown(async () => {
    await closeAllEditors();
  });

  test('opens one anchored request popup from a valid rendered selection without submitting immediately', async () => {
    const requestService = new InMemoryRequestService<SelectionScopedRequestPayload>();
    const provider = new MarkdownCustomEditorProvider(
      getExtensionUri(),
      new DocumentSessionController(),
      requestService
    );
    const document = await vscode.workspace.openTextDocument(getWorkspaceFile('selection-request-basic.md'));
    const { panel, postedMessages, webview, sendMessageToExtension } = createMockWebviewPanel();
    const selectionCapture = buildSelectionCaptureFromText(document.getText(), 'selectable for the first request flow');

    await provider.resolveCustomTextEditor(document, panel, new vscode.CancellationTokenSource().token);

    assert.match(webview.html, new RegExp(`data-selection-region-id="${selectionCapture.renderedRegionIds[0]}"`));

    sendMessageToExtension({
      type: 'selection.capture',
      documentVersion: document.version,
      selectedText: 'selectable for the first request flow',
      ...selectionCapture,
      selectionRect: {
        top: 164,
        left: 276,
        bottom: 184,
        right: 332
      }
    });

    await waitFor(
      () => postedMessages.find((message) => {
        return typeof message === 'object' && message !== null && 'type' in message && message.type === 'selection.accepted';
      }),
      (message) => Boolean(message)
    );

    const acceptedMessage = postedMessages.find((message) => {
      return typeof message === 'object' && message !== null && 'type' in message && message.type === 'selection.accepted';
    }) as { selectedTextPreview: string; selectedRegionIds: string[] } | undefined;

    assert.ok(acceptedMessage);
    assert.equal(acceptedMessage.selectedTextPreview, 'selectable for the first request flow');
  assert.deepEqual(acceptedMessage.selectedRegionIds, selectionCapture.renderedRegionIds);
    assert.equal(requestService.getLastSubmittedPayload(), null);

    provider.dispose();
  });

  test('returns a local bold suggestion from quick format without execution availability', async () => {
    const requestService = new InMemoryRequestService<SelectionScopedRequestPayload>();
    const provider = new MarkdownCustomEditorProvider(
      getExtensionUri(),
      new DocumentSessionController(),
      requestService
    );
    const document = await vscode.workspace.openTextDocument(getWorkspaceFile('selection-request-basic.md'));
    const { panel, postedMessages, sendMessageToExtension } = createMockWebviewPanel();
    const selectedText = 'selectable for the first request flow';
    const selectionCapture = buildSelectionCaptureFromText(document.getText(), selectedText);

    await provider.resolveCustomTextEditor(document, panel, new vscode.CancellationTokenSource().token);

    sendMessageToExtension({
      type: 'selection.capture',
      documentVersion: document.version,
      selectedText,
      ...selectionCapture,
      selectionRect: {
        top: 164,
        left: 276,
        bottom: 184,
        right: 332
      }
    });

    await waitFor(
      () => findPostedMessage<{ type: 'selection.accepted'; sessionId: string }>(postedMessages, 'selection.accepted'),
      (message) => Boolean(message)
    );

    sendMessageToExtension({
      type: 'request.quickFormat',
      sessionId: 'request-session-0',
      formatKind: 'bold'
    });

    const executingMessage = await waitFor(
      () => findPostedMessage<{ type: 'request.executing'; message: string }>(postedMessages, 'request.executing'),
      (message) => Boolean(message)
    );

    assert.equal(executingMessage.message, 'Generating suggestion…');

    const readyMessage = await waitFor(
      () => findPostedMessage<{ type: 'suggestion.ready'; proposal: { replacementMarkdown: string } }>(postedMessages, 'suggestion.ready'),
      (message) => Boolean(message)
    );

    assert.equal(readyMessage.proposal.replacementMarkdown, `**${selectedText}**`);
    assert.equal(findPostedMessage(postedMessages, 'request.unavailable'), undefined);
    assert.equal(
      requestService.getLastSubmittedPayload()?.requestText,
      'Format the selected text in Markdown bold using **double asterisks** without changing wording.'
    );

    provider.dispose();
  });

  test('returns a local italic suggestion from quick format without execution availability', async () => {
    const requestService = new InMemoryRequestService<SelectionScopedRequestPayload>();
    const provider = new MarkdownCustomEditorProvider(
      getExtensionUri(),
      new DocumentSessionController(),
      requestService
    );
    const document = await vscode.workspace.openTextDocument(getWorkspaceFile('selection-request-basic.md'));
    const { panel, postedMessages, sendMessageToExtension } = createMockWebviewPanel();
    const selectedText = 'selectable for the first request flow';
    const selectionCapture = buildSelectionCaptureFromText(document.getText(), selectedText);

    await provider.resolveCustomTextEditor(document, panel, new vscode.CancellationTokenSource().token);

    sendMessageToExtension({
      type: 'selection.capture',
      documentVersion: document.version,
      selectedText,
      ...selectionCapture,
      selectionRect: {
        top: 164,
        left: 276,
        bottom: 184,
        right: 332
      }
    });

    await waitFor(
      () => findPostedMessage<{ type: 'selection.accepted'; sessionId: string }>(postedMessages, 'selection.accepted'),
      (message) => Boolean(message)
    );

    sendMessageToExtension({
      type: 'request.quickFormat',
      sessionId: 'request-session-0',
      formatKind: 'italic'
    });

    const executingMessage = await waitFor(
      () => findPostedMessage<{ type: 'request.executing'; message: string }>(postedMessages, 'request.executing'),
      (message) => Boolean(message)
    );

    assert.equal(executingMessage.message, 'Generating suggestion…');

    const readyMessage = await waitFor(
      () => findPostedMessage<{ type: 'suggestion.ready'; proposal: { replacementMarkdown: string } }>(postedMessages, 'suggestion.ready'),
      (message) => Boolean(message)
    );

    assert.equal(readyMessage.proposal.replacementMarkdown, `*${selectedText}*`);
    assert.equal(findPostedMessage(postedMessages, 'request.unavailable'), undefined);
    assert.equal(
      requestService.getLastSubmittedPayload()?.requestText,
      'Format the selected text in Markdown italic using *single asterisks* without changing wording.'
    );

    provider.dispose();
  });

  test('keeps an already bold selection unchanged in local quick format', async () => {
    const requestService = new InMemoryRequestService<SelectionScopedRequestPayload>();
    const provider = new MarkdownCustomEditorProvider(
      getExtensionUri(),
      new DocumentSessionController(),
      requestService
    );
    const document = await vscode.workspace.openTextDocument({
      language: 'markdown',
      content: ['# Quick Format', '', '**Already formatted**'].join('\n')
    });
    const { panel, postedMessages, sendMessageToExtension } = createMockWebviewPanel();
    const selectedText = '**Already formatted**';
    const selectionCapture = buildSelectionCaptureFromText(document.getText(), selectedText);

    await provider.resolveCustomTextEditor(document, panel, new vscode.CancellationTokenSource().token);

    sendMessageToExtension({
      type: 'selection.capture',
      documentVersion: document.version,
      selectedText,
      ...selectionCapture,
      selectionRect: {
        top: 164,
        left: 276,
        bottom: 184,
        right: 332
      }
    });

    await waitFor(
      () => findPostedMessage<{ type: 'selection.accepted'; sessionId: string }>(postedMessages, 'selection.accepted'),
      (message) => Boolean(message)
    );

    sendMessageToExtension({
      type: 'request.quickFormat',
      sessionId: 'request-session-0',
      formatKind: 'bold'
    });

    const readyMessage = await waitFor(
      () => findPostedMessage<{ type: 'suggestion.ready'; proposal: { replacementMarkdown: string } }>(postedMessages, 'suggestion.ready'),
      (message) => Boolean(message)
    );

    assert.equal(readyMessage.proposal.replacementMarkdown, '**Already formatted**');
    assert.equal(findPostedMessage(postedMessages, 'request.unavailable'), undefined);

    provider.dispose();
  });

  test('converts an already italic selection to bold without nesting delimiters', async () => {
    const requestService = new InMemoryRequestService<SelectionScopedRequestPayload>();
    const provider = new MarkdownCustomEditorProvider(
      getExtensionUri(),
      new DocumentSessionController(),
      requestService
    );
    const document = await vscode.workspace.openTextDocument({
      language: 'markdown',
      content: ['# Quick Format', '', '*Already formatted*'].join('\n')
    });
    const { panel, postedMessages, sendMessageToExtension } = createMockWebviewPanel();
    const selectedText = '*Already formatted*';
    const selectionCapture = buildSelectionCaptureFromText(document.getText(), selectedText);

    await provider.resolveCustomTextEditor(document, panel, new vscode.CancellationTokenSource().token);

    sendMessageToExtension({
      type: 'selection.capture',
      documentVersion: document.version,
      selectedText,
      ...selectionCapture,
      selectionRect: {
        top: 164,
        left: 276,
        bottom: 184,
        right: 332
      }
    });

    await waitFor(
      () => findPostedMessage<{ type: 'selection.accepted'; sessionId: string }>(postedMessages, 'selection.accepted'),
      (message) => Boolean(message)
    );

    sendMessageToExtension({
      type: 'request.quickFormat',
      sessionId: 'request-session-0',
      formatKind: 'bold'
    });

    const readyMessage = await waitFor(
      () => findPostedMessage<{ type: 'suggestion.ready'; proposal: { replacementMarkdown: string } }>(postedMessages, 'suggestion.ready'),
      (message) => Boolean(message)
    );

    assert.equal(readyMessage.proposal.replacementMarkdown, '**Already formatted**');
    assert.equal(findPostedMessage(postedMessages, 'request.unavailable'), undefined);

    provider.dispose();
  });

  test('falls back to model execution for ambiguous quick-format markdown selections', async () => {
    const requestService = new InMemoryRequestService<SelectionScopedRequestPayload>();
    const provider = new MarkdownCustomEditorProvider(
      getExtensionUri(),
      new DocumentSessionController(),
      requestService,
      new FakeExecutionService(createSuccessfulExecutionOutcome('Resolved by model.'))
    );
    const document = await vscode.workspace.openTextDocument({
      language: 'markdown',
      content: ['# Quick Format', '', 'text * note'].join('\n')
    });
    const { panel, postedMessages, sendMessageToExtension } = createMockWebviewPanel();
    const selectedText = 'text * note';
    const selectionCapture = buildSelectionCaptureFromText(document.getText(), selectedText);

    await provider.resolveCustomTextEditor(document, panel, new vscode.CancellationTokenSource().token);

    sendMessageToExtension({
      type: 'selection.capture',
      documentVersion: document.version,
      selectedText,
      ...selectionCapture,
      selectionRect: {
        top: 164,
        left: 276,
        bottom: 184,
        right: 332
      }
    });

    await waitFor(
      () => findPostedMessage<{ type: 'selection.accepted'; sessionId: string }>(postedMessages, 'selection.accepted'),
      (message) => Boolean(message)
    );

    sendMessageToExtension({
      type: 'request.quickFormat',
      sessionId: 'request-session-0',
      formatKind: 'bold'
    });

    const readyMessage = await waitFor(
      () => findPostedMessage<{ type: 'suggestion.ready'; proposal: { replacementMarkdown: string } }>(postedMessages, 'suggestion.ready'),
      (message) => Boolean(message)
    );

    assert.equal(readyMessage.proposal.replacementMarkdown, 'Resolved by model.');
    assert.equal(findPostedMessage(postedMessages, 'request.unavailable'), undefined);

    provider.dispose();
  });

  test('submits a local request payload only after explicit submit', async () => {
    const requestService = new InMemoryRequestService<SelectionScopedRequestPayload>();
    const sessionController = new DocumentSessionController();
    const provider = new MarkdownCustomEditorProvider(
      getExtensionUri(),
      sessionController,
      requestService,
      new FakeExecutionService(createSuccessfulExecutionOutcome('This paragraph now reads more clearly.'))
    );
    const document = await vscode.workspace.openTextDocument(getWorkspaceFile('selection-request-basic.md'));
    const { panel, postedMessages, sendMessageToExtension } = createMockWebviewPanel();
    const selectionCapture = buildSelectionCaptureFromText(document.getText(), 'selectable for the first request flow');

    await provider.resolveCustomTextEditor(document, panel, new vscode.CancellationTokenSource().token);

    sendMessageToExtension({
      type: 'selection.capture',
      documentVersion: document.version,
      selectedText: 'selectable for the first request flow',
      ...selectionCapture,
      selectionRect: {
        top: 164,
        left: 276,
        bottom: 184,
        right: 332
      }
    });
    sendMessageToExtension({
      type: 'request.draftChanged',
      sessionId: 'request-session-0',
      draftText: 'Tighten the wording.'
    });
    sendMessageToExtension({
      type: 'request.submit',
      sessionId: 'request-session-0',
      draftText: 'Tighten the wording.'
    });

    await waitFor(
      () => requestService.getLastSubmittedPayload(),
      (payload): payload is SelectionScopedRequestPayload => payload !== null
    );

    const payload = requestService.getLastSubmittedPayload();

    assert.ok(payload);
    assert.equal(payload.requestText, 'Tighten the wording.');
    assert.equal(payload.selectedMarkdown, 'selectable for the first request flow');
    assert.equal(payload.documentUri, document.uri.toString());

    await waitFor(
      () => sessionController.getActiveRequestSession(document),
      (activeRequest) => activeRequest !== null && activeRequest.validationState === 'review'
    );

    await waitFor(
      () => findPostedMessage<{ type: 'request.executing'; message: string }>(postedMessages, 'request.executing'),
      (message) => Boolean(message)
    );

    const executingMessage = findPostedMessage<{ type: 'request.executing'; message: string }>(
      postedMessages,
      'request.executing'
    );

    assert.ok(executingMessage);
    assert.equal(executingMessage.message, 'Generating suggestion…');

    const readyMessage = await waitFor(
      () => findPostedMessage<{ type: 'suggestion.ready'; proposal: { replacementMarkdown: string } }>(postedMessages, 'suggestion.ready'),
      (message) => Boolean(message)
    );

    assert.equal(readyMessage.proposal.replacementMarkdown, 'This paragraph now reads more clearly.');

    provider.dispose();
  });

  test('preserves one contiguous targeted range across adjacent prose blocks', async () => {
    const requestService = new InMemoryRequestService<SelectionScopedRequestPayload>();
    const provider = new MarkdownCustomEditorProvider(
      getExtensionUri(),
      new DocumentSessionController(),
      requestService,
      new FakeExecutionService(
        createSuccessfulExecutionOutcome('This passage now reads as one smoother multi-block suggestion.\n\nThis adjacent paragraph stays prose.')
      )
    );
    const document = await vscode.workspace.openTextDocument(getWorkspaceFile('selection-request-basic.md'));
    const { panel, postedMessages, webview, sendMessageToExtension } = createMockWebviewPanel();
    const selectedText = 'selectable for the first request flow.\n\nThis adjacent paragraph gives the next phase';
    const selectionCapture = buildSelectionCaptureFromText(document.getText(), selectedText);

    await provider.resolveCustomTextEditor(document, panel, new vscode.CancellationTokenSource().token);

    sendMessageToExtension({
      type: 'selection.capture',
      documentVersion: document.version,
      selectedText,
      ...selectionCapture,
      selectionRect: {
        top: 192,
        left: 244,
        bottom: 252,
        right: 488
      }
    });

    await waitFor(
      () => postedMessages.find((message) => {
        return typeof message === 'object' && message !== null && 'type' in message && message.type === 'selection.accepted';
      }),
      (message) => Boolean(message)
    );

    assert.match(webview.html, new RegExp(`data-selection-region-id="${selectionCapture.renderedRegionIds.at(-1)}"`));

    const acceptedMessage = postedMessages.find((message) => {
      return typeof message === 'object' && message !== null && 'type' in message && message.type === 'selection.accepted';
    }) as { selectedRegionIds: string[] } | undefined;

    assert.ok(acceptedMessage);
    assert.deepEqual(acceptedMessage.selectedRegionIds, selectionCapture.renderedRegionIds);

    sendMessageToExtension({
      type: 'request.draftChanged',
      sessionId: 'request-session-0',
      draftText: 'Condense both paragraphs.'
    });
    sendMessageToExtension({
      type: 'request.submit',
      sessionId: 'request-session-0',
      draftText: 'Condense both paragraphs.'
    });

    await waitFor(
      () => requestService.getLastSubmittedPayload(),
      (payload): payload is SelectionScopedRequestPayload => payload !== null && payload.requestText === 'Condense both paragraphs.'
    );

    const payload = requestService.getLastSubmittedPayload();

    assert.ok(payload);
    assert.equal(
      payload.selectedMarkdown.replace(/\r\n/g, '\n'),
      selectedText.replace(/\r\n/g, '\n')
    );

    provider.dispose();
  });

  test('opens a request for contiguous bullet items even when the visible selection omits list markers', async () => {
    const requestService = new InMemoryRequestService<SelectionScopedRequestPayload>();
    const provider = new MarkdownCustomEditorProvider(
      getExtensionUri(),
      new DocumentSessionController(),
      requestService,
      new FakeExecutionService(createSuccessfulExecutionOutcome('- Combined item'))
    );
    const document = await vscode.workspace.openTextDocument({
      language: 'markdown',
      content: ['# Lists', '', '- Alpha item', '- Beta item', '', 'Trailing paragraph.'].join('\n')
    });
    const { panel, postedMessages, sendMessageToExtension } = createMockWebviewPanel();

    await provider.resolveCustomTextEditor(document, panel, new vscode.CancellationTokenSource().token);

    sendMessageToExtension({
      type: 'selection.capture',
      documentVersion: document.version,
      selectedText: 'Alpha item\nBeta item',
      startMarker: 'marker-2',
      endMarker: 'marker-9',
      renderedRegionIds: ['region-1', 'region-2', 'region-3', 'region-4'],
      selectionRect: {
        top: 180,
        left: 220,
        bottom: 236,
        right: 420
      }
    });

    await waitFor(
      () => findPostedMessage<{ type: 'selection.accepted'; selectedTextPreview: string }>(postedMessages, 'selection.accepted'),
      (message) => Boolean(message)
    );

    sendMessageToExtension({
      type: 'request.draftChanged',
      sessionId: 'request-session-0',
      draftText: 'Combine these items.'
    });
    sendMessageToExtension({
      type: 'request.submit',
      sessionId: 'request-session-0',
      draftText: 'Combine these items.'
    });

    await waitFor(
      () => requestService.getLastSubmittedPayload(),
      (payload): payload is SelectionScopedRequestPayload => payload !== null
    );

    const payload = requestService.getLastSubmittedPayload();

    assert.ok(payload);
    assert.equal(payload.selectedMarkdown.replace(/\r\n/g, '\n'), '- Alpha item\n- Beta item\n');

    provider.dispose();
  });

  test('opens a request for chapter-scale selections that start at a heading', async () => {
    const requestService = new InMemoryRequestService<SelectionScopedRequestPayload>();
    const provider = new MarkdownCustomEditorProvider(
      getExtensionUri(),
      new DocumentSessionController(),
      requestService,
      new FakeExecutionService(createSuccessfulExecutionOutcome('# Revised Chapter\n\nFeedback.'))
    );
    const document = await vscode.workspace.openTextDocument({
      language: 'markdown',
      content: [
        '# First Chapter',
        '',
        'First chapter paragraph.',
        '',
        '# Second Chapter',
        '',
        'Second chapter paragraph.'
      ].join('\n')
    });
    const { panel, postedMessages, sendMessageToExtension } = createMockWebviewPanel();

    await provider.resolveCustomTextEditor(document, panel, new vscode.CancellationTokenSource().token);

    sendMessageToExtension({
      type: 'selection.capture',
      documentVersion: document.version,
      selectedText: 'First Chapter\nFirst chapter paragraph.\nSecond Chapter\nSecond chapter paragraph.',
      startMarker: 'marker-0',
      endMarker: 'marker-7',
      renderedRegionIds: ['region-0', 'region-1', 'region-2', 'region-3'],
      selectionRect: {
        top: 120,
        left: 220,
        bottom: 320,
        right: 520
      }
    });

    await waitFor(
      () => findPostedMessage<{ type: 'selection.accepted'; selectedTextPreview: string }>(postedMessages, 'selection.accepted'),
      (message) => Boolean(message)
    );

    sendMessageToExtension({
      type: 'request.draftChanged',
      sessionId: 'request-session-0',
      draftText: 'Give feedback on both chapters.'
    });
    sendMessageToExtension({
      type: 'request.submit',
      sessionId: 'request-session-0',
      draftText: 'Give feedback on both chapters.'
    });

    await waitFor(
      () => requestService.getLastSubmittedPayload(),
      (payload): payload is SelectionScopedRequestPayload => payload !== null
    );

    const payload = requestService.getLastSubmittedPayload();

    assert.ok(payload);
    assert.equal(
      payload.selectedMarkdown.replace(/\r\n/g, '\n'),
      ['# First Chapter', '', 'First chapter paragraph.', '', '# Second Chapter', '', 'Second chapter paragraph.'].join('\n')
    );

    provider.dispose();
  });

  test('removes the full containing list item when only the visible list text is selected', async () => {
    const requestService = new InMemoryRequestService<SelectionScopedRequestPayload>();
    const sessionController = new DocumentSessionController();
    const provider = new MarkdownCustomEditorProvider(
      getExtensionUri(),
      sessionController,
      requestService,
      new FakeExecutionService(createSuccessfulExecutionOutcome(''))
    );
    const document = await vscode.workspace.openTextDocument({
      language: 'markdown',
      content: ['# List Removal', '', '- Alpha item', '- Beta item', '', 'Trailing paragraph.'].join('\n')
    });
    const { panel, postedMessages, sendMessageToExtension } = createMockWebviewPanel();
    const selectionCapture = buildSelectionCaptureFromText(document.getText(), 'Beta item');

    await provider.resolveCustomTextEditor(document, panel, new vscode.CancellationTokenSource().token);

    sendMessageToExtension({
      type: 'selection.capture',
      documentVersion: document.version,
      selectedText: 'Beta item',
      ...selectionCapture,
      selectionRect: {
        top: 180,
        left: 220,
        bottom: 208,
        right: 420
      }
    });

    await waitFor(
      () => findPostedMessage<{ type: 'selection.accepted' }>(postedMessages, 'selection.accepted'),
      (message) => Boolean(message)
    );

    sendMessageToExtension({
      type: 'request.draftChanged',
      sessionId: 'request-session-0',
      draftText: 'Remove this item.'
    });
    sendMessageToExtension({
      type: 'request.submit',
      sessionId: 'request-session-0',
      draftText: 'Remove this item.'
    });

    await waitFor(
      () => requestService.getLastSubmittedPayload(),
      (payload): payload is SelectionScopedRequestPayload => payload !== null
    );

    const payload = requestService.getLastSubmittedPayload();

    assert.ok(payload);
    assert.equal(payload.selectedMarkdown.replace(/\r\n/g, '\n'), '- Beta item\n');

    const readyMessage = await waitFor(
      () => findPostedMessage<{ type: 'suggestion.ready'; proposal: { proposalId: string; replacementMarkdown: string } }>(postedMessages, 'suggestion.ready'),
      (message) => Boolean(message)
    );

    assert.equal(readyMessage.proposal.replacementMarkdown, '');

    sendMessageToExtension({
      type: 'suggestion.apply',
      sessionId: 'request-session-0',
      proposalId: readyMessage.proposal.proposalId
    });

    await waitFor(
      () => document.getText(),
      (text) => text === ['# List Removal', '', '- Alpha item', '', 'Trailing paragraph.'].join('\n')
    );

    assert.equal(document.getText(), ['# List Removal', '', '- Alpha item', '', 'Trailing paragraph.'].join('\n'));
    assert.equal(sessionController.getActiveRequestSession(document), null);

    provider.dispose();
  });

  test('keeps the active request attached after a small document shift that still resolves confidently', async () => {
    const requestService = new InMemoryRequestService<SelectionScopedRequestPayload>();
    const sessionController = new DocumentSessionController();
    const provider = new MarkdownCustomEditorProvider(
      getExtensionUri(),
      sessionController,
      requestService,
      new FakeExecutionService(createSuccessfulExecutionOutcome('This paragraph now reads more clearly after the intro.'))
    );
    const document = await vscode.workspace.openTextDocument(getWorkspaceFile('selection-request-basic.md'));
    const { panel, postedMessages, webview, sendMessageToExtension } = createMockWebviewPanel();
    const selectionCapture = buildSelectionCaptureFromText(document.getText(), 'selectable for the first request flow');

    await provider.resolveCustomTextEditor(document, panel, new vscode.CancellationTokenSource().token);

    sendMessageToExtension({
      type: 'selection.capture',
      documentVersion: document.version,
      selectedText: 'selectable for the first request flow',
      ...selectionCapture,
      selectionRect: {
        top: 164,
        left: 276,
        bottom: 184,
        right: 332
      }
    });
    sendMessageToExtension({
      type: 'request.draftChanged',
      sessionId: 'request-session-0',
      draftText: 'Tighten the wording after the intro is added.'
    });

    const edit = new vscode.WorkspaceEdit();
    edit.insert(document.uri, new vscode.Position(0, 0), 'Intro paragraph.\n\n');
    await vscode.workspace.applyEdit(edit);

    await waitFor(
      () => sessionController.getActiveRequestSession(document),
      (activeRequest) => activeRequest !== null && activeRequest.draftText === 'Tighten the wording after the intro is added.'
    );

    assert.doesNotMatch(webview.html, /Render failed/);

    sendMessageToExtension({
      type: 'request.submit',
      sessionId: 'request-session-0',
      draftText: 'Tighten the wording after the intro is added.'
    });

    await waitFor(
      () => requestService.getLastSubmittedPayload(),
      (payload): payload is SelectionScopedRequestPayload => payload !== null
    );

    const payload = requestService.getLastSubmittedPayload();

    assert.ok(payload);
    assert.equal(payload.selectedMarkdown, 'selectable for the first request flow');

    const readyMessage = await waitFor(
      () => findPostedMessage<{ type: 'suggestion.ready'; proposal: { replacementMarkdown: string } }>(postedMessages, 'suggestion.ready'),
      (message) => Boolean(message)
    );

    assert.equal(readyMessage.proposal.replacementMarkdown, 'This paragraph now reads more clearly after the intro.');

    provider.dispose();
  });

  test('shows pending feedback and one suggestion-ready proposal after submit', async () => {
    const requestService = new InMemoryRequestService<SelectionScopedRequestPayload>();
    const sessionController = new DocumentSessionController();
    const provider = new MarkdownCustomEditorProvider(
      getExtensionUri(),
      sessionController,
      requestService,
      new FakeExecutionService(createSuccessfulExecutionOutcome('A tighter rewritten paragraph.'))
    );
    const document = await vscode.workspace.openTextDocument(getWorkspaceFile('selection-request-execution.md'));
    const { panel, postedMessages, sendMessageToExtension } = createMockWebviewPanel();

    await provider.resolveCustomTextEditor(document, panel, new vscode.CancellationTokenSource().token);

    sendMessageToExtension({
      type: 'selection.capture',
      documentVersion: document.version,
      selectedText: 'This targeted paragraph should be rewritten by the execution flow without changing the surrounding block structure.',
      startMarker: 'marker-0',
      endMarker: 'marker-1',
      renderedRegionIds: ['region-0'],
      selectionRect: {
        top: 164,
        left: 276,
        bottom: 184,
        right: 332
      }
    });

    sendMessageToExtension({
      type: 'request.draftChanged',
      sessionId: 'request-session-0',
      draftText: 'Make this paragraph clearer.'
    });
    sendMessageToExtension({
      type: 'request.submit',
      sessionId: 'request-session-0',
      draftText: 'Make this paragraph clearer.'
    });

    const executingMessage = await waitFor(
      () => findPostedMessage<{ type: 'request.executing'; message: string }>(postedMessages, 'request.executing'),
      (message) => Boolean(message)
    );

    assert.equal(executingMessage.message, 'Generating suggestion…');

    const readyMessage = await waitFor(
      () => findPostedMessage<{ type: 'suggestion.ready'; proposal: { replacementMarkdown: string } }>(postedMessages, 'suggestion.ready'),
      (message) => Boolean(message)
    );

    assert.equal(readyMessage.proposal.replacementMarkdown, 'A tighter rewritten paragraph.');
    assert.equal(sessionController.getActiveRequestSession(document)?.validationState, 'review');

    provider.dispose();
  });

  test('rejects a suggestion without mutating the document', async () => {
    const requestService = new InMemoryRequestService<SelectionScopedRequestPayload>();
    const sessionController = new DocumentSessionController();
    const provider = new MarkdownCustomEditorProvider(
      getExtensionUri(),
      sessionController,
      requestService,
      new FakeExecutionService(createSuccessfulExecutionOutcome('A clearer rewritten paragraph.'))
    );
    const originalContent = [
      '# Reject Flow',
      '',
      'Original paragraph.',
      '',
      'Trailing paragraph.'
    ].join('\n');
    const document = await vscode.workspace.openTextDocument({ language: 'markdown', content: originalContent });
    const { panel, postedMessages, sendMessageToExtension } = createMockWebviewPanel();

    await provider.resolveCustomTextEditor(document, panel, new vscode.CancellationTokenSource().token);

    sendMessageToExtension({
      type: 'selection.capture',
      documentVersion: document.version,
      selectedText: 'Original paragraph.',
      startMarker: 'marker-0',
      endMarker: 'marker-1',
      renderedRegionIds: ['region-0'],
      selectionRect: {
        top: 120,
        left: 220,
        bottom: 148,
        right: 420
      }
    });
    sendMessageToExtension({
      type: 'request.draftChanged',
      sessionId: 'request-session-0',
      draftText: 'Rewrite this paragraph.'
    });
    sendMessageToExtension({
      type: 'request.submit',
      sessionId: 'request-session-0',
      draftText: 'Rewrite this paragraph.'
    });

    const readyMessage = await waitFor(
      () => findPostedMessage<{ type: 'suggestion.ready'; proposal: { proposalId: string } }>(postedMessages, 'suggestion.ready'),
      (message) => Boolean(message)
    );

    sendMessageToExtension({
      type: 'suggestion.reject',
      sessionId: 'request-session-0',
      proposalId: readyMessage.proposal.proposalId
    });

    const rejectedMessage = await waitFor(
      () => findPostedMessage<{ type: 'suggestion.rejected'; message?: string }>(postedMessages, 'suggestion.rejected'),
      (message) => Boolean(message)
    );

    assert.equal(rejectedMessage.message, 'Suggestion dismissed.');
    assert.equal(document.getText(), originalContent);
    assert.equal(sessionController.getActiveRequestSession(document)?.validationState, 'drafting');

    provider.dispose();
  });

  test('allows a new scoped request after reject in the same editor session', async () => {
    const requestService = new InMemoryRequestService<SelectionScopedRequestPayload>();
    const sessionController = new DocumentSessionController();
    const provider = new MarkdownCustomEditorProvider(
      getExtensionUri(),
      sessionController,
      requestService,
      new FakeExecutionService([
        createSuccessfulExecutionOutcome('Rewritten paragraph.'),
        createSuccessfulExecutionOutcome('Updated trailing paragraph.')
      ])
    );
    const originalContent = ['# Reject Then Retry', '', 'Original paragraph.', '', 'Trailing paragraph.'].join('\n');
    const document = await vscode.workspace.openTextDocument({ language: 'markdown', content: originalContent });
    const { panel, postedMessages, sendMessageToExtension } = createMockWebviewPanel();

    await provider.resolveCustomTextEditor(document, panel, new vscode.CancellationTokenSource().token);

    sendMessageToExtension({
      type: 'selection.capture',
      documentVersion: document.version,
      selectedText: 'Original paragraph.',
      startMarker: 'marker-2',
      endMarker: 'marker-3',
      renderedRegionIds: ['region-1'],
      selectionRect: {
        top: 120,
        left: 220,
        bottom: 148,
        right: 420
      }
    });
    sendMessageToExtension({
      type: 'request.draftChanged',
      sessionId: 'request-session-0',
      draftText: 'Rewrite this paragraph.'
    });
    sendMessageToExtension({
      type: 'request.submit',
      sessionId: 'request-session-0',
      draftText: 'Rewrite this paragraph.'
    });

    const firstReadyMessage = await waitFor(
      () => findPostedMessage<{ type: 'suggestion.ready'; proposal: { proposalId: string } }>(postedMessages, 'suggestion.ready'),
      (message) => Boolean(message)
    );

    sendMessageToExtension({
      type: 'suggestion.reject',
      sessionId: 'request-session-0',
      proposalId: firstReadyMessage.proposal.proposalId
    });

    await waitFor(
      () => findPostedMessage<{ type: 'suggestion.rejected'; message?: string }>(postedMessages, 'suggestion.rejected'),
      (message) => Boolean(message)
    );

    sendMessageToExtension({
      type: 'selection.capture',
      documentVersion: document.version,
      selectedText: 'Trailing paragraph.',
      startMarker: 'marker-4',
      endMarker: 'marker-5',
      renderedRegionIds: ['region-2'],
      selectionRect: {
        top: 172,
        left: 220,
        bottom: 200,
        right: 420
      }
    });

    const secondAcceptedMessage = await waitFor(
      () => postedMessages.find((message) => {
        return typeof message === 'object' && message !== null && 'type' in message && message.type === 'selection.accepted' &&
          'selectedTextPreview' in message && message.selectedTextPreview === 'Trailing paragraph.';
      }),
      (message) => Boolean(message)
    ) as { sessionId: string; selectedTextPreview: string };

    assert.equal(secondAcceptedMessage.sessionId, 'request-session-1');
    assert.equal(secondAcceptedMessage.selectedTextPreview, 'Trailing paragraph.');

    sendMessageToExtension({
      type: 'request.draftChanged',
      sessionId: 'request-session-1',
      draftText: 'Rewrite the trailing paragraph.'
    });
    sendMessageToExtension({
      type: 'request.submit',
      sessionId: 'request-session-1',
      draftText: 'Rewrite the trailing paragraph.'
    });

    await waitFor(
      () => requestService.getLastSubmittedPayload(),
      (payload): payload is SelectionScopedRequestPayload => payload !== null && payload.requestText === 'Rewrite the trailing paragraph.'
    );

    const payload = requestService.getLastSubmittedPayload();

    assert.ok(payload);
    assert.equal(payload.selectedMarkdown, 'Trailing paragraph.');
    assert.equal(sessionController.getActiveRequestSession(document)?.sessionId, 'request-session-1');

    provider.dispose();
  });

  test('applies a reviewed suggestion only to the intended markdown range', async () => {
    const requestService = new InMemoryRequestService<SelectionScopedRequestPayload>();
    const sessionController = new DocumentSessionController();
    const provider = new MarkdownCustomEditorProvider(
      getExtensionUri(),
      sessionController,
      requestService,
      new FakeExecutionService(createSuccessfulExecutionOutcome('Rewritten paragraph.'))
    );
    const originalContent = [
      '# Apply Flow',
      '',
      'Original paragraph.',
      '',
      'Trailing paragraph.'
    ].join('\n');
    const document = await vscode.workspace.openTextDocument({ language: 'markdown', content: originalContent });
    const { panel, postedMessages, sendMessageToExtension } = createMockWebviewPanel();

    await provider.resolveCustomTextEditor(document, panel, new vscode.CancellationTokenSource().token);

    sendMessageToExtension({
      type: 'selection.capture',
      documentVersion: document.version,
      selectedText: 'Original paragraph.',
      startMarker: 'marker-2',
      endMarker: 'marker-3',
      renderedRegionIds: ['region-1'],
      selectionRect: {
        top: 120,
        left: 220,
        bottom: 148,
        right: 420
      }
    });
    sendMessageToExtension({
      type: 'request.draftChanged',
      sessionId: 'request-session-0',
      draftText: 'Rewrite this paragraph.'
    });
    sendMessageToExtension({
      type: 'request.submit',
      sessionId: 'request-session-0',
      draftText: 'Rewrite this paragraph.'
    });

    const readyMessage = await waitFor(
      () => findPostedMessage<{ type: 'suggestion.ready'; proposal: { proposalId: string } }>(postedMessages, 'suggestion.ready'),
      (message) => Boolean(message)
    );

    sendMessageToExtension({
      type: 'suggestion.apply',
      sessionId: 'request-session-0',
      proposalId: readyMessage.proposal.proposalId
    });

    await waitFor(
      () => document.getText(),
      (text) => text.includes('Rewritten paragraph.')
    );

    assert.equal(
      document.getText(),
      ['# Apply Flow', '', 'Rewritten paragraph.', '', 'Trailing paragraph.'].join('\n')
    );
    assert.equal(sessionController.getActiveRequestSession(document), null);

    provider.dispose();
  });

  test('allows a follow-up scoped request after apply against the updated document state', async () => {
    const requestService = new InMemoryRequestService<SelectionScopedRequestPayload>();
    const sessionController = new DocumentSessionController();
    const provider = new MarkdownCustomEditorProvider(
      getExtensionUri(),
      sessionController,
      requestService,
      new FakeExecutionService([
        createSuccessfulExecutionOutcome('Rewritten paragraph.'),
        createSuccessfulExecutionOutcome('Shorter trailing paragraph.')
      ])
    );
    const originalContent = ['# Apply Then Continue', '', 'Original paragraph.', '', 'Trailing paragraph.'].join('\n');
    const document = await vscode.workspace.openTextDocument({ language: 'markdown', content: originalContent });
    const { panel, postedMessages, sendMessageToExtension } = createMockWebviewPanel();

    await provider.resolveCustomTextEditor(document, panel, new vscode.CancellationTokenSource().token);

    sendMessageToExtension({
      type: 'selection.capture',
      documentVersion: document.version,
      selectedText: 'Original paragraph.',
      startMarker: 'marker-2',
      endMarker: 'marker-3',
      renderedRegionIds: ['region-1'],
      selectionRect: {
        top: 120,
        left: 220,
        bottom: 148,
        right: 420
      }
    });
    sendMessageToExtension({
      type: 'request.draftChanged',
      sessionId: 'request-session-0',
      draftText: 'Rewrite this paragraph.'
    });
    sendMessageToExtension({
      type: 'request.submit',
      sessionId: 'request-session-0',
      draftText: 'Rewrite this paragraph.'
    });

    const firstReadyMessage = await waitFor(
      () => findPostedMessage<{ type: 'suggestion.ready'; proposal: { proposalId: string } }>(postedMessages, 'suggestion.ready'),
      (message) => Boolean(message)
    );

    sendMessageToExtension({
      type: 'suggestion.apply',
      sessionId: 'request-session-0',
      proposalId: firstReadyMessage.proposal.proposalId
    });

    await waitFor(
      () => document.getText(),
      (text) => text === ['# Apply Then Continue', '', 'Rewritten paragraph.', '', 'Trailing paragraph.'].join('\n')
    );

    sendMessageToExtension({
      type: 'selection.capture',
      documentVersion: document.version,
      selectedText: 'Trailing paragraph.',
      startMarker: 'marker-4',
      endMarker: 'marker-5',
      renderedRegionIds: ['region-2'],
      selectionRect: {
        top: 172,
        left: 220,
        bottom: 200,
        right: 420
      }
    });

    const secondAcceptedMessage = await waitFor(
      () => postedMessages.find((message) => {
        return typeof message === 'object' && message !== null && 'type' in message && message.type === 'selection.accepted' &&
          'selectedTextPreview' in message && message.selectedTextPreview === 'Trailing paragraph.';
      }),
      (message) => Boolean(message)
    ) as { sessionId: string; selectedTextPreview: string };

    assert.equal(secondAcceptedMessage.sessionId, 'request-session-1');
    assert.equal(secondAcceptedMessage.selectedTextPreview, 'Trailing paragraph.');

    sendMessageToExtension({
      type: 'request.draftChanged',
      sessionId: 'request-session-1',
      draftText: 'Shorten the trailing paragraph.'
    });
    sendMessageToExtension({
      type: 'request.submit',
      sessionId: 'request-session-1',
      draftText: 'Shorten the trailing paragraph.'
    });

    await waitFor(
      () => requestService.getLastSubmittedPayload(),
      (payload): payload is SelectionScopedRequestPayload => payload !== null && payload.requestText === 'Shorten the trailing paragraph.'
    );

    const payload = requestService.getLastSubmittedPayload();

    assert.ok(payload);
    assert.equal(payload.documentMarkdown, ['# Apply Then Continue', '', 'Rewritten paragraph.', '', 'Trailing paragraph.'].join('\n'));
    assert.equal(payload.selectedMarkdown, 'Trailing paragraph.');

    provider.dispose();
  });

  test('shows an unavailable state without mutating the document when execution cannot run', async () => {
    const requestService = new InMemoryRequestService<SelectionScopedRequestPayload>();
    const sessionController = new DocumentSessionController();
    const provider = new MarkdownCustomEditorProvider(
      getExtensionUri(),
      sessionController,
      requestService,
      new FakeExecutionService(createUnavailableExecutionOutcome('Copilot execution is unavailable in this environment.'))
    );
    const originalContent = 'Original paragraph.';
    const document = await vscode.workspace.openTextDocument({ language: 'markdown', content: originalContent });
    const { panel, postedMessages, sendMessageToExtension } = createMockWebviewPanel();

    await provider.resolveCustomTextEditor(document, panel, new vscode.CancellationTokenSource().token);

    sendMessageToExtension({
      type: 'selection.capture',
      documentVersion: document.version,
      selectedText: 'Original paragraph.',
      startMarker: 'marker-0',
      endMarker: 'marker-1',
      renderedRegionIds: ['region-0'],
      selectionRect: {
        top: 120,
        left: 220,
        bottom: 148,
        right: 420
      }
    });
    sendMessageToExtension({
      type: 'request.draftChanged',
      sessionId: 'request-session-0',
      draftText: 'Rewrite this paragraph.'
    });
    sendMessageToExtension({
      type: 'request.submit',
      sessionId: 'request-session-0',
      draftText: 'Rewrite this paragraph.'
    });

    const unavailableMessage = await waitFor(
      () => findPostedMessage<{ type: 'request.unavailable'; message: string }>(postedMessages, 'request.unavailable'),
      (message) => Boolean(message)
    );

    assert.equal(unavailableMessage.message, 'Copilot execution is unavailable in this environment.');
    assert.equal(document.getText(), originalContent);
    assert.equal(sessionController.getActiveRequestSession(document)?.validationState, 'unavailable');

    provider.dispose();
  });

  test('ignores out-of-range draft changes and keeps only the selected-range proposal for review', async () => {
    const requestService = new InMemoryRequestService<SelectionScopedRequestPayload>();
    const sessionController = new DocumentSessionController();
    const provider = new MarkdownCustomEditorProvider(
      getExtensionUri(),
      sessionController,
      requestService,
      new FakeExecutionService(createOutOfRangeExecutionOutcome('Rewritten paragraph.'))
    );
    const originalContent = 'Original paragraph.';
    const document = await vscode.workspace.openTextDocument({ language: 'markdown', content: originalContent });
    const { panel, postedMessages, sendMessageToExtension } = createMockWebviewPanel();

    await provider.resolveCustomTextEditor(document, panel, new vscode.CancellationTokenSource().token);

    sendMessageToExtension({
      type: 'selection.capture',
      documentVersion: document.version,
      selectedText: 'Original paragraph.',
      startMarker: 'marker-0',
      endMarker: 'marker-1',
      renderedRegionIds: ['region-0'],
      selectionRect: {
        top: 120,
        left: 220,
        bottom: 148,
        right: 420
      }
    });
    sendMessageToExtension({
      type: 'request.draftChanged',
      sessionId: 'request-session-0',
      draftText: 'Rewrite this paragraph.'
    });
    sendMessageToExtension({
      type: 'request.submit',
      sessionId: 'request-session-0',
      draftText: 'Rewrite this paragraph.'
    });

    const readyMessage = await waitFor(
      () => findPostedMessage<{ type: 'suggestion.ready'; proposal: { replacementMarkdown: string } }>(postedMessages, 'suggestion.ready'),
      (message) => Boolean(message)
    );

    assert.equal(readyMessage.proposal.replacementMarkdown, 'Rewritten paragraph.');
    assert.equal(document.getText(), originalContent);
    assert.equal(sessionController.getActiveRequestSession(document)?.validationState, 'review');

    provider.dispose();
  });

  test('applies deletion proposals to only the selected markdown range', async () => {
    const requestService = new InMemoryRequestService<SelectionScopedRequestPayload>();
    const sessionController = new DocumentSessionController();
    const provider = new MarkdownCustomEditorProvider(
      getExtensionUri(),
      sessionController,
      requestService,
      new FakeExecutionService(createSuccessfulExecutionOutcome(''))
    );
    const originalContent = ['# Delete Flow', '', 'Original paragraph.', '', 'Trailing paragraph.'].join('\n');
    const document = await vscode.workspace.openTextDocument({ language: 'markdown', content: originalContent });
    const { panel, postedMessages, sendMessageToExtension } = createMockWebviewPanel();

    await provider.resolveCustomTextEditor(document, panel, new vscode.CancellationTokenSource().token);

    sendMessageToExtension({
      type: 'selection.capture',
      documentVersion: document.version,
      selectedText: 'Original paragraph.',
      startMarker: 'marker-2',
      endMarker: 'marker-3',
      renderedRegionIds: ['region-1'],
      selectionRect: {
        top: 120,
        left: 220,
        bottom: 148,
        right: 420
      }
    });
    sendMessageToExtension({
      type: 'request.draftChanged',
      sessionId: 'request-session-0',
      draftText: 'Remove this paragraph.'
    });
    sendMessageToExtension({
      type: 'request.submit',
      sessionId: 'request-session-0',
      draftText: 'Remove this paragraph.'
    });

    const readyMessage = await waitFor(
      () => findPostedMessage<{ type: 'suggestion.ready'; proposal: { proposalId: string; replacementMarkdown: string } }>(postedMessages, 'suggestion.ready'),
      (message) => Boolean(message)
    );

    assert.equal(readyMessage.proposal.replacementMarkdown, '');

    sendMessageToExtension({
      type: 'suggestion.apply',
      sessionId: 'request-session-0',
      proposalId: readyMessage.proposal.proposalId
    });

    await waitFor(
      () => document.getText(),
      (text) => text === ['# Delete Flow', '', '', '', 'Trailing paragraph.'].join('\n')
    );

    assert.equal(document.getText(), ['# Delete Flow', '', '', '', 'Trailing paragraph.'].join('\n'));
    assert.equal(sessionController.getActiveRequestSession(document), null);

    provider.dispose();
  });

  test('blocks apply and preserves recovery state when the target drifts before apply', async () => {
    const requestService = new InMemoryRequestService<SelectionScopedRequestPayload>();
    const sessionController = new DocumentSessionController();
    const provider = new MarkdownCustomEditorProvider(
      getExtensionUri(),
      sessionController,
      requestService,
      new FakeExecutionService(createSuccessfulExecutionOutcome('Rewritten paragraph.'))
    );
    const originalContent = [
      '# Drift Flow',
      '',
      'Original paragraph.',
      '',
      'Trailing paragraph.'
    ].join('\n');
    const document = await vscode.workspace.openTextDocument({ language: 'markdown', content: originalContent });
    const { panel, postedMessages, sendMessageToExtension } = createMockWebviewPanel();

    await provider.resolveCustomTextEditor(document, panel, new vscode.CancellationTokenSource().token);

    sendMessageToExtension({
      type: 'selection.capture',
      documentVersion: document.version,
      selectedText: 'Original paragraph.',
      startMarker: 'marker-2',
      endMarker: 'marker-3',
      renderedRegionIds: ['region-1'],
      selectionRect: {
        top: 120,
        left: 220,
        bottom: 148,
        right: 420
      }
    });
    sendMessageToExtension({
      type: 'request.draftChanged',
      sessionId: 'request-session-0',
      draftText: 'Rewrite this paragraph.'
    });
    sendMessageToExtension({
      type: 'request.submit',
      sessionId: 'request-session-0',
      draftText: 'Rewrite this paragraph.'
    });

    const readyMessage = await waitFor(
      () => findPostedMessage<{ type: 'suggestion.ready'; proposal: { proposalId: string } }>(postedMessages, 'suggestion.ready'),
      (message) => Boolean(message)
    );

    const driftEdit = new vscode.WorkspaceEdit();
    const originalIndex = document.getText().indexOf('Original paragraph.');
    driftEdit.replace(
      document.uri,
      new vscode.Range(document.positionAt(originalIndex), document.positionAt(originalIndex + 'Original paragraph.'.length)),
      'Changed elsewhere.'
    );
    await vscode.workspace.applyEdit(driftEdit);

    await waitFor(
      () => sessionController.getActiveRequestSession(document),
      (activeRequest) => activeRequest?.validationState === 'invalid'
    );

    sendMessageToExtension({
      type: 'suggestion.apply',
      sessionId: 'request-session-0',
      proposalId: readyMessage.proposal.proposalId
    });

    assert.equal(document.getText(), ['# Drift Flow', '', 'Changed elsewhere.', '', 'Trailing paragraph.'].join('\n'));
    assert.equal(sessionController.getActiveRequestSession(document)?.validationState, 'invalid');
    assert.equal(
      sessionController.getActiveRequestSession(document)?.validationMessage,
      'The document changed. Reselect before submitting.'
    );

    provider.dispose();
  });
});