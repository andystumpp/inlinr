# Quickstart: Selection-Scoped Edit Request

## Goal

Add the first interactive Inlinr editing flow so a user can select rendered Markdown, get one anchored inline request popup, draft a request, and submit a validated local request payload without leaving the document surface.

## Local setup

1. Run `npm install` from the repository root if dependencies are not already present.
2. Run `npm run compile`.
3. Open Run and Debug, choose `Run Inlinr Extension`, and press `F5` to launch the Extension Development Host.

## Implementation Outline

1. Enable the minimum webview scripting needed to observe rendered selection and popup interactions.
2. Extend the Markdown render pipeline to emit source-backed metadata for supported prose regions.
3. Define the webview-to-extension message contract for selection capture, cancel, and submit.
4. Add extension-host validation that accepts only supported contiguous selections and enforces one active draft at a time.
5. Introduce a hybrid selection anchor and revalidation path that can fail closed when the intended range becomes ambiguous.
6. Build the anchored request popup state and keep the primary request flow inside the Inlinr surface.
7. Create a provider-agnostic local request payload on explicit submit.
8. Hand the payload to a thin Inlinr-owned request service boundary without implementing suggestion response UX in this slice.
9. Keep privacy and security defaults intact: no provider traffic while the popup is only open, and no full-document payload by default.

## Manual Verification Flow

1. Launch the extension using the Extension Development Host workflow.
2. Open a Markdown file from Explorer and confirm the Inlinr viewer opens in the current editor tab.
3. Select a short rendered prose span and confirm one anchored popup appears near the selection with placeholder text `Ask for changes` and a submit button.
4. Select a larger contiguous rendered prose range across adjacent prose blocks and confirm the popup still targets one selection.
5. Try selecting across a heading boundary, code fence, image, or unsupported region and confirm the product blocks the request and asks for a supported re-selection.
6. Open one draft, then try to start another on a different selection and confirm the first draft must be canceled or finished before a new one opens.
7. Change the document after opening a draft, then submit and confirm the system either revalidates the target or blocks submit with a clear reselect path.
8. Submit a valid request and confirm the product creates the local request payload without routing through another extension's chat textbox.
9. Confirm no full-document payload is created by default and no external request occurs before explicit submit.

## Test Targets

- Unit tests for supported-selection rules, hybrid anchor creation, anchor revalidation, and request payload construction.
- Integration tests for custom-editor message handling, single-draft gating, blocked unsupported selections, submit-time revalidation, and request-service handoff.
- Manual verification for real rendered selection behavior, popup placement, theme compatibility, and keyboard or focus behavior inside the webview.

## Notes

- Keep the authoritative selection and submit decision in the extension host, not in raw webview state.
- Treat unsupported rendered structures as explicit non-goals for v1 rather than guessing.
- Do not add suggestion diff review, edit application, or provider-specific result UI in this slice.