import MarkdownIt from 'markdown-it';
import type { TextDocument } from 'vscode';
import {
  EMPTY_RENDERED_SELECTION_METADATA,
  type RenderedSelectionMetadata,
  type SupportedSelectionRegionKind
} from './renderedSelectionMetadata';
import type { ViewerErrorReasonCode } from '../webview/viewerState';

const markdownRenderer = new MarkdownIt({
  html: false,
  linkify: true,
  breaks: true,
  typographer: false
});

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function isMermaidFence(info: string): boolean {
  const language = info.trim().split(/\s+/, 1)[0]?.toLowerCase();
  return language === 'mermaid';
}

const defaultFenceRenderer = markdownRenderer.renderer.rules.fence;

markdownRenderer.renderer.rules.fence = (tokens, index, options, environment, self) => {
  const token = tokens[index];

  if (isMermaidFence(token.info)) {
    const mermaidSource = token.content.trim();

    return [
      '<section class="mermaid-diagram-block" data-mermaid-block>',
      '<div class="mermaid-diagram-surface" data-mermaid-render hidden></div>',
      '<p class="mermaid-diagram-status" data-mermaid-status>Rendering Mermaid diagram...</p>',
      '<section class="mermaid-diagram-fallback" data-mermaid-fallback hidden>',
      '<p class="mermaid-diagram-fallback-title">Mermaid preview unavailable</p>',
      '<pre class="mermaid-diagram-fallback-source" data-mermaid-fallback-source></pre>',
      '</section>',
      `<pre class="mermaid-diagram-source" data-mermaid-source hidden>${escapeHtml(mermaidSource)}</pre>`,
      '</section>\n'
    ].join('');
  }

  if (defaultFenceRenderer) {
    return defaultFenceRenderer(tokens, index, options, environment, self);
  }

  return self.renderToken(tokens, index, options);
};

export class MarkdownRenderError extends Error {
  public readonly reasonCode: ViewerErrorReasonCode;

  public constructor(reasonCode: ViewerErrorReasonCode, message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'MarkdownRenderError';
    this.reasonCode = reasonCode;
  }
}

function getLineStartOffsets(markdownSource: string): number[] {
  const offsets = [0];

  for (let index = 0; index < markdownSource.length; index += 1) {
    if (markdownSource[index] === '\n') {
      offsets.push(index + 1);
    }
  }

  return offsets;
}

function getSourceOffsetForLine(lineStartOffsets: number[], lineNumber: number, markdownSource: string): number {
  if (lineNumber < 0) {
    return 0;
  }

  return lineStartOffsets[lineNumber] ?? markdownSource.length;
}

function toSupportedSelectionRegionKind(tokenType: string): SupportedSelectionRegionKind | null {
  switch (tokenType) {
    case 'heading_open':
      return 'heading';
    case 'paragraph_open':
      return 'paragraph';
    case 'blockquote_open':
      return 'blockquote';
    case 'list_item_open':
      return 'list-item-prose';
    case 'td_open':
      return 'table-cell';
    default:
      return null;
  }
}

function buildRenderedSelectionMetadata(
  tokens: ReturnType<typeof markdownRenderer.parse>,
  markdownSource: string
): RenderedSelectionMetadata {
  if (tokens.length === 0) {
    return EMPTY_RENDERED_SELECTION_METADATA;
  }

  const lineStartOffsets = getLineStartOffsets(markdownSource);
  const regions: RenderedSelectionMetadata['regions'] = [];
  const markers: RenderedSelectionMetadata['markers'] = [];
  let regionIndex = 0;
  let markerIndex = 0;

  for (const token of tokens) {
    const regionKind = toSupportedSelectionRegionKind(token.type);

    if (!regionKind || !token.map) {
      continue;
    }

    const sourceStart = getSourceOffsetForLine(lineStartOffsets, token.map[0], markdownSource);
    const sourceEnd = getSourceOffsetForLine(lineStartOffsets, token.map[1], markdownSource);

    if (sourceEnd <= sourceStart) {
      continue;
    }

    const regionId = `region-${regionIndex++}`;
    const startMarkerId = `marker-${markerIndex++}`;
    const endMarkerId = `marker-${markerIndex++}`;

    token.attrSet('data-selection-region-id', regionId);
    token.attrSet('data-selection-kind', regionKind);
    token.attrSet('data-selection-start-marker', startMarkerId);
    token.attrSet('data-selection-end-marker', endMarkerId);
    token.attrSet('data-selection-selectable', 'true');

    regions.push({
      regionId,
      kind: regionKind,
      sourceStart,
      sourceEnd,
      selectable: true
    });

    markers.push(
      {
        markerId: startMarkerId,
        regionId,
        sourceOffset: sourceStart
      },
      {
        markerId: endMarkerId,
        regionId,
        sourceOffset: sourceEnd
      }
    );
  }

  return {
    regions,
    markers
  };
}

export function renderMarkdown(markdownSource: string): string {
  return renderMarkdownWithMetadata(markdownSource).html;
}

export function renderMarkdownWithMetadata(markdownSource: string): {
  html: string;
  selectionMetadata: RenderedSelectionMetadata;
} {
  if (markdownSource.includes('\u0000')) {
    throw new MarkdownRenderError(
      'unsupported-content',
      'The Markdown document contains unsupported null characters.'
    );
  }

  try {
    const tokens = markdownRenderer.parse(markdownSource, {});
    const selectionMetadata = buildRenderedSelectionMetadata(tokens, markdownSource);

    return {
      html: markdownRenderer.renderer.render(tokens, markdownRenderer.options, {}),
      selectionMetadata
    };
  } catch (error) {
    throw new MarkdownRenderError(
      'render-failed',
      'Inlinr could not render this Markdown document.',
      { cause: error }
    );
  }
}

export function renderMarkdownDocument(document: Pick<TextDocument, 'getText' | 'isClosed'>): string {
  return renderMarkdownDocumentWithMetadata(document).html;
}

export function renderMarkdownDocumentWithMetadata(
  document: Pick<TextDocument, 'getText' | 'isClosed'>
): {
  html: string;
  selectionMetadata: RenderedSelectionMetadata;
} {
  if (document.isClosed) {
    throw new MarkdownRenderError('missing-document', 'The Markdown document is no longer available.');
  }

  return renderMarkdownWithMetadata(document.getText());
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