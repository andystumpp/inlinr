# Research: Execute Selection Request

## Decision 1: Execute through a host-owned service that uses the VS Code Language Model API as the only v1 downstream boundary

- Decision: Keep request execution inside the extension host behind a dedicated execution service, with one adapter that uses the VS Code Language Model API as the supported Copilot-backed boundary for v1.
- Rationale: ADR 002 already establishes Inlinr-owned model invocation and names the VS Code Language Model API as the default supported boundary. Keeping execution in the extension host preserves minimal-context enforcement, avoids unsupported chat UI automation, and gives one place to own timeout, error mapping, and result normalization.
- Alternatives considered: Webview-to-provider calls were rejected because they would move privacy-sensitive payload construction out of the extension host. Copilot Chat UI automation was already rejected by ADR 002. A multi-provider router in v1 would add abstraction before a second backend is actually needed.

## Decision 2: Fail closed when capability is unavailable and do not fall back automatically

- Decision: Treat model availability as both a preflight and runtime gate. If the supported capability cannot be selected or executed, move the session into an unavailable state, keep the targeted scope visible, show a clear unavailable message, and do not fall back automatically.
- Rationale: The clarified spec explicitly requires blocked execution with no fallback when the supported capability is unavailable. This keeps trust boundaries predictable and avoids hidden routing or degraded execution paths that would expand product and privacy policy scope.
- Alternatives considered: Automatically switching to another provider or to a placeholder mode would introduce new provider-routing policy and weaken the product's single supported execution path. Queued retries or detached chat escape hatches would add workflow complexity not required for this slice.

## Decision 3: Extract one bounded proposal from a marker-preserving full-document draft and ignore unrelated out-of-range draft changes

- Decision: Accept only one v1 normalized suggestion shape: one bounded replacement or deletion extracted from the content between preserved selection markers in the returned full-document draft, accompanied by the anchor snapshot and metadata required for review and apply.
- Rationale: The full-document roundtrip still gives the model broad context, but only the marked selected range should be authoritative for mutation. Ignoring unrelated out-of-range draft changes lets useful requests like shorten or remove succeed without weakening the bounded-apply trust model.
- Alternatives considered: Continuing to reject any draft that differs outside the selection proved too strict for legitimate transformations. Applying the full returned document directly would still weaken the product's precision and trust model.

## Decision 4: Validate twice, once at selection-range extraction and again before apply

- Decision: Use a review-entry gate that accepts marker-preserving drafts only when the selected range can be extracted safely, then use a second apply-time gate that revalidates the anchor against the current document before mutation.
- Rationale: Model output mapping risk and document drift are separate risks. The first gate prevents malformed or unextractable output from reaching the user-facing review state while still permitting empty replacements and ignored out-of-range draft changes. The second gate prevents a stale or ambiguous anchor from mutating the wrong text after the user has reviewed the suggestion.
- Alternatives considered: Validating only on submit would let unsafe drafts survive until apply. Continuing to require byte-for-byte outside-range equality would keep blocking legitimate shorten and remove requests.

## Decision 5: Keep execution and review state host-authoritative while leaving blended review UI in the webview

- Decision: Extend the active request session model to track execution, validated draft, review, failure, unavailable, and apply states, while keeping overlay placement, focus, scroll behavior, and inline blended review presentation in the webview.
- Rationale: ADR 003 already draws the durable boundary between host-owned session truth and webview-owned transient UI. Execution outcomes, validated-draft safety, apply eligibility, and document mutation safety belong in host state; presentation and interaction responsiveness still belong in the webview.
- Alternatives considered: Reverting to host-rendered transient review UI would repeat the boundary problem solved in ADR 003. Putting execution-state authority in the webview would make mutation safety depend on non-canonical UI state.

## Decision 6: Apply the suggestion with a dedicated edit-application service scoped to the revalidated range

- Decision: Introduce a small edit-application service that resolves the current target range from the durable anchor and applies the normalized replacement text only if the anchor is still unambiguous and the validated draft remained contained to that range.
- Rationale: The current codebase has no dedicated mutation service yet, but the high-level architecture already names one. Creating a small service now isolates `TextDocument` mutation logic from provider execution logic and gives tests a clear seam for scoped-apply safety.
- Alternatives considered: Mutating the document directly inside the custom editor provider would couple orchestration and mutation too tightly. Applying the full returned document directly would violate the product's precision boundary.

## Decision 7: Use deterministic fake execution adapters in automated tests and keep real Copilot-backed verification opt-in

- Decision: Cover execution, normalization, unavailable handling, drift detection, and apply behavior with unit and integration tests that use a fake execution adapter, plus a targeted manual smoke path for real supported capability checks in the Extension Development Host.
- Rationale: The existing test harness is well suited to deterministic extension-host tests and contract validation. Live Copilot-backed tests are entitlement-dependent and too brittle to be the default regression path, while ADR 003 still requires at least one DOM-driven interaction path for the webview flow.
- Alternatives considered: CI tests against live model execution would be flaky and environment-sensitive. Manual-only verification would under-test the trust-sensitive normalization and apply boundary.

## Decision 8: No new ADR is required for this slice

- Decision: Keep the execution and apply policy in the feature planning artifacts and contracts rather than adding a new ADR for v1.
- Rationale: ADR 002 already established the provider boundary and ADR 003 already settled host-versus-webview ownership. This feature fills in deferred execution policy inside those existing decisions rather than creating a new durable architecture branch.
- Alternatives considered: A new ADR would become justified if the feature introduced fallback routing, multi-provider abstraction, persisted execution history, or background retry workflows. None of those are in scope for the current plan.