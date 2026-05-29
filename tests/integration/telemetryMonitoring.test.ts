import assert from 'node:assert/strict';
import * as vscode from 'vscode';
import { MarkdownCustomEditorProvider } from '../../src/editors/markdownCustomEditorProvider';
import { renderMarkdownWithMetadata } from '../../src/rendering/markdownRenderer';
import type { SelectionScopedRequestPayload } from '../../src/requests/requestPayloadBuilder';
import { InMemoryRequestService } from '../../src/requests/requestService';
import { DocumentSessionController } from '../../src/sessions/documentSessionController';
import type { TelemetryEvent } from '../../src/telemetry/telemetryContract';
import {
  FakeExecutionService,
  closeAllEditors,
  createFailedExecutionOutcome,
  createTemporaryMarkdownDocument,
  createMockWebviewPanel,
  createRecordingTelemetryHarness,
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

function findScenarioEvents(events: readonly TelemetryEvent[], scenarioId: string): readonly TelemetryEvent[] {
  return events.filter((event) => event.context.scenarioId === scenarioId);
}

function findCheckpointIds(events: readonly TelemetryEvent[]): string[] {
  return events
    .filter((event) => event.eventType === 'scenario_checkpoint')
    .map((event) => event.checkpointId);
}

function findScenarioResult(events: readonly TelemetryEvent[]) {
  return events.find((event) => event.eventType === 'scenario_result');
}

function findDependencyEvents(events: readonly TelemetryEvent[]) {
  return events.filter((event) => event.eventType === 'dependency');
}

function findExceptionEvents(events: readonly TelemetryEvent[]) {
  return events.filter((event) => event.eventType === 'exception');
}

function assertNoSensitiveTelemetryValues(events: readonly TelemetryEvent[], sensitiveValues: readonly string[]): void {
  for (const event of events) {
    assert.notEqual(event.context.sessionId, 'request-session-0');
    assert.notEqual(event.context.sessionId, 'request-session-1');

    const propertyValues = Object.values(event.properties ?? {}).map((value) => String(value));

    for (const sensitiveValue of sensitiveValues) {
      assert.equal(propertyValues.includes(sensitiveValue), false);
    }
  }
}

suite('Telemetry monitoring integration', () => {
  const cleanupActions: Array<() => Promise<void>> = [];

  teardown(async () => {
    await closeAllEditors();

    while (cleanupActions.length > 0) {
      await cleanupActions.pop()?.();
    }
  });

  test('provides a reusable recording telemetry harness for extension-host flows', () => {
    const { adapter, sink } = createRecordingTelemetryHarness();

    adapter.emit({
      eventType: 'scenario_attempt',
      context: {
        operationId: 'operation-1',
        sessionId: 'session-123',
        scenarioId: 'load_markdown_preview',
        scenarioVersion: '1',
        criticality: 'core'
      },
      status: 'started'
    });

    assert.equal(sink.getEvents().length, 1);
    assert.equal(sink.getEvents()[0].eventType, 'scenario_attempt');
  });

  test('records preview-load telemetry when the custom editor resolves', async () => {
    const { adapter, sink } = createRecordingTelemetryHarness();
    const provider = new MarkdownCustomEditorProvider(
      getExtensionUri(),
      new DocumentSessionController(),
      new InMemoryRequestService<SelectionScopedRequestPayload>(),
      new FakeExecutionService(createSuccessfulExecutionOutcome('No-op rewrite.')),
      adapter
    );
    const document = await vscode.workspace.openTextDocument(getWorkspaceFile('selection-request-basic.md'));
    const { panel } = createMockWebviewPanel();

    await provider.resolveCustomTextEditor(document, panel, new vscode.CancellationTokenSource().token);

    const previewEvents = findScenarioEvents(sink.getEvents(), 'load_markdown_preview');

    assert.deepEqual(previewEvents.map((event) => event.eventType), [
      'scenario_attempt',
      'scenario_checkpoint',
      'scenario_checkpoint',
      'scenario_checkpoint',
      'scenario_result'
    ]);
    assert.deepEqual(findCheckpointIds(previewEvents), ['route_to_viewer', 'render_markdown', 'viewer_usable']);
    assert.equal(findScenarioResult(previewEvents)?.status, 'success');

    const renderMarkdownCheckpoint = previewEvents.find((event) => event.eventType === 'scenario_checkpoint' && event.checkpointId === 'render_markdown');
    assert.ok(renderMarkdownCheckpoint);
    assert.equal(renderMarkdownCheckpoint.eventType, 'scenario_checkpoint');
    assert.ok(typeof renderMarkdownCheckpoint.durationMs === 'number');
    assert.ok(renderMarkdownCheckpoint.durationMs >= 0);

    provider.dispose();
  });

  test('records popup-open, submit-to-review, and dependency telemetry for a successful request flow', async () => {
    const { adapter, sink } = createRecordingTelemetryHarness();
    const requestService = new InMemoryRequestService<SelectionScopedRequestPayload>();
    const provider = new MarkdownCustomEditorProvider(
      getExtensionUri(),
      new DocumentSessionController(),
      requestService,
      new FakeExecutionService(createSuccessfulExecutionOutcome('This paragraph now reads more clearly.')),
      adapter
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
      () => findPostedMessage<{ type: 'suggestion.ready' }>(postedMessages, 'suggestion.ready'),
      (message) => Boolean(message)
    );

    const popupEvents = findScenarioEvents(sink.getEvents(), 'show_inline_request_popup');
    const submitEvents = findScenarioEvents(sink.getEvents(), 'submit_request_receive_review');
    const dependencyEvents = findDependencyEvents(submitEvents);
    const submitResult = findScenarioResult(submitEvents);

    assert.deepEqual(findCheckpointIds(popupEvents), ['selection_recognized', 'popup_shown', 'scope_accurate']);
    assert.equal(findScenarioResult(popupEvents)?.status, 'success');
    assert.deepEqual(findCheckpointIds(submitEvents), ['request_submitted', 'pending_visible', 'review_rendered_inline']);
    assert.ok(submitResult);
    assert.equal(submitResult.status, 'success');
    assert.equal(dependencyEvents.length, 1);
    assert.equal(dependencyEvents[0].status, 'success');
    assertNoSensitiveTelemetryValues([...popupEvents, ...submitEvents], [selectedText, 'Tighten the wording.']);

    const popupShownCheckpoint = popupEvents.find((event) => event.eventType === 'scenario_checkpoint' && event.checkpointId === 'popup_shown');
    assert.ok(popupShownCheckpoint);
    assert.equal(popupShownCheckpoint.eventType, 'scenario_checkpoint');
    assert.ok(typeof popupShownCheckpoint.durationMs === 'number');
    assert.ok(popupShownCheckpoint.durationMs >= 0);

    const reviewRenderedCheckpoint = submitEvents.find((event) => event.eventType === 'scenario_checkpoint' && event.checkpointId === 'review_rendered_inline');
    assert.ok(reviewRenderedCheckpoint);
    assert.equal(reviewRenderedCheckpoint.eventType, 'scenario_checkpoint');
    assert.ok(typeof reviewRenderedCheckpoint.durationMs === 'number');
    assert.ok(reviewRenderedCheckpoint.durationMs >= 0);

    provider.dispose();
  });

  test('records reject and next-request-cycle telemetry after a follow-up selection', async () => {
    const { adapter, sink } = createRecordingTelemetryHarness();
    const provider = new MarkdownCustomEditorProvider(
      getExtensionUri(),
      new DocumentSessionController(),
      new InMemoryRequestService<SelectionScopedRequestPayload>(),
      new FakeExecutionService(createSuccessfulExecutionOutcome('Rewritten paragraph.')),
      adapter
    );
    const document = await vscode.workspace.openTextDocument({
      language: 'markdown',
      content: ['# Reject Then Retry', '', 'Original paragraph.', '', 'Trailing paragraph.'].join('\n')
    });
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
      type: 'suggestion.reject',
      sessionId: 'request-session-0',
      proposalId: readyMessage.proposal.proposalId
    });

    await waitFor(
      () => findPostedMessage<{ type: 'suggestion.rejected' }>(postedMessages, 'suggestion.rejected'),
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

    await waitFor(
      () => postedMessages.find((message) => {
        return typeof message === 'object' && message !== null && 'type' in message && message.type === 'selection.accepted' &&
          'selectedTextPreview' in message && message.selectedTextPreview === 'Trailing paragraph.';
      }),
      (message) => Boolean(message)
    );

    const rejectEvents = findScenarioEvents(sink.getEvents(), 'reject_suggested_change');
    const nextCycleEvents = findScenarioEvents(sink.getEvents(), 'start_next_request_cycle');

    assert.deepEqual(findCheckpointIds(rejectEvents), ['reject_available', 'document_unchanged', 'review_dismissed']);
    assert.equal(findScenarioResult(rejectEvents)?.status, 'cancelled_user');
    assert.deepEqual(findCheckpointIds(nextCycleEvents), ['first_cycle_cleared', 'fresh_selection_starts_popup', 'current_state_reused']);
    assert.equal(findScenarioResult(nextCycleEvents)?.status, 'success');
    assertNoSensitiveTelemetryValues([...rejectEvents, ...nextCycleEvents], ['Rewrite this paragraph.', 'Original paragraph.']);

    provider.dispose();
  });

  test('records apply telemetry and execution-failure recovery telemetry', async () => {
    const { adapter, sink } = createRecordingTelemetryHarness();
    const sessionController = new DocumentSessionController();
    const provider = new MarkdownCustomEditorProvider(
      getExtensionUri(),
      sessionController,
      new InMemoryRequestService<SelectionScopedRequestPayload>(),
      new FakeExecutionService([
        createSuccessfulExecutionOutcome('Rewritten paragraph.'),
        createFailedExecutionOutcome('Execution failed.')
      ]),
      adapter
    );
    const temporaryDocument = await createTemporaryMarkdownDocument(
      'telemetry-apply-flow',
      ['# Apply Flow', '', 'Original paragraph.', '', 'Trailing paragraph.'].join('\n')
    );
    cleanupActions.push(temporaryDocument.cleanup);
    const document = temporaryDocument.document;
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
    sendMessageToExtension({
      type: 'request.draftChanged',
      sessionId: 'request-session-1',
      draftText: 'Break this request.'
    });
    sendMessageToExtension({
      type: 'request.submit',
      sessionId: 'request-session-1',
      draftText: 'Break this request.'
    });

    await waitFor(
      () => findPostedMessage<{ type: 'request.failed' }>(postedMessages, 'request.failed'),
      (message) => Boolean(message)
    );

    const applyEvents = findScenarioEvents(sink.getEvents(), 'apply_suggested_change');
    const failureRecoveryEvents = findScenarioEvents(sink.getEvents(), 'preserve_document_on_execution_failure');
    const failedSubmitEvents = findScenarioEvents(sink.getEvents(), 'submit_request_receive_review').filter((event) => {
      return event.context.sessionId === sink.getEvents().find((candidate) => {
        return candidate.context.scenarioId === 'preserve_document_on_execution_failure';
      })?.context.sessionId;
    });
    const failureDependencies = findDependencyEvents(failedSubmitEvents);
    const failureExceptions = findExceptionEvents(failedSubmitEvents);

    assert.deepEqual(findCheckpointIds(applyEvents), ['apply_available', 'mutate_targeted_range', 'render_refresh']);
    assert.equal(findScenarioResult(applyEvents)?.status, 'success');
    assert.deepEqual(findCheckpointIds(failureRecoveryEvents), ['failure_visible', 'review_apply_blocked', 'document_preserved']);
    assert.equal(findScenarioResult(failureRecoveryEvents)?.status, 'failure');
    assert.equal(failureDependencies.length, 1);
    assert.equal(failureDependencies[0].status, 'failure');
    assert.equal(failureExceptions.length, 1);
    assert.equal(failureExceptions[0].eventType, 'exception');
    assert.equal(sessionController.getActiveRequestSession(document)?.validationState, 'failed');
    assertNoSensitiveTelemetryValues([...failureRecoveryEvents, ...failedSubmitEvents], ['Break this request.', 'Trailing paragraph.']);

    const renderRefreshCheckpoint = applyEvents.find((event) => event.eventType === 'scenario_checkpoint' && event.checkpointId === 'render_refresh');
    assert.ok(renderRefreshCheckpoint);
    assert.equal(renderRefreshCheckpoint.eventType, 'scenario_checkpoint');
    assert.ok(typeof renderRefreshCheckpoint.durationMs === 'number');
    assert.ok(renderRefreshCheckpoint.durationMs >= 0);

    provider.dispose();
  });

  test('records blocked-safe telemetry when execution is unavailable without leaking request text', async () => {
    const { adapter, sink } = createRecordingTelemetryHarness();
    const provider = new MarkdownCustomEditorProvider(
      getExtensionUri(),
      new DocumentSessionController(),
      new InMemoryRequestService<SelectionScopedRequestPayload>(),
      new FakeExecutionService(createUnavailableExecutionOutcome('Execution is unavailable.')),
      adapter
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
    sendMessageToExtension({
      type: 'request.draftChanged',
      sessionId: 'request-session-0',
      draftText: 'Need a suggestion.'
    });
    sendMessageToExtension({
      type: 'request.submit',
      sessionId: 'request-session-0',
      draftText: 'Need a suggestion.'
    });

    await waitFor(
      () => findPostedMessage<{ type: 'request.unavailable' }>(postedMessages, 'request.unavailable'),
      (message) => Boolean(message)
    );

    const submitEvents = findScenarioEvents(sink.getEvents(), 'submit_request_receive_review');
    const recoveryEvents = findScenarioEvents(sink.getEvents(), 'preserve_document_on_execution_failure');

    assert.equal(findScenarioResult(submitEvents)?.status, 'blocked_safe');
    assert.equal(findScenarioResult(recoveryEvents)?.status, 'blocked_safe');
    assertNoSensitiveTelemetryValues([...submitEvents, ...recoveryEvents], [selectedText, 'Need a suggestion.']);

    provider.dispose();
  });
});
