# Contract: Selection-Scoped Request Session

## Purpose

Define the stable interface boundaries for the first interactive selection and request-capture slice in the Inlinr Markdown surface.

## Extension-To-Webview State Contract

The extension host remains authoritative for source-backed session state, selection validity, and submit eligibility. The webview owns transient overlay UI, draft entry, and popup placement for the current rendered DOM.

### Selection-Capable Rendered State

```ts
interface SelectionCapableViewerState {
  kind: 'rendered';
  uri: string;
  title: string;
  documentVersion: number;
  previewOnly: true;
  html: string;
  selectionMode: 'enabled';
  activeRequestSession: ActiveRequestSessionViewState | null;
}

interface ActiveRequestSessionViewState {
  sessionId: string;
  selectedTextPreview: string;
  selectedRegionIds: string[];
  submitState: 'drafting' | 'invalid' | 'submitting' | 'submitted';
  validationMessage?: string;
}
```

### Contract Rules

- All state passed to the webview must be JSON-serializable.
- The webview must not treat rendered selection as canonical until the extension host accepts it.
- Overlay coordinates, textarea contents, and draft-button enablement are webview-owned transient state and are not required to be echoed back in every host state payload.
- Provider-specific response data is out of scope for this contract.
- Contract changes must be versioned intentionally alongside validator and test updates.

## Webview Capability Contract

- `enableScripts`: Enabled only for local selection capture, popup interaction, and extension message handling.
- `localResourceRoots`: Restricted to the minimal extension-controlled asset locations needed for the viewer and popup assets.
- CSP: `default-src 'none'` baseline with only the minimal sources re-enabled for styles, the bundled selection script, and approved local resources.
- Network access is not part of this contract.

## Webview-To-Extension Contract

The webview may send only validated message types defined below. The extension host must runtime-validate every incoming payload before acting on it.

```ts
type ViewerToExtensionMessage =
  | SelectionCaptureMessage
  | RequestSubmitMessage
  | RequestCancelMessage;

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

interface RequestSubmitMessage {
  type: 'request.submit';
  sessionId: string;
  draftText: string;
}

interface RequestCancelMessage {
  type: 'request.cancel';
  sessionId: string;
}
```

Contract rules:

- The webview must not open more than one request session at a time.
- The extension host must reject unknown message types and malformed payloads.
- `selection.capture` is a request for validation, not proof that the target is safe.
- `selectionRect` and similar UI hints must not be treated as canonical targeting data.
- `request.submit` carries the final draft text so the host does not need to receive every interim keystroke.
- `request.submit` must fail if anchor revalidation does not succeed.

## Extension Push Events

The extension host may send small, targeted session events to the webview instead of rebuilding the full document HTML for transient overlay changes.

```ts
type ExtensionToViewerMessage =
  | SelectionAcceptedMessage
  | SelectionRejectedMessage
  | RequestInvalidatedMessage
  | RequestSubmittedMessage;

interface SelectionAcceptedMessage {
  type: 'selection.accepted';
  sessionId: string;
  selectedTextPreview: string;
  selectedRegionIds: string[];
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

interface RequestSubmittedMessage {
  type: 'request.submitted';
  sessionId: string;
  message: string;
}
```

Contract rules:

- Push events update transient overlay state without forcing a full document rerender for each draft change.
- Full document rerender remains allowed for actual document-version changes or structural render changes.
- The webview must tolerate missing push events by falling back to the latest bootstrapped state after a document rerender.

## Local Request Payload Contract

The extension host creates the local request payload after explicit submit and before any downstream provider call.

```ts
interface SelectionScopedRequestPayload {
  requestId: string;
  documentUri: string;
  documentVersion: number;
  requestText: string;
  selectedMarkdown: string;
  selectionAnchor: SelectionAnchor;
  surroundingContext: {
    prefixMarkdown: string;
    suffixMarkdown: string;
  };
  createdAt: string;
}
```

Contract rules:

- The payload must be provider-agnostic.
- The payload must include only the selected text and the minimum adjacent context required for a later suggestion step.
- The payload must not include the full document or full enclosing section by default.
- Another extension's chat textbox or send action is not part of this contract.