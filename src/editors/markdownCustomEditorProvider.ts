import path from 'node:path';
import * as vscode from 'vscode';
import {
  FirstActionGuidanceState,
  type FirstActionGuidanceCompletionSource
} from '../onboarding/firstActionGuidanceState';
import {
  renderMarkdown,
  renderMarkdownDocumentWithMetadata,
  toViewerError
} from '../rendering/markdownRenderer';
import type { RenderedSelectionMetadata } from '../rendering/renderedSelectionMetadata';
import {
  ExecutionServiceError,
  UnsupportedExecutionService,
  type ExecutionService
} from '../requests/executionService';
import { EditApplicationError, applySuggestedEdit } from '../requests/editApplicationService';
import {
  buildSelectionScopedRequestPayload,
  type EffectiveSelectionScope,
  type SelectionScopedRequestPayload
} from '../requests/requestPayloadBuilder';
import { createSelectionAnchor, revalidateSelectionAnchor } from '../requests/selectionAnchorResolver';
import { evaluateSelectionSupport, normalizeRenderedRegionIds } from '../requests/selectionSupportPolicy';
import { normalizeSuggestedEdit } from '../requests/suggestionNormalizer';
import {
  UnsupportedRequestService,
  type RequestService
} from '../requests/requestService';
import { DocumentSessionController, type TrackedActiveRequestSession } from '../sessions/documentSessionController';
import { getMarkdownViewerHtml } from '../webview/getMarkdownViewerHtml';
import {
  assertValidViewerToExtensionMessage,
  type ExtensionToViewerMessage,
  type SelectionCaptureMessage,
  type ViewerToExtensionMessage
} from '../webview/viewerProtocol';
import { createErrorState, createRenderedState, type ViewerState } from '../webview/viewerState';
import type {
  ScenarioAttemptHandle,
  TelemetryAdapter
} from '../telemetry/telemetryAdapter';
import type { ScenarioStatus, TelemetryFailureClass, TelemetryProperties } from '../telemetry/telemetryContract';

function getDocumentTitle(document: vscode.TextDocument): string {
  const filePath = document.uri.scheme === 'untitled' ? document.uri.path : document.uri.fsPath;
  return path.basename(filePath) || document.uri.path;
}

function toActiveRequestViewState(activeRequest: TrackedActiveRequestSession | null) {
  if (!activeRequest) {
    return null;
  }

  return {
    sessionId: activeRequest.sessionId,
    selectedTextPreview: activeRequest.selectedTextPreview,
    selectedRegionIds: activeRequest.selectedRegionIds,
    validationState: activeRequest.validationState,
    validationMessage: activeRequest.validationMessage,
    draftText: activeRequest.draftText,
    suggestion: activeRequest.suggestion
      ? {
          proposalId: activeRequest.suggestion.proposalId,
          previewMode: activeRequest.suggestion.previewMode,
          replacementMarkdown: activeRequest.suggestion.replacementMarkdown,
          renderedReplacementHtml: renderSuggestionHtml(activeRequest.suggestion.replacementMarkdown)
        }
      : undefined
  };
}

function renderSuggestionHtml(replacementMarkdown: string): string {
  if (replacementMarkdown.length === 0) {
    return '<p class="selection-inline-review-empty">Selected content will be removed.</p>';
  }

  return renderMarkdown(replacementMarkdown)
    .replace(/\sdata-selection-region-id="[^"]*"/g, '')
    .replace(/\sdata-selection-kind="[^"]*"/g, '')
    .replace(/\sdata-selection-start-marker="[^"]*"/g, '')
    .replace(/\sdata-selection-end-marker="[^"]*"/g, '')
    .replace(/\sdata-selection-selectable="[^"]*"/g, '');
}

