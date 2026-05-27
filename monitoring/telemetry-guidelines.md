# Scenario Telemetry and Alerting

`monitoring/monitoring-scenarios.md` is the operational source of truth for what must be monitored. This document defines how each monitoring scenario should map into telemetry, Azure Application Insights, and alerting.

The goal is to keep monitoring user-visible and scenario-first. Agents should instrument scenario boundaries and safety gates, not every internal state change or UI repaint.

## Monitoring model

Treat every monitored journey as a three-layer model:

| Layer | Purpose | Default telemetry shape |
|---|---|---|
| Scenario | Measure whether a user-visible journey succeeded, failed, or was blocked safely. | One `scenario_result` event per attempt, with duration and outcome. |
| Checkpoint | Show where a scenario failed or degraded. | One `scenario_checkpoint` event for each key checkpoint that passes, fails, or blocks. |
| Diagnostic operation | Explain why a checkpoint failed without leaking document content. | Dependency, exception, or sampled trace telemetry attached to the same correlation ID. |

This keeps alerts attached to user journeys while still allowing root-cause analysis.

## Recommended architecture

Use a small extension-host telemetry adapter as the only component allowed to emit external telemetry.

- The webview may report local UI transitions to the extension host, but it should not talk to Application Insights directly.
- The extension host should sanitize all properties before emission.
- Azure Application Insights should be the default telemetry sink.
- Scenario definitions should stay vendor-neutral so the same contract could feed another backend later if needed.

## What to log

Log telemetry only at boundary transitions that matter to the user, to safety, or to diagnosis.

Always log:

- Scenario completion for every monitored journey attempt.
- Checkpoint pass or fail for each checkpoint listed in `monitoring/monitoring-scenarios.md`.
- Safety blocks where the product correctly refuses to proceed, such as unsafe target resolution.
- Provider dependency calls for request execution flows.
- Unexpected exceptions and handled failures that change the user-visible outcome.

Do not log:

- Raw Markdown content, selections, prompts, model responses, file paths, or secrets.
- High-cardinality UI noise such as every selection move, hover, or repaint.
- User rejection of a suggestion as an error. Reject is a successful completion of its own scenario.
- Duplicate success events for the same scenario attempt.

## Event contract

Use a stable event taxonomy so agents can add instrumentation consistently.

### Event types

| Event type | When to emit | Required fields |
|---|---|---|
| `scenario_attempt` | Optional. Emit when the scenario meaningfully starts and duration tracking needs an explicit start point. | `scenario_id`, `attempt_id`, `scenario_version`, `criticality` |
| `scenario_checkpoint` | Emit when a listed checkpoint passes, fails, or is blocked. | `scenario_id`, `attempt_id`, `checkpoint_id`, `status`, `component` |
| `scenario_result` | Emit exactly once when the scenario ends. | `scenario_id`, `attempt_id`, `status`, `duration_ms`, `criticality` |
| `dependency` | Emit for provider or external service calls. | `operation_name`, `attempt_id`, `status`, `duration_ms` |
| `exception` | Emit for unexpected failures or handled failures worth triage. | `operation_name`, `attempt_id`, `error_class`, `handled` |

### Required common fields

Every scenario event should include these sanitized fields:

| Field | Guidance |
|---|---|
| `scenario_id` | Stable slug derived from the scenario title, such as `submit_request_receive_review`. |
| `scenario_version` | Increment only when the monitored behavior meaningfully changes. |
| `attempt_id` | One correlation ID per scenario attempt. Reuse across checkpoints and related diagnostics. |
| `session_id` | Pseudonymous session correlation ID, never a user identity. |
| `criticality` | `core` or `important`, matching `monitoring/monitoring-scenarios.md`. |
| `status` | `success`, `failure`, `blocked_safe`, `cancelled_user`, or `degraded`. |
| `component` | Owning boundary such as `viewer`, `selection`, `request_execution`, `apply`, or `provider`. |
| `duration_ms` | Required on result events and latency-sensitive checkpoints. |
| `failure_class` | Required on failures, using a controlled taxonomy. |

### Failure taxonomy

Prefer controlled failure classes over ad hoc strings. Start with:

- `render_failure`
- `selection_resolution_failure`
- `popup_display_failure`
- `provider_unavailable`
- `provider_timeout`
- `suggestion_validation_failure`
- `anchor_revalidation_failure`
- `apply_failure`
- `state_cleanup_failure`
- `unexpected_exception`

