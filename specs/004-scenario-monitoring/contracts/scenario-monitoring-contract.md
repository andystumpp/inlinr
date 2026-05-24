# Contract: Scenario Monitoring And Azure Mapping

## Purpose

Define the stable contract for Inlinr's scenario registry, telemetry adapter, sanitization rules, and Azure Application Insights mapping so future agents can add monitored journeys without redefining the event taxonomy or weakening privacy boundaries.

## Scenario Registry Contract

The scenario registry is the extension-host source of truth for monitored journeys at runtime. It mirrors `monitoring/monitoring-scenarios.md` in a machine-readable shape.

```ts
type ScenarioCriticality = 'core' | 'important';

type ScenarioStatus =
  | 'success'
  | 'failure'
  | 'blocked_safe'
  | 'cancelled_user'
  | 'degraded';

type CheckpointStatus = 'pass' | 'failure' | 'blocked_safe' | 'degraded';

interface ScenarioCheckpointDefinition {
  checkpointId: string;
  order: number;
  description: string;
  component: 'viewer' | 'selection' | 'request_execution' | 'apply' | 'provider' | 'session';
  latencySensitive?: boolean;
}

interface MonitoringScenarioDefinition {
  scenarioId: string;
  scenarioVersion: string;
  title: string;
  criticality: ScenarioCriticality;
  startCondition: string;
  successCondition: string;
  safeBlockCondition: string;
  checkpoints: ScenarioCheckpointDefinition[];
  primaryAlert: 'synthetic_availability' | 'real_user_failure_rate' | 'latency' | 'non_paging_diagnostic';
  supportingSignals: Array<'checkpoint' | 'dependency' | 'exception' | 'latency'>;
}
```

Contract rules:

- Every monitored scenario must have a stable `scenarioId` and explicit `criticality`.
- Checkpoint IDs must be unique within a scenario.
- The runtime registry must reject duplicate scenario IDs and empty checkpoint lists.
- Registry definitions must remain low cardinality and must not include user content.

## Telemetry Event Contract

```ts
type TelemetryEventType =
  | 'scenario_attempt'
  | 'scenario_checkpoint'
  | 'scenario_result'
  | 'dependency'
  | 'exception';

interface TelemetryContext {
  operationId: string;
  parentId?: string;
  sessionId: string;
  scenarioId?: string;
  scenarioVersion?: string;
  criticality?: ScenarioCriticality;
}

interface ScenarioAttemptEvent {
  eventType: 'scenario_attempt';
  context: TelemetryContext;
  status?: 'started';
}

interface ScenarioCheckpointEvent {
  eventType: 'scenario_checkpoint';
  context: TelemetryContext;
  checkpointId: string;
  status: CheckpointStatus;
  component: ScenarioCheckpointDefinition['component'];
  failureClass?: string;
  reasonCode?: string;
  durationMs?: number;
}

interface ScenarioResultEvent {
  eventType: 'scenario_result';
  context: TelemetryContext;
  status: ScenarioStatus;
  durationMs: number;
  failureClass?: string;
  reasonCode?: string;
}

interface DependencyEvent {
  eventType: 'dependency';
  context: TelemetryContext;
  operationName: string;
  dependencyType: string;
  status: 'success' | 'failure';
  durationMs: number;
  resultCode?: string;
}

interface ExceptionEvent {
  eventType: 'exception';
  context: TelemetryContext;
  operationName: string;
  errorClass: string;
  handled: boolean;
  severity: 'warning' | 'error' | 'critical';
}
```

Contract rules:

- Each `operationId` may produce at most one terminal `scenario_result`.
- `scenario_result.durationMs` is required and must be numeric.
- `failureClass` must come from the controlled taxonomy when present.
- Event names and property values must remain low cardinality.
- Unknown event types or malformed event payloads must be rejected locally rather than silently forwarded.

## Sanitization Contract

The telemetry adapter must sanitize every outbound event before it reaches a sink.

Prohibited fields and values:

- Raw Markdown content
- Selected text
- Prompts or request text
- Model output or rendered replacement HTML
- File paths or full document URIs that expose workspace structure
- Secrets, tokens, connection strings, or provider credentials

