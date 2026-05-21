import path from 'node:path';
import * as vscode from 'vscode';
import {
  renderMarkdownDocumentWithMetadata,
  toViewerError
} from '../rendering/markdownRenderer';
import { buildSelectionScopedRequestPayload, type SelectionScopedRequestPayload } from '../requests/requestPayloadBuilder';
import { createSelectionAnchor, revalidateSelectionAnchor } from '../requests/selectionAnchorResolver';
import { evaluateSelectionSupport, normalizeRenderedRegionIds } from '../requests/selectionSupportPolicy';
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
    draftText: activeRequest.draftText
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
  private sessionCounter = 0;
  private requestSessionCounter = 0;

  public constructor(
    private readonly extensionUri: vscode.Uri,
    private readonly sessionController: DocumentSessionController,
    private readonly requestService: RequestService<SelectionScopedRequestPayload> = new UnsupportedRequestService<SelectionScopedRequestPayload>()
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

    if (!activeRequest || activeRequest.documentVersion === document.version) {
      return;
    }

    const revalidation = revalidateSelectionAnchor(document.getText(), activeRequest.selectionAnchor);

    if (!revalidation.match || revalidation.status === 'ambiguous' || revalidation.status === 'missing') {
      this.sessionController.setActiveRequestSession({
        ...activeRequest,
        validationState: 'invalid',
        validationMessage: 'The document changed. Reselect before submitting.'
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
      validationState: 'drafting',
      validationMessage: undefined
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

    if (this.sessionController.getActiveRequestSession()) {
      await postMessageToViewer({
        type: 'selection.rejected',
        message: 'Finish or cancel the current request before starting another.'
      });
      return;
    }

    const markdownSource = document.getText();
    const selectionRange = findSelectionRange(markdownSource, message.selectedText);

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

    this.sessionController.setActiveRequestSession({
      sessionId: `request-session-${this.requestSessionCounter++}`,
      documentUri: document.uri.toString(),
      documentVersion: document.version,
      selectedTextPreview: message.selectedText,
      selectedRegionIds: normalizeRenderedRegionIds(message.renderedRegionIds),
      draftText: '',
      selectionAnchor,
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
    const payload = buildSelectionScopedRequestPayload({
      documentUri: document.uri.toString(),
      documentVersion: document.version,
      requestText: draftText,
      selectedMarkdown,
      selectionAnchor: activeRequest.selectionAnchor,
      prefixMarkdown: activeRequest.selectionAnchor.prefixQuote,
      suffixMarkdown: activeRequest.selectionAnchor.suffixQuote
    });

    await this.requestService.submit(payload);

    this.sessionController.setActiveRequestSession({
      ...activeRequest,
      draftText,
      validationState: 'submitted',
      validationMessage: 'Request captured locally.'
    });

    await postMessageToViewer({
      type: 'request.submitted',
      sessionId,
      message: 'Request captured locally.'
    });
  }

  public dispose(): void {
    while (this.disposables.length > 0) {
      this.disposables.pop()?.dispose();
    }
  }
}