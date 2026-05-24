# Data Model: Scenario Monitoring

## MonitoringScenarioDefinition

- Purpose: Represents one operationally monitored Inlinr journey derived from `monitoring/monitoring-scenarios.md`.
- Source: Defined in the shared scenario registry and mirrored from the source-of-truth monitoring scenarios.
- Fields:
  - `scenarioId`: Stable slug such as `submit_request_receive_review`.
  - `scenarioVersion`: Monotonic version string for meaningfully changed monitoring semantics.
  - `title`: Human-readable scenario name.
  - `criticality`: `core | important`.
  - `startCondition`: User-visible condition that begins the scenario attempt.
  - `successCondition`: User-visible condition that completes the scenario successfully.
  - `safeBlockCondition`: Condition under which the system should refuse to continue while preserving integrity.
  - `checkpoints`: Ordered list of `ScenarioCheckpointDefinition` records.
  - `primaryAlert`: Default alert posture for the scenario.
  - `supportingSignals`: Supporting signal categories used for triage.
- Validation rules:
  - `scenarioId` must be stable, low cardinality, and unique.
  - `criticality` must be explicitly assigned.
  - At least one checkpoint must exist.
  - `successCondition` and `safeBlockCondition` must be explicit and non-overlapping.

## ScenarioCheckpointDefinition

- Purpose: Defines one meaningful progress or safety checkpoint inside a monitored scenario.
- Source: Derived from the checkpoint list in `monitoring/monitoring-scenarios.md` and maintained in the shared registry.
- Fields:
  - `checkpointId`: Stable slug unique within the scenario.
  - `order`: Zero-based or one-based order within the scenario.
  - `description`: Human-readable checkpoint description.
  - `component`: Owning boundary such as `viewer`, `selection`, `request_execution`, `apply`, or `provider`.
  - `latencySensitive`: Boolean indicating whether duration matters operationally.
  - `allowedStatuses`: `pass | failure | blocked_safe | degraded` combinations for this checkpoint.
- Validation rules:
  - `checkpointId` must be unique within a scenario.
  - `order` must be strictly increasing within the checkpoint list.
  - `component` must come from a controlled taxonomy.

## ScenarioAttempt

- Purpose: Represents one observed run of a monitoring scenario from its start condition to exactly one terminal outcome.
- Source: Created by the extension-host telemetry adapter when a monitored journey begins.
- Fields:
  - `attemptId`: Unique identifier for the attempt.
  - `scenarioId`: Identifier of the monitored scenario.
  - `scenarioVersion`: Version of the scenario definition.
  - `sessionId`: Pseudonymous user-session correlation identifier.
  - `startedAt`: Timestamp when the attempt began.
  - `endedAt`: Optional timestamp when the attempt reached a terminal result.
  - `status`: `started | in_progress | success | failure | blocked_safe | cancelled_user | degraded`.
  - `failureClass`: Optional controlled failure class when the terminal result or major checkpoint failed.
  - `documentLengthBucket`: Optional coarse size bucket.
  - `selectionLengthBucket`: Optional coarse size bucket for selection-scoped flows.
  - `providerKind`: Optional coarse provider category.
- Validation rules:
  - There must be at most one terminal result per `attemptId`.
  - `sessionId` must not encode user identity.
  - Buckets must be coarse and low cardinality.

## ScenarioCheckpointRecord

- Purpose: Captures the observed result of one checkpoint within a scenario attempt.
- Source: Emitted by the telemetry adapter at meaningful progress, degradation, failure, or safe-block boundaries.
- Fields:
  - `attemptId`: Parent scenario-attempt identifier.
  - `scenarioId`: Parent scenario identifier.
  - `checkpointId`: Identifier of the checkpoint definition.
  - `status`: `pass | failure | blocked_safe | degraded`.
  - `component`: Owning boundary.
  - `recordedAt`: Timestamp when the checkpoint result was emitted.
  - `durationMs`: Optional elapsed time since attempt start or checkpoint start.
  - `failureClass`: Optional controlled failure classification.
  - `reasonCode`: Optional low-cardinality internal reason.
- Validation rules:
  - `checkpointId` must exist in the corresponding scenario definition.
  - `failureClass` is required for `failure` and recommended for `degraded` or `blocked_safe` when relevant.
  - `durationMs` must be numeric and non-negative.

## TelemetryEnvelope

