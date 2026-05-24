# Quickstart: Scenario Monitoring

## Goal

Implement a scenario-first monitoring layer for Inlinr that translates the operational journeys in `monitoring/monitoring-scenarios.md` into a shared scenario registry, a privacy-safe extension-host telemetry adapter, and an Azure Application Insights-compatible sink and alerting model without changing the product's editing behavior.

## Local setup

1. Run `npm install` from the repository root if dependencies are not already present.
2. Run `npm run compile`.
3. If Azure ingestion needs to be verified locally, set `APPLICATIONINSIGHTS_CONNECTION_STRING` in the shell before launching the extension host.
4. Optionally set `INLINR_TELEMETRY_CLOUD_ROLE_NAME` when the default extension identifier is not the desired Azure cloud role.
5. Optionally set `OTEL_TRACES_SAMPLER` or `OTEL_TRACES_SAMPLER_ARG` when validating a non-default sampling posture.
6. Treat invalid Azure configuration as telemetry-disabled for the session; editing should continue even if sink initialization cannot complete.
7. Open Run and Debug, choose `Run Inlinr Extension`, and press `F5` to launch the Extension Development Host.

## Implementation Outline

1. Add a new `src/telemetry/` boundary that owns scenario definitions, event types, sanitization, sink selection, and Azure mapping.
2. Mirror the monitored journeys in `monitoring/monitoring-scenarios.md` into a typed scenario registry with stable scenario IDs, criticality, checkpoints, and alert metadata.
3. Define a vendor-neutral telemetry contract for scenario attempts, checkpoints, terminal results, dependencies, and exceptions.
4. Add a sanitizer that drops or rewrites prohibited fields so document content, selected text, prompts, model output, file paths, and secrets never leave the extension boundary.
5. Keep custom telemetry properties on the allowlist only: `surface`, `scope_kind`, `provider_kind`, `reason_code`, and coarse size buckets.
6. Add a no-op sink and a recording sink first so telemetry can be validated without Azure.
7. Add an Azure/Application Insights sink behind the same interface and initialize it only when Azure configuration is available.
8. Map scenario and checkpoint signals to Application Insights-compatible `customEvents`, provider or future outbound calls to `dependencies`, and handled/unhandled failures to `exceptions`; keep `traces` for sampled diagnostics only.
9. Inject the telemetry adapter from `src/extension.ts` into the modules that already own monitored state transitions, starting with `MarkdownCustomEditorProvider` and nearby session-orchestration surfaces.
10. Instrument only scenario boundaries and checkpoint transitions already defined in the monitoring docs rather than every UI state change.
11. Ensure each scenario attempt emits at most one terminal `scenario_result` even when retries or repeated internal failures occur.
12. Classify unavailable capabilities or unsafe target drift as `blocked_safe`, explicit user rejection as `cancelled_user`, and actual execution or mutation defects as `failure`.
13. Define an alert mapping layer that distinguishes paging scenario outages from non-paging checkpoint, latency, and exception warnings.
14. Keep Azure-specific resource naming, action groups, and alert queries outside the core event contract so future backend changes remain possible.

## Manual Verification Flow

1. Launch the extension in the Extension Development Host.
2. Open a Markdown file and confirm the preview-load scenario can start and finish without user-visible regressions.
3. Exercise the current monitored journeys: open preview, select content, open the request popup, submit a request, receive review state, apply or reject, and start a second request cycle.
4. Confirm that the instrumentation path emits one scenario attempt and one terminal result for each journey under test.
5. Confirm that safe blocks and user-controlled cancels or rejects are distinguishable from failures.
6. Force an execution-unavailable or validation-failure path and confirm the monitoring model emits the expected failure class without exposing document content.
7. Confirm that the recorded custom properties remain on the allowlist and that session identifiers are pseudonymous.
8. If Azure configuration is present, verify that scenario and checkpoint events appear in Application Insights with stable event names and low-cardinality properties.
9. Verify that provider or external dependency calls appear as dependency telemetry rather than only as traces.
10. Verify that alerts are driven by scenario outcomes or synthetic checks rather than by raw trace volume.
11. Review captured telemetry fields and confirm that no raw Markdown, request text, rendered HTML, file paths, or model output is present.

## Test Targets

- Unit tests for scenario-registry validation, event-shape validation, one-terminal-result enforcement, sanitization, sink selection, and failure-class mapping.
- Integration tests for provider-owned scenario sequencing across preview load, popup open, request execution, apply, reject, and failure recovery paths.
- Focused Azure sink tests or adapter tests that verify Application Insights category mapping without requiring live Azure ingestion on every run.
- Manual validation for live Azure ingestion, action-group routing, and stateful alert behavior when Azure configuration is available.

## Notes

- Keep telemetry emission in the extension host only.
- Prefer low-cardinality event names and controlled property values because that aligns with Application Insights grouping and alerting.
- Prefer environment-based Azure configuration over code literals.
- Treat missing Azure configuration as telemetry-disabled, not as a product outage.
- Treat invalid Azure configuration the same way: telemetry may degrade to inert behavior, but editing must keep working.
- Keep alert definitions scenario-outcome-first and use checkpoint, dependency, and exception signals mainly for diagnosis and routing.