function findSelectionRange(markdownSource: string, selectedText: string): { sourceStart: number; sourceEnd: number } | null {
  const sourceStart = markdownSource.indexOf(selectedText);

  if (sourceStart === -1) {
    const normalizedSource = markdownSource.replace(/\r\n/g, '\n');
    const normalizedSelectedText = selectedText.replace(/\r\n/g, '\n');
    const normalizedStart = normalizedSource.indexOf(normalizedSelectedText);

    if (normalizedStart === -1) {
      return null;
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

  return {
    sourceStart,
    sourceEnd: sourceStart + selectedText.length
  };
}

interface ResolvedSelectionRange {
  sourceStart: number;
  sourceEnd: number;
  visibleSourceStart: number;
  visibleSourceEnd: number;
  scopeKind: EffectiveSelectionScope['scopeKind'];
}

function resolveSelectionRangeFromMetadata(
  markdownSource: string,
  selectionMetadata: RenderedSelectionMetadata,
  message: SelectionCaptureMessage
): ResolvedSelectionRange | null {
  const normalizedRegionIds = normalizeRenderedRegionIds(message.renderedRegionIds);
  const regionLookup = new Map(selectionMetadata.regions.map((region) => [region.regionId, region]));
  const markerLookup = new Map(selectionMetadata.markers.map((marker) => [marker.markerId, marker]));
  const selectedRegions = normalizedRegionIds
    .map((regionId) => regionLookup.get(regionId))
    .filter((region): region is RenderedSelectionMetadata['regions'][number] => Boolean(region));
  const selectedOffsets: number[] = [];

  for (const region of selectedRegions) {
    selectedOffsets.push(region.sourceStart, region.sourceEnd);
  }

  const startMarker = markerLookup.get(message.startMarker);
  const endMarker = markerLookup.get(message.endMarker);

  if (startMarker) {
    selectedOffsets.push(startMarker.sourceOffset);
  }

  if (endMarker) {
    selectedOffsets.push(endMarker.sourceOffset);
  }

  if (selectedOffsets.length === 0) {
    return null;
  }

  const boundedSourceStart = Math.min(...selectedOffsets);
  const boundedSourceEnd = Math.max(...selectedOffsets);
  const boundedMarkdown = markdownSource.slice(boundedSourceStart, boundedSourceEnd);
  const directMatch = findSelectionRange(boundedMarkdown, message.selectedText);

  const widenToStructuralBoundaries = (sourceStart: number, sourceEnd: number): ResolvedSelectionRange => {
    const findContainingStructuralRegion = (offset: number) => {
      return selectionMetadata.regions
        .filter((region) => {
          return (
            (region.kind === 'heading' || region.kind === 'list-item-prose') &&
            region.sourceStart <= offset &&
            region.sourceEnd > offset
          );
        })
        .sort((left, right) => {
          return (left.sourceEnd - left.sourceStart) - (right.sourceEnd - right.sourceStart);
        })[0];
    };

    const getStructuralRegionEnd = (region: RenderedSelectionMetadata['regions'][number] | undefined) => {
      if (!region) {
        return sourceEnd;
      }

      if (region.kind !== 'list-item-prose') {
        return region.sourceEnd;
      }

      const regionMarkdown = markdownSource.slice(region.sourceStart, region.sourceEnd);

      return regionMarkdown.endsWith('\n\n') ? region.sourceEnd - 1 : region.sourceEnd;
    };

    const startRegion = findContainingStructuralRegion(sourceStart);
    const endProbe = Math.max(sourceStart, sourceEnd - 1);
    const endRegion = findContainingStructuralRegion(endProbe);
    const effectiveSourceStart = startRegion?.sourceStart ?? sourceStart;
    const effectiveSourceEnd = getStructuralRegionEnd(endRegion);

    return {
      sourceStart: effectiveSourceStart,
      sourceEnd: effectiveSourceEnd,
      visibleSourceStart: sourceStart,
      visibleSourceEnd: sourceEnd,
      scopeKind:
        (startRegion?.kind === 'list-item-prose' || endRegion?.kind === 'list-item-prose') &&
        (effectiveSourceStart !== sourceStart || effectiveSourceEnd !== sourceEnd)
          ? 'containing-list-item'
          : 'exact-selection'
    };
  };

  if (directMatch) {
    return widenToStructuralBoundaries(
      boundedSourceStart + directMatch.sourceStart,
      boundedSourceStart + directMatch.sourceEnd
    );
  }

  return widenToStructuralBoundaries(boundedSourceStart, boundedSourceEnd);
}

function shiftEffectiveSelectionScope(
  scope: EffectiveSelectionScope,
  delta: number,
  effectiveSourceStart: number,
  effectiveSourceEnd: number
): EffectiveSelectionScope {
  return {
    ...scope,
    visibleSourceStart: scope.visibleSourceStart + delta,
    visibleSourceEnd: scope.visibleSourceEnd + delta,
    effectiveSourceStart,
    effectiveSourceEnd
  };
}

function blocksReplacementSelection(activeRequest: TrackedActiveRequestSession): boolean {
  return (
    activeRequest.validationState === 'submitting' ||
    activeRequest.validationState === 'submitted' ||
    activeRequest.validationState === 'executing' ||
    activeRequest.validationState === 'review' ||
    activeRequest.validationState === 'applying'
  );
}

export function createViewerStateForDocument(
  document: vscode.TextDocument,
  activeRequest: TrackedActiveRequestSession | null = null,
  options?: {
    firstActionGuidance?: ReturnType<FirstActionGuidanceState['getPendingViewState']>;
  }
): ViewerState {
  const title = getDocumentTitle(document);

  if (document.isClosed) {
    return createErrorState({
      uri: document.uri.toString(),
      title,
      documentVersion: document.version,
      reasonCode: 'missing-document',
      message: 'The Markdown document is no longer available.'
    });
  }

  try {
    const renderedDocument = renderMarkdownDocumentWithMetadata(document);

    return createRenderedState({
      uri: document.uri.toString(),
      title,
      documentVersion: document.version,
      html: renderedDocument.html,
      selectionMetadata: renderedDocument.selectionMetadata,
      firstActionGuidance: options?.firstActionGuidance ?? null,
      activeRequest: toActiveRequestViewState(activeRequest)
    });
  } catch (error) {
    const viewerError = toViewerError(error);

    return createErrorState({
      uri: document.uri.toString(),
      title,
      documentVersion: document.version,
      reasonCode: viewerError.reasonCode,
      message: viewerError.message
    });
  }
}

export class MarkdownCustomEditorProvider implements vscode.CustomTextEditorProvider, vscode.Disposable {
  public static readonly viewType = 'inlinr.markdownViewer';

  private readonly disposables: vscode.Disposable[] = [];
  private readonly selectionMetadataByDocument = new Map<string, RenderedSelectionMetadata>();
  private readonly readyForNextRequestCycleByDocument = new Set<string>();
  private sessionCounter = 0;
  private requestSessionCounter = 0;

  public constructor(
    private readonly extensionUri: vscode.Uri,
    private readonly sessionController: DocumentSessionController,
    private readonly requestService: RequestService<SelectionScopedRequestPayload> = new UnsupportedRequestService<SelectionScopedRequestPayload>(),
    private readonly executionService: ExecutionService = new UnsupportedExecutionService(),
    private readonly telemetryAdapter?: TelemetryAdapter,
    private readonly firstActionGuidanceState?: FirstActionGuidanceState
  ) {
    this.disposables.push(
      vscode.workspace.onDidChangeTextDocument((event) => {
        if (this.sessionController.getSessionCount(event.document) === 0) {
          return;
        }

        void this.sessionController.refresh(event.document);
      })
    );
  }

  public async resolveCustomTextEditor(
    document: vscode.TextDocument,
    webviewPanel: vscode.WebviewPanel,
    token: vscode.CancellationToken
  ): Promise<void> {
    let pendingMessage = Promise.resolve();
    let hasRenderedInitialState = false;
    const initialRenderStartedAt = Date.now();

    webviewPanel.webview.options = {
      enableScripts: true,
      localResourceRoots: [
        vscode.Uri.joinPath(this.extensionUri, 'media', 'markdownViewer'),
        vscode.Uri.joinPath(this.extensionUri, 'node_modules', 'mermaid', 'dist')
      ]
    };

    webviewPanel.webview.onDidReceiveMessage(
      (message) => {
        pendingMessage = pendingMessage
          .catch(() => undefined)
          .then(async () => {
            try {
              assertValidViewerToExtensionMessage(message);
            } catch {
              return;
            }

            await this.handleViewerMessage(document, message, async (payload) => {
              await webviewPanel.webview.postMessage(payload);
            });
          });
      },
      undefined,
      this.disposables
    );

    const renderDocument = async (targetDocument: vscode.TextDocument): Promise<void> => {
      if (token.isCancellationRequested) {
        return;
      }

      this.syncActiveRequestWithDocument(targetDocument);

      const state = createViewerStateForDocument(
        targetDocument,
        this.sessionController.getActiveRequestSession(targetDocument),
        {
          firstActionGuidance: this.firstActionGuidanceState?.getPendingViewState() ?? null
        }
      );

      if (state.kind === 'rendered') {
        this.selectionMetadataByDocument.set(targetDocument.uri.toString(), state.selectionMetadata);
      } else {
        this.selectionMetadataByDocument.delete(targetDocument.uri.toString());
      }

      if (!hasRenderedInitialState) {
        hasRenderedInitialState = true;
        this.recordInitialViewerTelemetry(targetDocument, state, Math.max(0, Date.now() - initialRenderStartedAt));
      } else if (state.kind === 'error') {
        this.recordRenderFailureTelemetry(targetDocument, state.reasonCode);
      }

      webviewPanel.title = `${getDocumentTitle(targetDocument)} Preview`;
      webviewPanel.webview.html = getMarkdownViewerHtml(webviewPanel.webview, this.extensionUri, state);
    };

    const sessionDisposable = this.sessionController.track(
      document,
      `${document.uri.toString()}::${this.sessionCounter++}`,
      renderDocument
    );

    webviewPanel.onDidDispose(
      () => {
        sessionDisposable.dispose();
      },
      undefined,
      this.disposables
    );

    await renderDocument(document);
  }

  private syncActiveRequestWithDocument(document: vscode.TextDocument): void {
    const activeRequest = this.sessionController.getActiveRequestSession(document);

    if (
      !activeRequest ||
      activeRequest.documentVersion === document.version ||
      activeRequest.validationState === 'applying'
    ) {
      return;
    }

    const revalidation = revalidateSelectionAnchor(document.getText(), activeRequest.selectionAnchor);

    if (!revalidation.match || revalidation.status === 'ambiguous' || revalidation.status === 'missing') {
      this.sessionController.setActiveRequestSession({
        ...activeRequest,
        validationState: 'invalid',
        validationMessage: 'The document changed. Reselect before submitting.',
        suggestion: undefined
      });

      return;
    }

    const refreshedAnchor = createSelectionAnchor({
      documentUri: document.uri.toString(),
      capturedDocumentVersion: document.version,
      markdownSource: document.getText(),
      sourceStart: revalidation.match.sourceStart,
      sourceEnd: revalidation.match.sourceEnd
    });

    this.sessionController.setActiveRequestSession({
      ...activeRequest,
      documentVersion: document.version,
      selectedTextPreview: document.getText().slice(revalidation.match.sourceStart, revalidation.match.sourceEnd),
      selectionAnchor: refreshedAnchor,
      effectiveSelectionScope: shiftEffectiveSelectionScope(
        activeRequest.effectiveSelectionScope,
        revalidation.match.sourceStart - activeRequest.selectionAnchor.sourceStart,
        revalidation.match.sourceStart,
        revalidation.match.sourceEnd
      ),
      validationState: 'drafting',
      validationMessage: undefined,
      suggestion: undefined
    });
  }

  private async handleViewerMessage(
    document: vscode.TextDocument,
    message: ViewerToExtensionMessage,
    postMessageToViewer: (message: ExtensionToViewerMessage) => Promise<void>
  ): Promise<void> {
    switch (message.type) {
      case 'selection.capture':
        await this.openActiveRequestFromSelection(document, message, postMessageToViewer);
        return;
      case 'request.draftChanged':
        this.updateActiveRequestDraft(document, message.sessionId, message.draftText);
        return;
      case 'request.submit':
        await this.submitActiveRequest(document, message.sessionId, message.draftText, postMessageToViewer);
        return;
      case 'request.cancel':
        this.sessionController.clearActiveRequestSession(message.sessionId);
        return;
      case 'firstActionGuidance.dismiss':
        await this.completeFirstActionGuidance('dismissed');
        return;
      case 'suggestion.apply':
        await this.applyActiveSuggestion(document, message.sessionId, message.proposalId, postMessageToViewer);
        return;
      case 'suggestion.reject':
        await this.rejectActiveSuggestion(document, message.sessionId, message.proposalId, postMessageToViewer);
        return;
    }
  }

  private async openActiveRequestFromSelection(
    document: vscode.TextDocument,
    message: SelectionCaptureMessage,
    postMessageToViewer: (message: ExtensionToViewerMessage) => Promise<void>
  ): Promise<void> {
    const popupAttempt = this.startScenarioAttempt(document, 'show_inline_request_popup');
    const popupStartedAt = Date.now();
    const selectionDecision = evaluateSelectionSupport(message);

    if (!selectionDecision.allowed) {
      this.completeScenarioAttempt(popupAttempt, 'blocked_safe', {
        reasonCode: 'selection-not-supported'
      });
      await postMessageToViewer({
        type: 'selection.rejected',
        message: selectionDecision.reason ?? 'Select supported rendered prose before opening a request.'
      });
      return;
    }

    if (message.documentVersion !== document.version) {
      this.completeScenarioAttempt(popupAttempt, 'blocked_safe', {
        failureClass: 'selection_resolution_failure',
        reasonCode: 'document-version-changed'
      });
      await postMessageToViewer({
        type: 'selection.rejected',
        message: 'The document changed. Reselect before opening a request.'
      });
      return;
    }

    const existingActiveRequest = this.sessionController.getActiveRequestSession();

    if (existingActiveRequest && blocksReplacementSelection(existingActiveRequest)) {
      this.completeScenarioAttempt(popupAttempt, 'blocked_safe', {
        reasonCode: 'request-already-active'
      });
      await postMessageToViewer({
        type: 'selection.rejected',
        message: 'Finish or cancel the current request before starting another.'
      });
      return;
    }

    if (existingActiveRequest) {
      this.sessionController.clearActiveRequestSession(existingActiveRequest.sessionId);
    }

    const markdownSource = document.getText();
    const selectionMetadata = this.selectionMetadataByDocument.get(document.uri.toString()) ??
      renderMarkdownDocumentWithMetadata(document).selectionMetadata;
    const selectionRange = resolveSelectionRangeFromMetadata(markdownSource, selectionMetadata, message);

    if (!selectionRange) {
      this.completeScenarioAttempt(popupAttempt, 'blocked_safe', {
        failureClass: 'selection_resolution_failure',
        reasonCode: 'selection-range-unresolved'
      });
      await postMessageToViewer({
        type: 'selection.rejected',
        message: 'The selected text could not be mapped safely. Reselect and try again.'
      });
      return;
    }

    const selectionAnchor = createSelectionAnchor({
      documentUri: document.uri.toString(),
      capturedDocumentVersion: document.version,
      markdownSource,
      sourceStart: selectionRange.sourceStart,
      sourceEnd: selectionRange.sourceEnd
    });
    const effectiveSelectionScope: EffectiveSelectionScope = {
      scopeKind: selectionRange.scopeKind,
      visibleSourceStart: selectionRange.visibleSourceStart,
      visibleSourceEnd: selectionRange.visibleSourceEnd,
      effectiveSourceStart: selectionRange.sourceStart,
      effectiveSourceEnd: selectionRange.sourceEnd,
      selectedRegionIds: normalizeRenderedRegionIds(message.renderedRegionIds)
    };

    this.sessionController.setActiveRequestSession({
      sessionId: `request-session-${this.requestSessionCounter++}`,
      documentUri: document.uri.toString(),
      documentVersion: document.version,
      selectedTextPreview: message.selectedText,
      selectedRegionIds: effectiveSelectionScope.selectedRegionIds,
      draftText: '',
      selectionAnchor,
      effectiveSelectionScope,
      validationState: 'drafting'
    });

    const activeRequest = this.sessionController.getActiveRequestSession(document);

    if (!activeRequest) {
      return;
    }

    await this.completeFirstActionGuidance('selection');

    this.emitScenarioCheckpoint(popupAttempt, 'selection_recognized', 'pass');
    this.emitScenarioCheckpoint(popupAttempt, 'popup_shown', 'pass', {
      durationMs: Math.max(0, Date.now() - popupStartedAt)
    });
    this.emitScenarioCheckpoint(popupAttempt, 'scope_accurate', 'pass', {
      properties: {
        scope_kind: selectionRange.scopeKind
      }
    });
    this.completeScenarioAttempt(popupAttempt, 'success');

    if (this.readyForNextRequestCycleByDocument.has(document.uri.toString())) {
      const nextCycleAttempt = this.startScenarioAttempt(document, 'start_next_request_cycle');

      this.emitScenarioCheckpoint(nextCycleAttempt, 'first_cycle_cleared', 'pass');
      this.emitScenarioCheckpoint(nextCycleAttempt, 'fresh_selection_starts_popup', 'pass');
      this.emitScenarioCheckpoint(nextCycleAttempt, 'current_state_reused', 'pass');
      this.completeScenarioAttempt(nextCycleAttempt, 'success');
      this.readyForNextRequestCycleByDocument.delete(document.uri.toString());
    }

    await postMessageToViewer({
      type: 'selection.accepted',
      sessionId: activeRequest.sessionId,
      selectedTextPreview: activeRequest.selectedTextPreview,
      selectedRegionIds: activeRequest.selectedRegionIds,
      draftText: activeRequest.draftText,
      validationState: activeRequest.validationState,
      validationMessage: activeRequest.validationMessage
    });
  }

  private updateActiveRequestDraft(document: vscode.TextDocument, sessionId: string, draftText: string): void {
    const activeRequest = this.sessionController.getActiveRequestSession(document);

    if (!activeRequest || activeRequest.sessionId !== sessionId) {
      return;
    }

    this.sessionController.setActiveRequestSession({
      ...activeRequest,
      draftText,
      validationState: 'drafting',
      validationMessage: undefined
    });
  }

  private async submitActiveRequest(
    document: vscode.TextDocument,
    sessionId: string,
    draftText: string,
    postMessageToViewer: (message: ExtensionToViewerMessage) => Promise<void>
  ): Promise<void> {
    const activeRequest = this.sessionController.getActiveRequestSession(document);
    const submitAttempt = this.startScenarioAttempt(document, 'submit_request_receive_review', {
      sessionId
    });
    const submitStartedAt = Date.now();
    const pendingStartedAt = Date.now();

    if (!activeRequest || activeRequest.sessionId !== sessionId) {
      return;
    }

    if (draftText.trim().length === 0) {
      this.completeScenarioAttempt(submitAttempt, 'blocked_safe', {
        reasonCode: 'empty-request'
      });
      this.sessionController.setActiveRequestSession({
        ...activeRequest,
        draftText,
        validationState: 'invalid',
        validationMessage: 'Enter a request before submitting.'
      });

      await postMessageToViewer({
        type: 'request.invalidated',
        sessionId,
        message: 'Enter a request before submitting.'
      });
      return;
    }

    this.sessionController.setActiveRequestSession({
      ...activeRequest,
      draftText,
      validationState: 'submitting',
      validationMessage: undefined
    });
    this.emitScenarioCheckpoint(submitAttempt, 'request_submitted', 'pass');

    const revalidation = revalidateSelectionAnchor(document.getText(), activeRequest.selectionAnchor);

    if (!revalidation.match || revalidation.status === 'ambiguous' || revalidation.status === 'missing') {
      this.completeScenarioAttempt(submitAttempt, 'blocked_safe', {
        failureClass: 'anchor_revalidation_failure',
        reasonCode: revalidation.status
      });
      this.sessionController.setActiveRequestSession({
        ...activeRequest,
        draftText,
        validationState: 'invalid',
        validationMessage: 'The target changed. Reselect before submitting.'
      });

      await postMessageToViewer({
        type: 'request.invalidated',
        sessionId,
        message: 'The target changed. Reselect before submitting.'
      });

      return;
    }

    const selectedMarkdown = document.getText().slice(revalidation.match.sourceStart, revalidation.match.sourceEnd);
    const effectiveSelectionScope = shiftEffectiveSelectionScope(
      activeRequest.effectiveSelectionScope,
      revalidation.match.sourceStart - activeRequest.selectionAnchor.sourceStart,
      revalidation.match.sourceStart,
      revalidation.match.sourceEnd
    );
    const refreshedAnchor = createSelectionAnchor({
      documentUri: document.uri.toString(),
      capturedDocumentVersion: document.version,
      markdownSource: document.getText(),
      sourceStart: revalidation.match.sourceStart,
      sourceEnd: revalidation.match.sourceEnd
    });
    const payload = buildSelectionScopedRequestPayload({
      documentUri: document.uri.toString(),
      documentVersion: document.version,
      requestText: draftText,
      selectedMarkdown,
      documentMarkdown: document.getText(),
      selectionAnchor: refreshedAnchor,
      effectiveSelectionScope,
    });

    await this.requestService.submit(payload);

    const availability = await this.executionService.checkAvailability();

    if (!availability.available) {
      this.completeScenarioAttempt(submitAttempt, 'blocked_safe', {
        failureClass: 'provider_unavailable',
        reasonCode: availability.reasonCode ?? 'missing-capability'
      });
      this.recordExecutionFailureScenario(document, sessionId, 'blocked_safe', 'provider_unavailable', availability.reasonCode);
      this.sessionController.setActiveRequestSession({
        ...activeRequest,
        draftText,
        selectedTextPreview: selectedMarkdown,
        selectionAnchor: refreshedAnchor,
        effectiveSelectionScope,
        submittedPayload: payload,
        validationState: 'unavailable',
        validationMessage: availability.message ?? 'Execution is unavailable.',
        suggestion: undefined
      });

      await postMessageToViewer({
        type: 'request.unavailable',
        sessionId,
        message: availability.message ?? 'Execution is unavailable.'
      });

      return;
    }

    this.sessionController.setActiveRequestSession({
      ...activeRequest,
      draftText,
      selectedTextPreview: selectedMarkdown,
      selectionAnchor: refreshedAnchor,
      effectiveSelectionScope,
      submittedPayload: payload,
      validationState: 'executing',
      validationMessage: 'Generating suggestion…',
      suggestion: undefined
    });

    await postMessageToViewer({
      type: 'request.executing',
      sessionId,
      message: 'Generating suggestion…'
    });
    this.emitScenarioCheckpoint(submitAttempt, 'pending_visible', 'pass');

    const executionStartedAt = Date.now();

    try {
      const executionResult = await this.executionService.execute(payload);
      this.emitDependency(submitAttempt, {
        operationName: 'execute_selection_request',
        dependencyType: 'copilot_language_model',
        status: 'success',
        durationMs: Math.max(0, Date.now() - executionStartedAt),
        resultCode: executionResult.modelId ?? 'success',
        properties: {
          provider_kind: 'copilot'
        }
      });
      const suggestion = normalizeSuggestedEdit(payload, executionResult);

      this.sessionController.setActiveRequestSession({
        ...activeRequest,
        draftText,
        selectedTextPreview: selectedMarkdown,
        selectionAnchor: refreshedAnchor,
        effectiveSelectionScope,
        submittedPayload: payload,
        validationState: 'review',
        validationMessage: 'Suggestion ready.',
        suggestion
      });

      await postMessageToViewer({
        type: 'suggestion.ready',
        sessionId,
        proposal: {
          proposalId: suggestion.proposalId,
          previewMode: suggestion.previewMode,
          replacementMarkdown: suggestion.replacementMarkdown,
          renderedReplacementHtml: renderSuggestionHtml(suggestion.replacementMarkdown)
        }
      });

      this.emitScenarioCheckpoint(submitAttempt, 'review_rendered_inline', 'pass', {
        durationMs: Math.max(0, Date.now() - submitStartedAt)
      });
      this.completeScenarioAttempt(submitAttempt, 'success');
      await this.completeFirstActionGuidance('successful-request');

      return;
    } catch (error) {
      const executionMessage = error instanceof Error ? error.message : 'Execution failed.';
      const state = error instanceof ExecutionServiceError && error.reasonCode !== 'execution-error' ? 'unavailable' : 'failed';
      const eventType = state === 'unavailable' ? 'request.unavailable' : 'request.failed';
      const failureClass = this.toExecutionFailureClass(error);

      this.emitDependency(submitAttempt, {
        operationName: 'execute_selection_request',
        dependencyType: 'copilot_language_model',
        status: 'failure',
        durationMs: Math.max(0, Date.now() - executionStartedAt),
        resultCode: error instanceof ExecutionServiceError ? error.reasonCode : 'execution-error',
        properties: {
          provider_kind: 'copilot'
        }
      });
      this.emitException(submitAttempt, {
        operationName: 'execute_selection_request',
        errorClass: error instanceof Error ? error.name : 'UnknownError',
        handled: true,
        severity: state === 'unavailable' ? 'warning' : 'error',
        properties: {
          reason_code: error instanceof ExecutionServiceError ? error.reasonCode : 'execution-error'
        }
      });
      this.completeScenarioAttempt(submitAttempt, state === 'unavailable' ? 'blocked_safe' : 'failure', {
        failureClass,
        reasonCode: error instanceof ExecutionServiceError ? error.reasonCode : 'execution-error'
      });
      this.recordExecutionFailureScenario(
        document,
        sessionId,
        state === 'unavailable' ? 'blocked_safe' : 'failure',
        failureClass,
        error instanceof ExecutionServiceError ? error.reasonCode : 'execution-error'
      );

      this.sessionController.setActiveRequestSession({
        ...activeRequest,
        draftText,
        selectedTextPreview: selectedMarkdown,
        selectionAnchor: refreshedAnchor,
        effectiveSelectionScope,
        submittedPayload: payload,
        validationState: state,
        validationMessage: executionMessage,
        suggestion: undefined
      });

      await postMessageToViewer({
        type: eventType,
        sessionId,
        message: executionMessage
      });

      return;
    }
  }

  private async completeFirstActionGuidance(completionSource: FirstActionGuidanceCompletionSource): Promise<void> {
    if (!this.firstActionGuidanceState) {
      return;
    }

    await this.firstActionGuidanceState.markCompleted(completionSource);
  }

  private async applyActiveSuggestion(
    document: vscode.TextDocument,
    sessionId: string,
    proposalId: string,
    postMessageToViewer: (message: ExtensionToViewerMessage) => Promise<void>
  ): Promise<void> {
    const activeRequest = this.sessionController.getActiveRequestSession(document);
    const applyAttempt = this.startScenarioAttempt(document, 'apply_suggested_change', {
      sessionId
    });
    const applyStartedAt = Date.now();

    if (!activeRequest || activeRequest.sessionId !== sessionId || !activeRequest.suggestion) {
      return;
    }

    if (activeRequest.suggestion.proposalId !== proposalId) {
      return;
    }

    this.sessionController.setActiveRequestSession({
      ...activeRequest,
      validationState: 'applying',
      validationMessage: 'Applying suggestion…'
    });
    this.emitScenarioCheckpoint(applyAttempt, 'apply_available', 'pass');

    try {
      await applySuggestedEdit(document, activeRequest.suggestion);
      this.emitScenarioCheckpoint(applyAttempt, 'mutate_targeted_range', 'pass');
      this.emitScenarioCheckpoint(applyAttempt, 'render_refresh', 'pass', {
        durationMs: Math.max(0, Date.now() - applyStartedAt)
      });
      this.completeScenarioAttempt(applyAttempt, 'success');
      this.readyForNextRequestCycleByDocument.add(document.uri.toString());
      this.sessionController.clearActiveRequestSession(sessionId);
      await this.sessionController.refresh(document);

      await postMessageToViewer({
        type: 'suggestion.applied',
        sessionId,
        message: 'Suggestion applied.'
      });
    } catch (error) {
      const applyMessage = error instanceof Error ? error.message : 'The suggested edit could not be applied.';
      const reasonCode = error instanceof EditApplicationError ? error.reasonCode : 'apply-failed';
      const isTargetResolutionSafeBlock = reasonCode === 'missing-target' || reasonCode === 'ambiguous-target';
      const failureClass = isTargetResolutionSafeBlock ? 'anchor_revalidation_failure' : 'apply_failure';
      const failureEventType = isTargetResolutionSafeBlock ? 'request.invalidated' : 'request.failed';

      this.completeScenarioAttempt(applyAttempt, isTargetResolutionSafeBlock ? 'blocked_safe' : 'failure', {
        failureClass,
        reasonCode
      });

      if (isTargetResolutionSafeBlock) {
        this.recordExecutionFailureScenario(document, sessionId, 'blocked_safe', failureClass, reasonCode);
      }

      this.sessionController.setActiveRequestSession({
        ...activeRequest,
        validationState: isTargetResolutionSafeBlock ? 'invalid' : 'failed',
        validationMessage: applyMessage,
        suggestion: undefined
      });

      await postMessageToViewer({
        type: failureEventType,
        sessionId,
        message: applyMessage
      });
    }
  }

  private async rejectActiveSuggestion(
    document: vscode.TextDocument,
    sessionId: string,
    proposalId: string,
    postMessageToViewer: (message: ExtensionToViewerMessage) => Promise<void>
  ): Promise<void> {
    const activeRequest = this.sessionController.getActiveRequestSession(document);
    const rejectAttempt = this.startScenarioAttempt(document, 'reject_suggested_change', {
      sessionId
    });

    if (!activeRequest || activeRequest.sessionId !== sessionId || !activeRequest.suggestion) {
      return;
    }

    if (activeRequest.suggestion.proposalId !== proposalId) {
      return;
    }

    this.sessionController.setActiveRequestSession({
      ...activeRequest,
      validationState: 'drafting',
      validationMessage: 'Suggestion dismissed.',
      suggestion: undefined
    });
    this.emitScenarioCheckpoint(rejectAttempt, 'reject_available', 'pass');
    this.emitScenarioCheckpoint(rejectAttempt, 'document_unchanged', 'pass');
    this.emitScenarioCheckpoint(rejectAttempt, 'review_dismissed', 'pass');
    this.completeScenarioAttempt(rejectAttempt, 'cancelled_user');
    this.readyForNextRequestCycleByDocument.add(document.uri.toString());

    await postMessageToViewer({
      type: 'suggestion.rejected',
      sessionId,
      draftText: activeRequest.draftText,
      message: 'Suggestion dismissed.'
    });
  }

  public dispose(): void {
    while (this.disposables.length > 0) {
      this.disposables.pop()?.dispose();
    }
  }

  private recordInitialViewerTelemetry(document: vscode.TextDocument, state: ViewerState, renderDurationMs: number): void {
    if (state.kind === 'rendered') {
      const attempt = this.startScenarioAttempt(document, 'load_markdown_preview');

      this.emitScenarioCheckpoint(attempt, 'route_to_viewer', 'pass');
      this.emitScenarioCheckpoint(attempt, 'render_markdown', 'pass', {
        durationMs: renderDurationMs
      });
      this.emitScenarioCheckpoint(attempt, 'viewer_usable', 'pass');
      this.completeScenarioAttempt(attempt, 'success');
      return;
    }

    this.recordRenderFailureTelemetry(document, state.reasonCode);
  }

  private recordRenderFailureTelemetry(document: vscode.TextDocument, reasonCode: string): void {
    const attempt = this.startScenarioAttempt(document, 'stable_viewer_on_render_failure');

    this.emitScenarioCheckpoint(attempt, 'viewer_remains_active', 'pass');
    this.emitScenarioCheckpoint(attempt, 'failure_state_visible', 'pass', {
      reasonCode
    });
    this.emitScenarioCheckpoint(attempt, 'document_preserved', 'pass');
    this.completeScenarioAttempt(attempt, 'blocked_safe', {
      failureClass: 'render_failure',
      reasonCode
    });
  }

  private recordExecutionFailureScenario(
    document: vscode.TextDocument,
    sessionId: string,
    status: ScenarioStatus,
    failureClass: TelemetryFailureClass,
    reasonCode?: string
  ): void {
    const attempt = this.startScenarioAttempt(document, 'preserve_document_on_execution_failure', {
      sessionId
    });

    this.emitScenarioCheckpoint(attempt, 'failure_visible', 'pass', {
      failureClass,
      reasonCode
    });
    this.emitScenarioCheckpoint(attempt, 'review_apply_blocked', 'pass');
    this.emitScenarioCheckpoint(attempt, 'document_preserved', 'pass');
    this.completeScenarioAttempt(attempt, status, {
      failureClass,
      reasonCode
    });
  }

  private startScenarioAttempt(
    document: vscode.TextDocument,
    scenarioId: string,
    options: {
      sessionId?: string;
      parentId?: string;
      properties?: TelemetryProperties;
    } = {}
  ): ScenarioAttemptHandle | undefined {
    return this.telemetryAdapter?.startScenarioAttempt({
      scenarioId,
      sessionId: options.sessionId ?? document.uri.toString(),
      parentId: options.parentId,
      properties: {
        surface: 'custom_editor',
        ...(options.properties ?? {})
      }
    });
  }

  private emitScenarioCheckpoint(
    attempt: ScenarioAttemptHandle | undefined,
    checkpointId: string,
    status: 'pass' | 'failure' | 'blocked_safe' | 'degraded',
    options: {
      failureClass?: TelemetryFailureClass;
      reasonCode?: string;
      durationMs?: number;
      properties?: TelemetryProperties;
    } = {}
  ): void {
    if (!attempt || !this.telemetryAdapter) {
      return;
    }

    this.telemetryAdapter.emitScenarioCheckpoint(attempt, {
      checkpointId,
      status,
      failureClass: options.failureClass,
      reasonCode: options.reasonCode,
      durationMs: options.durationMs,
      properties: options.properties
    });
  }

  private completeScenarioAttempt(
    attempt: ScenarioAttemptHandle | undefined,
    status: ScenarioStatus,
    options: {
      failureClass?: TelemetryFailureClass;
      reasonCode?: string;
      properties?: TelemetryProperties;
    } = {}
  ): void {
    if (!attempt || !this.telemetryAdapter) {
      return;
    }

    this.telemetryAdapter.completeScenarioAttempt(attempt, {
      status,
      failureClass: options.failureClass,
      reasonCode: options.reasonCode,
      properties: options.properties
    });
  }

  private emitDependency(
    attempt: ScenarioAttemptHandle | undefined,
    options: {
      operationName: string;
      dependencyType: string;
      status: 'success' | 'failure';
      durationMs: number;
      resultCode?: string;
      properties?: TelemetryProperties;
    }
  ): void {
    if (!attempt || !this.telemetryAdapter) {
      return;
    }

    this.telemetryAdapter.emitDependency(attempt, options);
  }

  private emitException(
    attempt: ScenarioAttemptHandle | undefined,
    options: {
      operationName: string;
      errorClass: string;
      handled: boolean;
      severity: 'warning' | 'error' | 'critical';
      properties?: TelemetryProperties;
    }
  ): void {
    if (!attempt || !this.telemetryAdapter) {
      return;
    }

    this.telemetryAdapter.emitException(attempt, options);
  }

  private toExecutionFailureClass(error: unknown): TelemetryFailureClass {
    if (error instanceof ExecutionServiceError) {
      return error.reasonCode === 'execution-error' ? 'unexpected_exception' : 'provider_unavailable';
    }

    return 'unexpected_exception';
  }
}
