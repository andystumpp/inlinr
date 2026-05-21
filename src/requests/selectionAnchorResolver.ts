export interface SelectionAnchor {
  documentUri: string;
  capturedDocumentVersion: number;
  sourceStart: number;
  sourceEnd: number;
  selectedText: string;
  prefixQuote: string;
  suffixQuote: string;
  strategyVersion: 'v1';
}

export interface CreateSelectionAnchorInput {
  documentUri: string;
  capturedDocumentVersion: number;
  markdownSource: string;
  sourceStart: number;
  sourceEnd: number;
  prefixWindow?: number;
  suffixWindow?: number;
}

export interface SelectionAnchorMatch {
  sourceStart: number;
  sourceEnd: number;
}

export interface SelectionAnchorRevalidationResult {
  status: 'resolved' | 'refound' | 'ambiguous' | 'missing';
  match: SelectionAnchorMatch | null;
}

function assertValidSourceRange(markdownSource: string, sourceStart: number, sourceEnd: number): void {
  if (sourceStart < 0 || sourceEnd < sourceStart || sourceEnd > markdownSource.length) {
    throw new RangeError('Selection anchor source range is out of bounds.');
  }
}

function findAllMatchStarts(haystack: string, needle: string): number[] {
  if (needle.length === 0) {
    return [];
  }

  const matches: number[] = [];
  let searchStart = 0;

  while (searchStart <= haystack.length - needle.length) {
    const nextMatch = haystack.indexOf(needle, searchStart);

    if (nextMatch === -1) {
      break;
    }

    matches.push(nextMatch);
    searchStart = nextMatch + 1;
  }

  return matches;
}

export function createSelectionAnchor(input: CreateSelectionAnchorInput): SelectionAnchor {
  assertValidSourceRange(input.markdownSource, input.sourceStart, input.sourceEnd);

  const selectedText = input.markdownSource.slice(input.sourceStart, input.sourceEnd);

  if (selectedText.trim().length === 0) {
    throw new TypeError('Selection anchor requires a non-empty source selection.');
  }

  const prefixWindow = input.prefixWindow ?? 32;
  const suffixWindow = input.suffixWindow ?? 32;

  return {
    documentUri: input.documentUri,
    capturedDocumentVersion: input.capturedDocumentVersion,
    sourceStart: input.sourceStart,
    sourceEnd: input.sourceEnd,
    selectedText,
    prefixQuote: input.markdownSource.slice(Math.max(0, input.sourceStart - prefixWindow), input.sourceStart),
    suffixQuote: input.markdownSource.slice(input.sourceEnd, Math.min(input.markdownSource.length, input.sourceEnd + suffixWindow)),
    strategyVersion: 'v1'
  };
}

export function revalidateSelectionAnchor(markdownSource: string, anchor: SelectionAnchor): SelectionAnchorRevalidationResult {
  assertValidSourceRange(markdownSource, Math.min(anchor.sourceStart, markdownSource.length), Math.min(anchor.sourceEnd, markdownSource.length));

  const exactSelection = markdownSource.slice(anchor.sourceStart, anchor.sourceEnd);

  if (exactSelection === anchor.selectedText) {
    return {
      status: 'resolved',
      match: {
        sourceStart: anchor.sourceStart,
        sourceEnd: anchor.sourceEnd
      }
    };
  }

  const candidateMatches = findAllMatchStarts(markdownSource, anchor.selectedText)
    .map((sourceStart) => ({
      sourceStart,
      sourceEnd: sourceStart + anchor.selectedText.length
    }))
    .filter((candidate) => {
      const prefixMatch = anchor.prefixQuote.length === 0 || markdownSource.slice(Math.max(0, candidate.sourceStart - anchor.prefixQuote.length), candidate.sourceStart) === anchor.prefixQuote;
      const suffixMatch = anchor.suffixQuote.length === 0 || markdownSource.slice(candidate.sourceEnd, Math.min(markdownSource.length, candidate.sourceEnd + anchor.suffixQuote.length)) === anchor.suffixQuote;

      return prefixMatch && suffixMatch;
    });

  if (candidateMatches.length === 0) {
    return {
      status: 'missing',
      match: null
    };
  }

  if (candidateMatches.length > 1) {
    return {
      status: 'ambiguous',
      match: null
    };
  }

  return {
    status: 'refound',
    match: candidateMatches[0]
  };
}