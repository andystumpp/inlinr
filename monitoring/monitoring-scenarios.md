# Monitoring Scenarios

`product/user-scenarios.md` remains the product source of truth. This file is the operational source for the user-visible scenarios that should drive automated monitoring for Inlinr.

Use `monitoring/telemetry-guidelines.md` to map each scenario into telemetry, Application Insights usage, and alerting.

Each scenario stays crisp and monitoring-oriented: a real user journey, the key checkpoints that must keep working, and the specific kind of breakage the monitoring story should catch.

## Core scenarios

### Load a Markdown file into the Inlinr preview
**Criticality:** Core
**Journey:** A user opens a Markdown file in VS Code and sees it load directly into the Inlinr viewer as a rendered preview, without needing a separate preview command or manual setup step.
**Key checkpoints:**
1. Opening a `.md` file routes into the Inlinr viewer.
2. The document renders as Markdown rather than raw source.
3. The viewer shows the correct file content and stays usable for the next interaction.
**Monitoring intent:** Catch failures where Markdown files stop opening in the viewer, render incorrectly, or block the rest of the editing workflow.

### Show the inline request popup for a rendered selection
**Criticality:** Core
**Journey:** A user selects a specific range in rendered Markdown and immediately gets one anchored inline request popup for that exact selection inside the document surface.
**Key checkpoints:**
1. A non-empty rendered selection is recognized.
2. The popup appears near the selected text.
3. The popup opens for the intended scope rather than expanding or drifting.
**Monitoring intent:** Catch regressions where selection capture, popup display, or visible scope targeting stops feeling precise and immediate.

### Submit a request and receive inline review state
**Criticality:** Core
**Journey:** A user enters a request, submits it from the inline popup, and sees pending feedback followed by a reviewable suggested change rendered in the document flow at the targeted location within 2 seconds of submit.
**Key checkpoints:**
1. The request input accepts text and submits successfully.
2. The system shows a visible pending state while work is in progress.
3. A reviewable inline suggestion appears at the targeted document location within 2 seconds.
**Monitoring intent:** Catch failures where request submission stalls, suggestion generation exceeds the expected latency budget, the user never reaches review, or the returned suggestion is detached from the intended document context.

### Apply a suggested change into the document
**Criticality:** Core
**Journey:** A user reviews a suggested edit and explicitly applies it, causing the intended Markdown range to update while the rest of the document stays stable.
**Key checkpoints:**
1. Apply is available from the inline review state.
2. The targeted range mutates only after explicit apply.
3. The rendered document refreshes to the newly integrated content.
**Monitoring intent:** Catch regressions where apply stops working, mutates the wrong content, or leaves the editor in an inconsistent state.

### Reject a suggested change without side effects
**Criticality:** Core
**Journey:** A user reviews a suggestion and rejects it, returning to an unchanged document state without hidden mutations or confusing leftover review UI.
**Key checkpoints:**
1. Reject is available from the inline review state.
2. The document content remains unchanged after rejection.
3. The temporary review state is dismissed cleanly.
**Monitoring intent:** Catch regressions where reject leaves behind stale UI, partial edits, or a mutated document.

### Start another request cycle in the same session
**Criticality:** Important
**Journey:** After applying or rejecting one suggestion, a user can make another selection and continue editing in the same document session without reopening the file or resetting the workflow manually.
**Key checkpoints:**
1. The first request cycle ends cleanly after apply or reject.
2. A fresh selection can start a new popup flow.
3. The next request uses the current document state rather than stale prior review state.
**Monitoring intent:** Catch regressions where one completed request leaves the session stuck, stale, or unable to continue.

### Discover the first action through empty state guidance
**Criticality:** Important
**Journey:** A new user opens a Markdown file in Inlinr and sees subtle in-document guidance that teaches the core selection-based editing workflow, then dismisses or completes the guidance after their first qualifying interaction.
**Key checkpoints:**
1. The guidance appears for eligible first-time users when opening a Markdown file.
2. The guidance is visible but does not block document reading or selection.
3. The guidance is dismissed after the first qualifying selection or explicit dismissal.
**Monitoring intent:** Catch regressions where first-run guidance fails to appear, blocks the editing workflow, or persists incorrectly after dismissal.

### Switch presentation presets
**Criticality:** Important
**Journey:** A user switches between rendering presets to adjust the Markdown viewer for different reading contexts—dense specs, comfortable reading, or review focus—without changing the underlying document or losing editing affordances.
**Key checkpoints:**
1. The switch command invokes and shows the preset picker with available options.
2. The user selects a preset and the selection is accepted.
3. The viewer refreshes to apply the new preset while preserving document content and active session state.
**Monitoring intent:** Catch regressions where preset switching fails to invoke, shows incorrect options, or leaves the viewer in an inconsistent or broken state after switching.

## Recovery scenarios

### Keep the viewer stable when preview rendering fails
**Criticality:** Important
**Journey:** If a Markdown file cannot render correctly, the user stays in the Inlinr viewer and sees a clear failure state instead of being dropped into an unpredictable or broken editor flow.
**Key checkpoints:**
1. The viewer remains the active surface on render failure.
2. A visible failure state appears in the viewer.
3. The underlying document remains unchanged.
**Monitoring intent:** Catch failures where preview rendering breaks the editor flow or falls back unsafely.

### Keep the document unchanged when execution or targeting fails
**Criticality:** Important
**Journey:** If request execution fails, returns an unusable result, or can no longer resolve the intended target safely, the user sees a clear recovery path and the document remains unchanged.
**Key checkpoints:**
1. The failure state is visible to the user.
2. Review and apply are blocked when the target is unsafe.
3. The document content is preserved without hidden mutation.
**Monitoring intent:** Catch failures where unsafe execution results leak into review or mutate the wrong text.

**Classification guidance:** Treat missing or ambiguous target revalidation as `blocked_safe` rather than an outage-level `failure`. Reserve `failure` for true execution or mutation defects where the product attempted the operation and still could not complete it correctly.

