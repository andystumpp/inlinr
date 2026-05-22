import path from 'node:path';
import * as vscode from 'vscode';
import {
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
          replacementMarkdown: activeRequest.suggestion.replacementMarkdown
        }
      : undefined
  };
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
  activeRequest: TrackedActiveRequestSession | null = null
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
  private sessionCounter = 0;
  private requestSessionCounter = 0;

  public constructor(
    private readonly extensionUri: vscode.Uri,
    private readonly sessionController: DocumentSessionController,
    private readonly requestService: RequestService<SelectionScopedRequestPayload> = new UnsupportedRequestService<SelectionScopedRequestPayload>(),
    private readonly executionService: ExecutionService = new UnsupportedExecutionService()
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

    webviewPanel.webview.options = {
      enableScripts: true,
      localResourceRoots: [vscode.Uri.joinPath(this.extensionUri, 'media', 'markdownViewer')]
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
        this.sessionController.getActiveRequestSession(targetDocument)
      );

      if (state.kind === 'rendered') {
        this.selectionMetadataByDocument.set(targetDocument.uri.toString(), state.selectionMetadata);
      } else {
        this.selectionMetadataByDocument.delete(targetDocument.uri.toString());
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
    const selectionDecision = evaluateSelectionSupport(message);

    if (!selectionDecision.allowed) {
      await postMessageToViewer({
        type: 'selection.rejected',
        message: selectionDecision.reason ?? 'Select supported rendered prose before opening a request.'
      });
      return;
    }

    if (message.documentVersion !== document.version) {
      await postMessageToViewer({
        type: 'selection.rejected',
        message: 'The document changed. Reselect before opening a request.'
      });
      return;
    }

    const existingActiveRequest = this.sessionController.getActiveRequestSession();

    if (existingActiveRequest && blocksReplacementSelection(existingActiveRequest)) {
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

    if (!activeRequest || activeRequest.sessionId !== sessionId) {
      return;
    }

    if (draftText.trim().length === 0) {
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

    const revalidation = revalidateSelectionAnchor(document.getText(), activeRequest.selectionAnchor);

    if (!revalidation.match || revalidation.status === 'ambiguous' || revalidation.status === 'missing') {
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

    try {
      const executionResult = await this.executionService.execute(payload);
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
          replacementMarkdown: suggestion.replacementMarkdown
        }
      });

      return;
    } catch (error) {
      const executionMessage = error instanceof Error ? error.message : 'Execution failed.';
      const state = error instanceof ExecutionServiceError && error.reasonCode !== 'execution-error' ? 'unavailable' : 'failed';
      const eventType = state === 'unavailable' ? 'request.unavailable' : 'request.failed';

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

  private async applyActiveSuggestion(
    document: vscode.TextDocument,
    sessionId: string,
    proposalId: string,
    postMessageToViewer: (message: ExtensionToViewerMessage) => Promise<void>
  ): Promise<void> {
    const activeRequest = this.sessionController.getActiveRequestSession(document);

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

    try {
      await applySuggestedEdit(document, activeRequest.suggestion);
      this.sessionController.clearActiveRequestSession(sessionId);

      await postMessageToViewer({
        type: 'suggestion.applied',
        sessionId,
        message: 'Suggestion applied.'
      });
    } catch (error) {
      const applyMessage = error instanceof Error ? error.message : 'The suggested edit could not be applied.';

      this.sessionController.setActiveRequestSession({
        ...activeRequest,
        validationState: error instanceof EditApplicationError ? 'invalid' : 'failed',
        validationMessage: applyMessage,
        suggestion: undefined
      });

      await postMessageToViewer({
        type: 'request.invalidated',
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
}