Add new values intentionally and document them when new failure modes become alert-worthy.

## Application Insights guidance

Use Application Insights as the storage, query, and alerting backend, but keep the semantic contract above independent from Azure-specific naming.

Recommended usage:

- `customEvents`: `scenario_attempt`, `scenario_checkpoint`, and `scenario_result`.
- `dependencies`: model/provider invocations and any future external service calls.
- `exceptions`: unexpected failures and handled failures that should enter triage.
- `traces`: sampled debug detail only when needed for diagnosis; never as the primary source for scenario health.
- `customMeasurements`: attach durations, counts, and safe size buckets to events instead of logging raw content.

Recommended safe dimensions:

- `selection_length_bucket`: `short`, `medium`, `long`, `chapter_scale`
- `document_length_bucket`: `small`, `medium`, `large`
- `surface`: `custom_editor`
- `provider_kind`: coarse provider category rather than model prompt data

## Alerting model

Do not alert directly on every exception or every failed checkpoint. Alert first on scenario outcomes, then use checkpoint and diagnostic signals for triage.

Alert resources themselves should be managed through repo-owned declarative infrastructure and deployed by workflows rather than maintained manually in the Azure portal. See `architecture/adr-005-repo-owned-monitoring-alert-management.md` for the control model.

The concrete machine-readable alert intent layer lives in `monitoring/scenario-contract.yaml`. That contract captures the intended alert posture per monitored business scenario, while this document remains the technical guidance layer.

### Alert levels by signal type

| Signal | Core scenario default | Important scenario default |
|---|---|---|
| Synthetic end-to-end failure | Page when consecutive failures show the scenario is unavailable. | Ticket or non-paging alert unless the scenario is fully unavailable. |
| Real-user scenario failure rate | Page when the rolling failure rate breaches the agreed error budget with enough traffic. | Non-paging alert by default. |
| Latency degradation | Non-paging alert unless the delay effectively makes the scenario unusable. | Dashboard or non-paging alert. |
| Checkpoint failure spike | Non-paging alert for early warning and routing. | Dashboard or backlog signal. |
| Exception spike | Non-paging alert unless tied to a core scenario outage. | Dashboard or backlog signal. |

### Recommended default thresholds

Start simple and tune later:

- Synthetic availability: alert after 2 to 3 consecutive failures for `core` scenarios.
- Real-user failure rate: alert only when both a minimum volume threshold and a rolling-window error budget breach are met.
- Latency: alert on sustained $p95$ or $p99$ degradation, not single slow requests.
- Exception alerts: require both a spike and scenario impact before paging.

### Alert routing

- Page only on user-visible unavailability or unsafe behavior in `core` scenarios.
- Route degradation and component-health alerts to a team channel or backlog queue.
- Attach scenario ID, checkpoint ID, failure class, and a dashboard link to every alert.

## Scenario mapping template

When adding a new monitoring scenario, create or update a mapping using this shape:

| Field | Description |
|---|---|
| `scenario_id` | Stable slug |
| `criticality` | `core` or `important` |
| `start_condition` | The first user-visible action that begins the scenario |
| `checkpoints` | Ordered list copied from `monitoring/monitoring-scenarios.md` |
| `success_condition` | The user-visible outcome that counts as success |
| `safe_block_condition` | When the product should refuse to continue and preserve integrity |
| `primary_alert` | Synthetic, real-user failure rate, latency, or non-paging diagnostic |
| `supporting_signals` | Checkpoints, dependencies, and failure classes used for triage |

## Current scenario guidance

Use the following default mapping for the current monitoring scenarios.

| Scenario | Primary result signal | Key checkpoint signals | Default alert focus |
|---|---|---|---|
| Load a Markdown file into the Inlinr preview | `scenario_result` for `load_markdown_preview` | route to viewer, render success, viewer usable | Synthetic availability plus real-user failure rate |
| Show the inline request popup for a rendered selection | `scenario_result` for `show_inline_request_popup` | selection recognized, popup shown, scope accurate | Synthetic availability; checkpoint spike for targeting drift |
| Submit a request and receive inline review state | `scenario_result` for `submit_request_receive_review` | request submitted, pending shown, review rendered inline | Synthetic plus latency and failure-rate alerts |
| Apply a suggested change into the document | `scenario_result` for `apply_suggested_change` | apply available, safe revalidation, document refresh success | Synthetic plus real-user failure rate |
| Reject a suggested change without side effects | `scenario_result` for `reject_suggested_change` | reject available, document unchanged, review state cleared | Synthetic only at first; diagnostic alert on unexpected mutation |
| Start another request cycle in the same session | `scenario_result` for `start_next_request_cycle` | prior cycle cleared, new popup available, current state reused | Synthetic only at first |
| Keep the viewer stable when preview rendering fails | `scenario_result` for `stable_viewer_on_render_failure` | viewer still active, failure state visible, document unchanged | Synthetic plus checkpoint alert on unsafe fallback |
| Keep the document unchanged when execution or targeting fails | `scenario_result` for `preserve_document_on_execution_failure` | failure visible, review/apply blocked, document unchanged | Synthetic plus immediate alert on unsafe mutation |

