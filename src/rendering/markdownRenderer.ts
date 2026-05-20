import MarkdownIt from 'markdown-it';
import type { TextDocument } from 'vscode';
import type { ViewerErrorReasonCode } from '../webview/viewerState';

const markdownRenderer = new MarkdownIt({
  html: false,
  linkify: true,
  breaks: true,
  typographer: false
});

export class MarkdownRenderError extends Error {
  public readonly reasonCode: ViewerErrorReasonCode;

  public constructor(reasonCode: ViewerErrorReasonCode, message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'MarkdownRenderError';
    this.reasonCode = reasonCode;
  }
}

export function renderMarkdown(markdownSource: string): string {
  if (markdownSource.includes('\u0000')) {
    throw new MarkdownRenderError(
      'unsupported-content',
      'The Markdown document contains unsupported null characters.'
    );
  }

  try {
    return markdownRenderer.render(markdownSource);
  } catch (error) {
    throw new MarkdownRenderError(
      'render-failed',
      'Inlinr could not render this Markdown document.',
      { cause: error }
    );
  }
}

export function renderMarkdownDocument(document: Pick<TextDocument, 'getText' | 'isClosed'>): string {
  if (document.isClosed) {
    throw new MarkdownRenderError('missing-document', 'The Markdown document is no longer available.');
  }

  return renderMarkdown(document.getText());
}

export function toViewerError(error: unknown): {
  reasonCode: ViewerErrorReasonCode;
  message: string;
} {
  if (error instanceof MarkdownRenderError) {
    return {
      reasonCode: error.reasonCode,
      message: error.message
    };
  }

  return {
    reasonCode: 'render-failed',
    message: 'Inlinr could not render this Markdown document.'
  };
}