- Purpose: Represents the normalized telemetry item the extension host sends to a sink.
- Source: Created by the telemetry adapter after applying sanitization and correlation rules.
- Fields:
  - `eventType`: `scenario_attempt | scenario_checkpoint | scenario_result | dependency | exception`.
  - `name`: Stable logical event name.
  - `operationId`: Correlation identifier for Azure/Application Insights grouping.
  - `parentId`: Optional parent correlation identifier.
  - `timestamp`: Emission timestamp.
  - `properties`: Low-cardinality custom properties.
  - `measurements`: Numeric custom measurements such as durations.
- Validation rules:
  - `name` must come from a controlled event taxonomy.
  - `properties` must pass sanitization and field-allowlist checks.
  - `measurements` must contain only numeric values.

## FailureClass

- Purpose: Groups similar failure causes for scenario triage and alert routing.
- Source: Controlled taxonomy defined by the monitoring contract and guidance.
- Fields:
  - `code`: Stable slug such as `render_failure` or `provider_unavailable`.
  - `severityHint`: `diagnostic | non_paging | page` default hint.
  - `description`: Human-readable meaning.
  - `appliesTo`: List of scenarios or components for which the class is valid.
- Validation rules:
  - `code` must be unique and stable.
  - New classes must be added intentionally rather than emitted ad hoc.

## AlertPolicy

- Purpose: Defines the default operational response for a scenario or supporting signal.
- Source: Derived from the scenario registry and Azure alerting guidance.
- Fields:
  - `policyId`: Unique identifier.
  - `scenarioId`: Related scenario identifier.
  - `signalType`: `synthetic_availability | real_user_failure_rate | latency | checkpoint_spike | exception_spike`.
  - `severity`: `page | non_paging | diagnostic_only`.
  - `ruleKind`: `availability | metric_alert | log_search_alert | simple_log_alert`.
  - `statefulness`: `stateful | stateless`.
  - `evaluationWindow`: Rolling time window definition.
  - `thresholdRule`: Human-readable or structured threshold definition.
  - `actionGroupClass`: Intended action route such as pager, team channel, or backlog.
- Validation rules:
  - Every `core` scenario must have at least one primary alert policy.
  - Important scenarios must still have an explicit alert decision.
  - `page` severity must be justified by user-visible outage or unsafe behavior.

## TelemetrySinkConfiguration

- Purpose: Controls whether telemetry is emitted locally only, recorded for tests, or exported to Azure.
- Source: Extension activation and environment configuration.
- Fields:
  - `mode`: `noop | recording | azure_monitor`.
  - `connectionStringPresent`: Boolean indicating whether Azure configuration is available.
  - `cloudRoleName`: Optional Azure role name for the extension.
  - `samplingEnabled`: Boolean indicating whether sink-level sampling is enabled.
  - `enabledAt`: Timestamp when the sink was initialized.
- Validation rules:
  - `azure_monitor` mode requires Azure configuration to be present.
  - Missing or invalid Azure configuration must downgrade to `noop` or `recording`, not break editing behavior.

## Relationships

- One `MonitoringScenarioDefinition` contains one or more `ScenarioCheckpointDefinition` records.
- One `ScenarioAttempt` belongs to exactly one `MonitoringScenarioDefinition`.
- One `ScenarioAttempt` may produce many `ScenarioCheckpointRecord` records but only one terminal `scenario_result`.
- One `ScenarioCheckpointRecord` maps to exactly one `ScenarioAttempt` and one `ScenarioCheckpointDefinition`.
- One `TelemetryEnvelope` wraps one normalized signal emitted by the adapter.
- One `AlertPolicy` references one primary scenario and one signal type.
- One `TelemetrySinkConfiguration` governs how `TelemetryEnvelope` records are exported.

## State Transitions

### ScenarioAttempt

- `started -> in_progress`: The first checkpoint or dependency signal is emitted after attempt creation.
- `started -> success`: The scenario completes without intermediate checkpoints or after implicit success.
- `in_progress -> success`: All required checkpoints pass and the success condition is met.
- `in_progress -> degraded`: The scenario completes but breaches a latency or quality threshold without becoming unavailable.
- `in_progress -> blocked_safe`: The product refuses to continue in order to preserve correctness or trust.
- `in_progress -> cancelled_user`: The user intentionally cancels or rejects the flow and no hidden mutation occurs.
- `in_progress -> failure`: The scenario fails in a user-visible way or violates a safety boundary.

### AlertPolicy

- `draft -> active`: The policy is defined, reviewed, and enabled in Azure Monitor or the local operational model.
- `active -> tuned`: Thresholds or routing are adjusted based on observed behavior without changing the policy's purpose.
- `active -> retired`: The underlying scenario or signal is intentionally removed from monitoring scope.