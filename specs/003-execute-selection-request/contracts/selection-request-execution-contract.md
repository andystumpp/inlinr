# Contract: Selection Request Execution And Apply Flow

## Purpose

Define the stable interface boundaries for opening lightweight request entry for a contiguous document selection, executing a submitted inline request, validating one returned full-document draft, presenting one normalized in-document diff, and applying that suggestion safely to the targeted Markdown range.

## Extension-To-Webview State Contract

The extension host remains authoritative for source-backed selection, effective scoped mutation, execution status, validated drafts, normalized suggestions, and apply eligibility. The webview continues to own lightweight request-entry popup placement, focus, click-away dismissal, and transient interaction around the live rendered selection and inline diff review.

### Execution-Capable Rendered State

```ts
type ExecutionPhase =
  | 'drafting'
  | 'executing'
  | 'review'
  | 'failed'
  | 'unavailable'
  | 'applying'
  | 'applied'
  | 'invalid';

interface ExecutionCapableViewerState {
  kind: 'rendered';
  uri: string;
  title: string;
  documentVersion: number;
  previewOnly: true;
  html: string;
  selectionMode: 'enabled';
  activeRequest: ActiveExecutionSessionViewState | null;
}

interface ActiveExecutionSessionViewState {
  sessionId: string;
  selectedTextPreview: string;
  selectedRegionIds: string[];
  draftText: string;
  phase: ExecutionPhase;
  message?: string;
  suggestion?: SuggestedEditProposalViewState;
}

interface SuggestedEditProposalViewState {
  proposalId: string;
  previewMode: 'blended-inline';
  replacementMarkdown: string;
}
```

### Contract Rules

- All state passed to the webview must be JSON-serializable.
- `selectedTextPreview` may be carried for continuity or diagnostics, but the request-entry popup must not repeat that text back to the user.
- The webview must not treat proposal content as canonical until the extension host accepts the apply action and the document mutation succeeds.
- The review payload must remain scoped to exactly one anchored Markdown range, even when the selected range spans multiple blocks.
- The webview must render the returned suggestion as an in-document diff rather than as popup preview content after submit.
- Raw provider output, multi-candidate results, and patch-style operations are out of scope for this contract.
- Contract changes must be versioned intentionally alongside validator and test updates.

## Webview Capability Contract

- `enableScripts`: Enabled only for local selection capture, request entry, review interaction, and extension message handling.
- `localResourceRoots`: Restricted to the minimal extension-controlled asset locations needed for the viewer and review UI assets.
- CSP: `default-src 'none'` baseline with only the minimal sources re-enabled for styles, bundled viewer scripts, and approved local resources.
- Network access remains outside the webview contract.

## Webview-To-Extension Contract

The webview may send only validated message types defined below. The extension host must runtime-validate every incoming payload before acting on it.

```ts
type ViewerToExtensionMessage =
  | SelectionCaptureMessage
  | RequestDraftChangeMessage
  | RequestSubmitMessage
  | RequestCancelMessage
  | SuggestionApplyMessage
  | SuggestionRejectMessage;

interface SelectionCaptureMessage {
  type: 'selection.capture';
  documentVersion: number;
  selectedText: string;
  startMarker: string;
  endMarker: string;
  renderedRegionIds: string[];
  selectionRect?: {
    top: number;
    left: number;
    bottom: number;
    right: number;
  };
}

interface RequestDraftChangeMessage {
  type: 'request.draftChanged';
  sessionId: string;
  draftText: string;
}

interface RequestSubmitMessage {
  type: 'request.submit';
  sessionId: string;
  draftText: string;
}

interface RequestCancelMessage {
  type: 'request.cancel';
  sessionId: string;
}

interface SuggestionApplyMessage {
  type: 'suggestion.apply';
  sessionId: string;
  proposalId: string;
}

interface SuggestionRejectMessage {
  type: 'suggestion.reject';
  sessionId: string;
  proposalId: string;
}
```

Contract rules:

- `selection.capture` must be accepted for any non-empty contiguous visible selection that the host can map safely into one document-backed range, including list items, sections, and chapter-scale selections.
- `request.submit` may begin execution only from an accepted active request session with non-empty draft text.
- `request.cancel` may be sent when the lightweight popup is dismissed, including click-away dismissal without a dedicated cancel button.
- `suggestion.apply` must reference the current active proposal for the session.
- `suggestion.reject` must dismiss the current proposal without mutating the document.
- The extension host must reject unknown message types and malformed payloads.
- The webview must not assume availability of the supported capability before the extension host confirms execution.

## Extension Push Events

The extension host may send targeted session events to the webview instead of rebuilding full document HTML for execution and review state changes.

