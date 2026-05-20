import path from 'node:path';
import * as vscode from 'vscode';
import { renderMarkdownDocument, toViewerError } from '../rendering/markdownRenderer';
import { DocumentSessionController } from '../sessions/documentSessionController';
import { getMarkdownViewerHtml } from '../webview/getMarkdownViewerHtml';
import { createErrorState, createRenderedState, type ViewerState } from '../webview/viewerState';

function getDocumentTitle(document: vscode.TextDocument): string {
  const filePath = document.uri.scheme === 'untitled' ? document.uri.path : document.uri.fsPath;
  return path.basename(filePath) || document.uri.path;
}

export function createViewerStateForDocument(document: vscode.TextDocument): ViewerState {
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
    return createRenderedState({
      uri: document.uri.toString(),
      title,
      documentVersion: document.version,
      html: renderMarkdownDocument(document)
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

  public constructor(
    private readonly extensionUri: vscode.Uri,
    private readonly sessionController: DocumentSessionController
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
    webviewPanel.webview.options = {
      enableScripts: false,
      localResourceRoots: [vscode.Uri.joinPath(this.extensionUri, 'media', 'markdownViewer')]
    };

    const renderDocument = async (targetDocument: vscode.TextDocument): Promise<void> => {
      if (token.isCancellationRequested) {
        return;
      }

      const state = createViewerStateForDocument(targetDocument);
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

  public dispose(): void {
    while (this.disposables.length > 0) {
      this.disposables.pop()?.dispose();
    }
  }
}