## Rules for future agents

When an agent adds or changes a user scenario that should be monitored, it should do all of the following:

1. Add or update the scenario in `monitoring/monitoring-scenarios.md`.
2. Assign `core` or `important` criticality.
3. Define the scenario ID, checkpoints, success condition, and safe block condition.
4. Add telemetry only at scenario boundaries and checkpoint transitions.
5. Reuse the shared failure taxonomy where possible.
6. Add or update the corresponding repo-owned monitoring contract in `monitoring/scenario-contract.yaml`, the generated Azure alert resource, and the dashboard query rather than relying on a portal-only change.
7. Confirm that telemetry excludes document content and other sensitive material.

## Runtime extension pattern

Use the runtime boundary in `src/telemetry/` rather than ad hoc provider logic.

Default extension sequence:

1. Add or update the scenario definition in `src/telemetry/scenarioRegistry.ts`.
2. Reuse `assertValidMonitoringScenarioDefinitions()` and `getScenarioCheckpointDefinition()` when changing registry data or adding checkpoint-aware logic.
3. Reuse `createScenarioTelemetryContext()` when a new telemetry helper needs stable scenario metadata rather than reconstructing IDs inline.
4. Let `MarkdownCustomEditorProvider` or another extension-host boundary start attempts through `TelemetryAdapter`; do not emit raw sink events from webview code.
5. Keep Azure-specific configuration in `createTelemetrySinkSelection()` and derive the cloud role from the extension identity or `INLINR_TELEMETRY_CLOUD_ROLE_NAME`.
6. Keep Azure transport mapping inside `src/telemetry/applicationInsightsSink.ts`; new scenarios should reuse the existing event, dependency, and exception categories.

## Azure configuration guidance

The default Azure sink path should use:

- the bundled default Application Insights connection string for shipped extension builds.
- `APPLICATIONINSIGHTS_CONNECTION_STRING` to override that resource target for development, validation, or alternate deployment environments.
- `INLINR_TELEMETRY_CLOUD_ROLE_NAME` only when the default role derived from the extension identity needs to be overridden.
- `OTEL_TRACES_SAMPLER` or `OTEL_TRACES_SAMPLER_ARG` to signal non-default sampling posture.

Cloud role guidance:

- Default the cloud role to a stable extension identifier rather than a machine-specific value.
- Use the local machine or host identifier only for `ai.cloud.roleInstance`.
- Keep role names low cardinality so Azure grouping and alert routing remain useful.

## Privacy and alert-noise guardrails

- Only emit allowlisted custom properties such as `surface`, `scope_kind`, `provider_kind`, `reason_code`, and coarse size buckets.
- Only emit numeric measurements that are explicitly intended for aggregation, such as `duration_ms`, `selection_length`, `document_length`, or `retry_count`.
- Never emit raw selected text, draft text, rendered HTML, prompt content, document URIs, filesystem paths, or connection strings.
- Pseudonymize request or document correlation through hashed session identifiers before sink emission.
- Treat user rejection as `cancelled_user`, unavailable capabilities or unsafe target drift as `blocked_safe`, and true execution or mutation failures as `failure`.
- Invalid Azure configuration must never block editing flows; telemetry should fail open and degrade to an inert sink when initialization cannot complete safely.

## Design review checklist

Before shipping telemetry for a scenario, verify:

- The alert would fire for a user-visible outage, not just an internal exception.
- Safe blocks are distinguishable from unsafe failures.
- Reject and cancel behaviors are not mislabeled as product failures.
- One scenario attempt produces one terminal result event.
- Diagnostic telemetry is correlated to the scenario attempt without exposing document content.
- The scenario can be monitored both synthetically and from real-user telemetry when traffic exists.