```ts
type ExtensionToViewerMessage =
  | SelectionAcceptedMessage
  | SelectionRejectedMessage
  | RequestInvalidatedMessage
  | RequestExecutingMessage
  | SuggestionReadyMessage
  | RequestFailedMessage
  | RequestUnavailableMessage
  | SuggestionAppliedMessage;

interface SelectionAcceptedMessage {
  type: 'selection.accepted';
  sessionId: string;
  selectedTextPreview: string;
  selectedRegionIds: string[];
  draftText: string;
  phase: 'drafting' | 'invalid';
  message?: string;
}

interface SelectionRejectedMessage {
  type: 'selection.rejected';
  message: string;
}

interface RequestInvalidatedMessage {
  type: 'request.invalidated';
  sessionId: string;
  message: string;
}

interface RequestExecutingMessage {
  type: 'request.executing';
  sessionId: string;
  message: string;
}

interface SuggestionReadyMessage {
  type: 'suggestion.ready';
  sessionId: string;
  proposal: SuggestedEditProposalViewState;
}

interface RequestFailedMessage {
  type: 'request.failed';
  sessionId: string;
  message: string;
}

interface RequestUnavailableMessage {
  type: 'request.unavailable';
  sessionId: string;
  message: string;
}

interface SuggestionAppliedMessage {
  type: 'suggestion.applied';
  sessionId: string;
  message: string;
}
```

Contract rules:

- Push events update review state without moving transient UI ownership out of the webview.
- Full document rerender remains allowed for actual document-version changes, structural render changes after apply, or in-document diff rendering for a validated proposal.
- The webview must treat `request.failed`, `request.unavailable`, and `request.invalidated` as mutation-blocking states.

## Execution Adapter Contract

The extension host translates the existing selection-scoped payload into the execution-adapter request, validates the returned draft, and normalizes the derived suggestion before any review or apply action.

```ts
interface ExecutionRequest {
  requestId: string;
  documentUri: string;
  documentVersion: number;
  requestText: string;
  selectedMarkdown: string;
  documentMarkdown: string;
  selectionMarkerId: string;
  markedDocumentMarkdown: string;
  selectionAnchor: SelectionAnchor;
}

interface ExecutionResult {
  requestId: string;
  draftDocumentMarkdown: string;
  completedAt: string;
  modelId?: string;
}

interface ValidatedExecutionDraft {
  requestId: string;
  documentUri: string;
  baseDocumentVersion: number;
  draftDocumentMarkdown: string;
  replacementMarkdown: string;
  selectionMarkerId: string;
  validatedAt: string;
}
```

Contract rules:

- The execution request must include the selected Markdown, the full current Markdown document content, and explicit selection markers that delimit the targeted range.
- The host may widen the effective scoped mutation to the containing list item when the requested change is removing one list entry and that widening is required to preserve valid list structure.
- The execution result must return one full-document Markdown draft that preserves the selection markers.
- The extension host must validate the returned draft and reject it if markers are missing, duplicated, or cannot be mapped back safely to the targeted range.
- Out-of-range differences elsewhere in the returned draft must be ignored because only the content between the preserved selection markers is authoritative for review and apply.
- The adapter must not expose raw provider-specific result shapes directly to the review or apply flow.
- Capability unavailability must be surfaced as a typed unavailable outcome, not hidden behind generic fallback behavior.

## Normalized Suggestion Contract

```ts
interface NormalizedSuggestedEdit {
  proposalId: string;
  requestId: string;
  documentUri: string;
  baseDocumentVersion: number;
  selectionAnchor: SelectionAnchor;
  validatedDraft: ValidatedExecutionDraft;
  replacementMarkdown: string;
  previewMode: 'blended-inline';
  createdAt: string;
}
```

Contract rules:

- `replacementMarkdown` may be empty to represent deleting the targeted range.
- The normalized suggestion must represent exactly one replacement or deletion for exactly one anchored Markdown range.
- The normalized suggestion may target a host-resolved effective scope that is wider than the user's visible text selection when full list-item removal is required.
- Differences elsewhere in the returned full-document draft must not be surfaced as document changes because only the extracted selected-range proposal is authoritative.

## Apply Contract

```ts
interface ApplySuggestedEditCommand {
  proposalId: string;
  sessionId: string;
  documentUri: string;
}

interface ApplySuggestedEditResult {
  proposalId: string;
  appliedDocumentVersion: number;
  sourceStart: number;
  sourceEnd: number;
  appliedAt: string;
}
```

Contract rules:

- The apply service must revalidate the anchor against the current document before mutation.
- Apply must mutate only the revalidated effective target range.
- Apply may widen from the visible text selection to the containing list item only when that wider effective scope was resolved intentionally and is required to preserve valid list structure.
- The document must remain unchanged when the anchor becomes ambiguous, the validated draft cannot be mapped safely back to the target range, or the user rejects the suggestion.
- Automatic provider fallback or automatic document mutation is out of scope for this contract.
