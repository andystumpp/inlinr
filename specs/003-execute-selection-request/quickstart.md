# Quickstart: Execute Selection Request

## Goal

Extend Inlinr's inline request flow so any non-empty contiguous document selection opens a lightweight request popup, a submitted selection-scoped request executes through the supported Copilot-backed VS Code model boundary, returns one full-document draft for the targeted range, validates that draft against the selected range, renders the proposed diff directly in the document, and applies that suggestion only after explicit user approval and anchor revalidation.

## Local setup

1. Run `npm install` from the repository root if dependencies are not already present.
2. Run `npm run compile`.
3. Open Run and Debug, choose `Run Inlinr Extension`, and press `F5` to launch the Extension Development Host.

## Implementation Outline

1. Broaden selection capture so any non-empty contiguous visible selection can open the request popup, including multi-item lists, single list items, sections, and chapter-scale selections.
2. Keep the request popup lightweight: request-entry only, no repeated selected-text preview, and dismissible by clicking elsewhere in the document.
3. Extend the request service boundary or add an execution service so the extension host can invoke the supported VS Code Language Model API path using a full-document, markerized selection payload.
4. Add capability preflight and runtime error mapping so unavailable access fails closed with a clear inline message and no automatic fallback.
5. Request one full-document Markdown draft that preserves explicit selection markers around the targeted range.
6. Validate that the returned draft is non-empty at the document level, still contains the markers exactly once, and can be mapped safely back to the targeted range before it enters review.
7. Normalize the validated draft into one bounded replacement or deletion proposal for the targeted Markdown range, ignoring unrelated out-of-range draft changes and preserving enough scope metadata to remove a full containing list item when needed.
8. Extend the active request session, viewer state, and viewer protocol so the webview can show request entry, executing, review, failed, unavailable, applying, and applied states without moving transient UI ownership out of the webview.
9. Render the validated proposal as an inline diff directly in the document surface rather than keeping preview content in the popup.
10. Add explicit Apply and Reject actions for the returned suggestion.
11. Introduce an edit-application service that revalidates the durable anchor against the latest document text and mutates only the intended effective scope, including full list-item removal when required to preserve valid list structure.
12. Refresh the custom editor after apply so the rendered Markdown view reflects the accepted change.
13. Keep privacy and trust defaults intact: no auto-apply, no automatic provider fallback, and no direct whole-document apply even though full document Markdown is sent and returned for execution context.

## Manual Verification Flow

1. Launch the extension in the Extension Development Host.
2. Open a Markdown file and confirm the Inlinr viewer opens in the editor tab.
3. Select contiguous content in multiple shapes: two bullet items, one numbered-list item, one section, and multiple chapters, and confirm the request popup opens for each non-empty contiguous selection.
4. Confirm the popup shows only a request input field and an "Ask for changes" action and does not repeat the selected text.
5. Click elsewhere in the document without submitting and confirm the popup dismisses cleanly.
6. Reopen the popup, enter a request, and submit.
7. Confirm the viewer shows pending execution feedback within 1 second and keeps the targeted scope visible.
8. If the supported capability is unavailable in the test environment, confirm the viewer shows a clear unavailable message, does not fall back automatically, and still allows the user to retry after capability access is restored.
9. If execution succeeds, confirm the viewer renders the proposed diff directly in the document for the selected scope rather than previewing it in the popup, and confirm that only the intended scope is reviewable even if the model draft contained unrelated out-of-range changes.
10. Reject the suggestion and confirm the document remains unchanged while the inline workflow stays in the document surface.
11. Submit again, then Apply the suggestion and confirm only the intended Markdown range changes.
12. Try removing one item from a bullet or numbered list by selecting only its text content, then confirm Apply removes the full containing list item and preserves valid surrounding list structure.
13. Reopen the same scenario after editing the document between execution and apply, then confirm the product invalidates the pending suggestion, blocks apply, and asks the user to reselect before continuing.
14. Try an output that removes or duplicates the selection markers and confirm the system blocks review/apply and returns the request to a clear recovery state.
15. Try a transformation that restructures or deletes content inside the selected range, such as summarizing two bullets into one paragraph, removing a paragraph entirely, or giving feedback on multiple selected chapters, and confirm the system allows review/apply while preserving the surrounding document because only the intended effective scope is mutated.

## Test Targets

- Unit tests for capability detection, execution error mapping, marker preservation, deletion proposals, effective-scope resolution for list-item removal, ignored out-of-range draft changes, suggestion normalization, and apply-time anchor revalidation.
- Integration tests for popup-opening across list and chapter selections, input-only popup behavior, unavailable capability, successful document-inline diff review state, reject behavior, apply success, deletion proposals, ignored out-of-range draft changes, consecutive request cycles, and blocked apply on drift.
- DOM-driven regression coverage for the real webview interaction path from selection to popup entry to document-inline diff review.
- Manual verification for live supported capability access, lightweight popup UX, document-inline diff review UX, list-item removal behavior, chapter-scale selection behavior, and end-to-end apply behavior in the Extension Development Host.

## Notes

- Keep source-backed validation, execution orchestration, normalization, and document mutation in the extension host.
- Keep popup placement, lightweight request-entry interactions, document-inline diff presentation, and transient review interactions in the webview.
- Do not add automatic apply, fallback routing, persisted request history, or cross-file edits in this slice.
- Use deterministic fake execution adapters for most automated tests and reserve live capability checks for explicit manual or opt-in smoke validation.