Allowed property categories:

- Stable scenario and checkpoint identifiers
- Controlled status and failure-class values
- Coarse buckets such as `selection_length_bucket`, `document_length_bucket`, `provider_kind`, and `surface`
- Numeric durations and counts

Contract rules:

- The sanitizer must drop prohibited keys even if callers provide them.
- Measurements must remain numeric.
- Session correlation identifiers must be pseudonymous and must not encode the user's identity.

## Sink Contract

```ts
interface TelemetrySink {
  emit(event: ScenarioAttemptEvent | ScenarioCheckpointEvent | ScenarioResultEvent | DependencyEvent | ExceptionEvent): void | Promise<void>;
  flush?(): Promise<void>;
  dispose?(): Promise<void>;
}
```

Contract rules:

- A `noop` sink must always be available.
- A `recording` sink must be usable in tests without Azure dependencies.
- The Azure sink must never throw synchronously into the product flow.

## Azure Application Insights Mapping Contract

| Local contract | Application Insights category | Mapping guidance |
|---|---|---|
| `scenario_attempt` | `customEvents` | Use a small set of event names; store scenario ID, version, criticality, and correlation IDs as custom properties. |
| `scenario_checkpoint` | `customEvents` | Emit checkpoint ID, status, component, failure class, and optional duration as custom properties and measurements. |
| `scenario_result` | `customEvents` | Emit one terminal result per attempt with duration and outcome as the primary scenario health signal. |
| `dependency` | `dependencies` | Use low-cardinality dependency names and types; attach success, result code, duration, and correlation IDs. |
| `exception` | `exceptions` | Capture handled and unhandled failures that materially affect triage; avoid logging content-bearing exception details when they could expose user data. |
| Sampled diagnostics | `traces` | Use sparingly for debugging and never as the primary alert source. |

Azure-specific rules:

- Prefer environment-sourced `APPLICATIONINSIGHTS_CONNECTION_STRING` for Azure configuration.
- Set a stable cloud role name for the VS Code extension if multiple services share one Application Insights resource.
- Keep Azure-specific table names out of the local event contract; they belong only in the sink implementation and query documentation.
- Runtime configuration may additionally use `INLINR_TELEMETRY_CLOUD_ROLE_NAME` to override the default extension role name without changing the event taxonomy.
- Sampling posture should be treated as configuration, not schema; detect it from OpenTelemetry environment settings such as `OTEL_TRACES_SAMPLER` and `OTEL_TRACES_SAMPLER_ARG` rather than adding per-event fields.

## Alert Contract

```ts
type AlertSeverity = 'page' | 'non_paging' | 'diagnostic_only';
type AlertRuleKind = 'availability' | 'metric_alert' | 'log_search_alert' | 'simple_log_alert';

interface AlertPolicy {
  scenarioId: string;
  signalType: 'synthetic_availability' | 'real_user_failure_rate' | 'latency' | 'checkpoint_spike' | 'exception_spike';
  severity: AlertSeverity;
  ruleKind: AlertRuleKind;
  stateful: boolean;
  thresholdSummary: string;
}
```

Contract rules:

- Every `core` scenario must define a primary alert policy.
- Paging alerts must map to user-visible unavailability or unsafe behavior.
- Important scenarios may default to non-paging alert policies, but that choice must be explicit.
- Checkpoint and exception alerts are supporting signals unless they imply scenario outage or unsafe mutation.

## Extensibility Rules For Future Agents

When adding a new monitored journey, an agent must:

1. Add or update the scenario in `monitoring/monitoring-scenarios.md`.
2. Add a matching runtime registry definition with stable IDs and checkpoints.
3. Reuse the existing event types instead of inventing new core categories.
4. Reuse the failure taxonomy where possible and add new classes intentionally when necessary.
5. Add or update tests that validate sanitization, sequencing, and terminal-result behavior.
6. Add or update the Azure query and alert mapping for the scenario before treating it as operationally covered.
7. Reuse the existing Azure transport path in `src/telemetry/applicationInsightsSink.ts` so new scenarios stay on the same custom-event, dependency, and exception categories.