import * as vscode from 'vscode';
import type { SelectionAnchor } from '../requests/selectionAnchorResolver';

type RefreshSession = (document: vscode.TextDocument) => Promise<void> | void;

export interface TrackedActiveRequestSession {
  sessionId: string;
  documentUri: string;
  documentVersion: number;
  selectedTextPreview: string;
  selectedRegionIds: string[];
  draftText: string;
  selectionAnchor: SelectionAnchor;
  validationState: 'drafting' | 'invalid' | 'submitting' | 'submitted';
  validationMessage?: string;
}

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
  private activeRequestSession: TrackedActiveRequestSession | null = null;

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

  public setActiveRequestSession(session: TrackedActiveRequestSession | null): void {
    this.activeRequestSession = session;
  }

  public getActiveRequestSession(
    documentOrUri?: Pick<vscode.TextDocument, 'uri'> | vscode.Uri | string
  ): TrackedActiveRequestSession | null {
    if (!this.activeRequestSession) {
      return null;
    }

    if (!documentOrUri) {
      return this.activeRequestSession;
    }

    return this.activeRequestSession.documentUri === getDocumentKey(documentOrUri) ? this.activeRequestSession : null;
  }

  public clearActiveRequestSession(sessionId?: string): void {
    if (!this.activeRequestSession) {
      return;
    }

    if (sessionId && this.activeRequestSession.sessionId !== sessionId) {
      return;
    }

    this.activeRequestSession = null;
  }

  public invalidateActiveRequestForDocument(
    documentOrUri: Pick<vscode.TextDocument, 'uri'> | vscode.Uri | string,
    validationMessage: string
  ): void {
    if (!this.activeRequestSession) {
      return;
    }

    if (this.activeRequestSession.documentUri !== getDocumentKey(documentOrUri)) {
      return;
    }

    this.activeRequestSession = {
      ...this.activeRequestSession,
      validationState: 'invalid',
      validationMessage
    };
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