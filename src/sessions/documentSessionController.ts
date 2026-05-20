import * as vscode from 'vscode';

type RefreshSession = (document: vscode.TextDocument) => Promise<void> | void;

function getDocumentKey(documentOrUri: Pick<vscode.TextDocument, 'uri'> | vscode.Uri | string): string {
  if (typeof documentOrUri === 'string') {
    return documentOrUri;
  }

  if ('uri' in documentOrUri) {
    return documentOrUri.uri.toString();
  }

  return documentOrUri.toString();
}

export class DocumentSessionController {
  private readonly sessionsByDocument = new Map<string, Map<string, RefreshSession>>();

  public track(
    document: Pick<vscode.TextDocument, 'uri'>,
    sessionId: string,
    refreshSession: RefreshSession
  ): vscode.Disposable {
    const documentKey = getDocumentKey(document);
    const sessions = this.sessionsByDocument.get(documentKey) ?? new Map<string, RefreshSession>();

    sessions.set(sessionId, refreshSession);
    this.sessionsByDocument.set(documentKey, sessions);

    return new vscode.Disposable(() => {
      this.untrack(documentKey, sessionId);
    });
  }

  public async refresh(document: vscode.TextDocument): Promise<void> {
    const sessions = this.sessionsByDocument.get(getDocumentKey(document));

    if (!sessions || sessions.size === 0) {
      return;
    }

    for (const refreshSession of sessions.values()) {
      await Promise.resolve(refreshSession(document));
    }
  }

  public getSessionCount(documentOrUri: Pick<vscode.TextDocument, 'uri'> | vscode.Uri | string): number {
    return this.sessionsByDocument.get(getDocumentKey(documentOrUri))?.size ?? 0;
  }

  private untrack(documentKey: string, sessionId: string): void {
    const sessions = this.sessionsByDocument.get(documentKey);

    if (!sessions) {
      return;
    }

    sessions.delete(sessionId);

    if (sessions.size === 0) {
      this.sessionsByDocument.delete(documentKey);
    }
  }
}