export const TELEMETRY_FAILURE_CLASSES = [
  'render_failure',
  'selection_resolution_failure',
  'popup_display_failure',
  'provider_unavailable',
  'provider_timeout',
  'suggestion_validation_failure',
  'anchor_revalidation_failure',
  'apply_failure',
  'state_cleanup_failure',
  'unexpected_exception'
] as const;

export type TelemetryFailureClass = (typeof TELEMETRY_FAILURE_CLASSES)[number];
export type ScenarioCriticality = 'core' | 'important';
export type ScenarioComponent = 'viewer' | 'selection' | 'request_execution' | 'apply' | 'provider' | 'session';
export type ScenarioStatus = 'success' | 'failure' | 'blocked_safe' | 'cancelled_user' | 'degraded';
export type CheckpointStatus = 'pass' | 'failure' | 'blocked_safe' | 'degraded';
export type TelemetrySinkMode = 'noop' | 'recording' | 'azure_monitor';
export type AlertSeverity = 'page' | 'non_paging' | 'diagnostic_only';
export type AlertRuleKind = 'availability' | 'metric_alert' | 'log_search_alert' | 'simple_log_alert';
export type AlertSignalType =
  | 'synthetic_availability'
  | 'real_user_failure_rate'
  | 'latency'
  | 'checkpoint_spike'
  | 'exception_spike';

export type TelemetryProperties = Record<string, string | number | boolean | undefined>;
export type TelemetryMeasurements = Record<string, number | undefined>;

export interface ScenarioCheckpointDefinition {
  checkpointId: string;
  order: number;
  description: string;
  component: ScenarioComponent;
  latencySensitive?: boolean;
}

export interface MonitoringScenarioDefinition {
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

export interface AlertPolicyDefinition {
  scenarioId: string;
  signalType: AlertSignalType;
  severity: AlertSeverity;
  ruleKind: AlertRuleKind;
  stateful: boolean;
  thresholdSummary: string;
}

export interface TelemetryContext {
  operationId: string;
  parentId?: string;
  sessionId: string;
  scenarioId?: string;
  scenarioVersion?: string;
  criticality?: ScenarioCriticality;
}

interface TelemetryBaseEvent {
  context: TelemetryContext;
  properties?: TelemetryProperties;
  measurements?: TelemetryMeasurements;
}

export interface ScenarioAttemptEvent extends TelemetryBaseEvent {
  eventType: 'scenario_attempt';
  status?: 'started';
}

export interface ScenarioCheckpointEvent extends TelemetryBaseEvent {
  eventType: 'scenario_checkpoint';
  checkpointId: string;
  status: CheckpointStatus;
  component: ScenarioComponent;
  failureClass?: TelemetryFailureClass;
  reasonCode?: string;
  durationMs?: number;
}

export interface ScenarioResultEvent extends TelemetryBaseEvent {
  eventType: 'scenario_result';
  status: ScenarioStatus;
  durationMs: number;
  failureClass?: TelemetryFailureClass;
  reasonCode?: string;
}

export interface DependencyEvent extends TelemetryBaseEvent {
  eventType: 'dependency';
  operationName: string;
  dependencyType: string;
  status: 'success' | 'failure';
  durationMs: number;
  resultCode?: string;
}

export interface ExceptionEvent extends TelemetryBaseEvent {
  eventType: 'exception';
  operationName: string;
  errorClass: string;
  handled: boolean;
  severity: 'warning' | 'error' | 'critical';
}

export type TelemetryEvent =
  | ScenarioAttemptEvent
  | ScenarioCheckpointEvent
  | ScenarioResultEvent
  | DependencyEvent
  | ExceptionEvent;

export interface TelemetrySink {
  emit(event: TelemetryEvent): void | Promise<void>;
  flush?(): Promise<void>;
  dispose?(): Promise<void>;
}

export interface TelemetrySinkConfiguration {
  mode: TelemetrySinkMode;
  connectionStringPresent: boolean;
  cloudRoleName?: string;
  samplingEnabled: boolean;
  enabledAt: string;
}

export function createScenarioTelemetryContext(input: {
  operationId: string;
  sessionId: string;
  scenario: Pick<MonitoringScenarioDefinition, 'scenarioId' | 'scenarioVersion' | 'criticality'>;
  parentId?: string;
}): TelemetryContext {
  return {
    operationId: input.operationId,
    parentId: input.parentId,
    sessionId: input.sessionId,
    scenarioId: input.scenario.scenarioId,
    scenarioVersion: input.scenario.scenarioVersion,
    criticality: input.scenario.criticality
  };
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isScenarioCriticality(value: unknown): value is ScenarioCriticality {
  return value === 'core' || value === 'important';
}

function isScenarioStatus(value: unknown): value is ScenarioStatus {
  return (
    value === 'success' ||
    value === 'failure' ||
    value === 'blocked_safe' ||
    value === 'cancelled_user' ||
    value === 'degraded'
  );
}

function isCheckpointStatus(value: unknown): value is CheckpointStatus {
  return value === 'pass' || value === 'failure' || value === 'blocked_safe' || value === 'degraded';
}

function isScenarioComponent(value: unknown): value is ScenarioComponent {
  return (
    value === 'viewer' ||
    value === 'selection' ||
    value === 'request_execution' ||
    value === 'apply' ||
    value === 'provider' ||
    value === 'session'
  );
}

function isTelemetryFailureClass(value: unknown): value is TelemetryFailureClass {
  return typeof value === 'string' && (TELEMETRY_FAILURE_CLASSES as readonly string[]).includes(value);
}

function isTelemetryContext(value: unknown): value is TelemetryContext {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as Partial<TelemetryContext>;

  return (
    isNonEmptyString(candidate.operationId) &&
    isNonEmptyString(candidate.sessionId) &&
    (candidate.parentId === undefined || isNonEmptyString(candidate.parentId)) &&
    (candidate.scenarioId === undefined || isNonEmptyString(candidate.scenarioId)) &&
    (candidate.scenarioVersion === undefined || isNonEmptyString(candidate.scenarioVersion)) &&
    (candidate.criticality === undefined || isScenarioCriticality(candidate.criticality))
  );
}

function isTelemetryProperties(value: unknown): value is TelemetryProperties {
  if (value === undefined) {
    return true;
  }

  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }

  return Object.values(value).every((propertyValue) => {
    return propertyValue === undefined || ['string', 'number', 'boolean'].includes(typeof propertyValue);
  });
}

function isTelemetryMeasurements(value: unknown): value is TelemetryMeasurements {
  if (value === undefined) {
    return true;
  }

  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }

  return Object.values(value).every((measurementValue) => {
    return measurementValue === undefined || isFiniteNumber(measurementValue);
  });
}

export function assertValidTelemetryEvent(value: unknown): asserts value is TelemetryEvent {
  if (!value || typeof value !== 'object') {
    throw new TypeError('Invalid telemetry event payload.');
  }

  const candidate = value as Partial<TelemetryEvent>;

  if (!isTelemetryContext(candidate.context) || !isTelemetryProperties(candidate.properties) || !isTelemetryMeasurements(candidate.measurements)) {
    throw new TypeError('Invalid telemetry event payload.');
  }

  switch (candidate.eventType) {
    case 'scenario_attempt':
      if (candidate.status !== undefined && candidate.status !== 'started') {
        throw new TypeError('Invalid telemetry event payload.');
      }
      return;
    case 'scenario_checkpoint':
      if (
        !isNonEmptyString(candidate.checkpointId) ||
        !isCheckpointStatus(candidate.status) ||
        !isScenarioComponent(candidate.component) ||
        (candidate.failureClass !== undefined && !isTelemetryFailureClass(candidate.failureClass)) ||
        (candidate.reasonCode !== undefined && !isNonEmptyString(candidate.reasonCode)) ||
        (candidate.durationMs !== undefined && !isFiniteNumber(candidate.durationMs))
      ) {
        throw new TypeError('Invalid telemetry event payload.');
      }
      return;
    case 'scenario_result':
      if (
        !isScenarioStatus(candidate.status) ||
        !isFiniteNumber(candidate.durationMs) ||
        (candidate.failureClass !== undefined && !isTelemetryFailureClass(candidate.failureClass)) ||
        (candidate.reasonCode !== undefined && !isNonEmptyString(candidate.reasonCode))
      ) {
        throw new TypeError('Invalid telemetry event payload.');
      }
      return;
    case 'dependency':
      if (
        !isNonEmptyString(candidate.operationName) ||
        !isNonEmptyString(candidate.dependencyType) ||
        (candidate.status !== 'success' && candidate.status !== 'failure') ||
        !isFiniteNumber(candidate.durationMs) ||
        (candidate.resultCode !== undefined && !isNonEmptyString(candidate.resultCode))
      ) {
        throw new TypeError('Invalid telemetry event payload.');
      }
      return;
    case 'exception':
      if (
        !isNonEmptyString(candidate.operationName) ||
        !isNonEmptyString(candidate.errorClass) ||
        typeof candidate.handled !== 'boolean' ||
        (candidate.severity !== 'warning' && candidate.severity !== 'error' && candidate.severity !== 'critical')
      ) {
        throw new TypeError('Invalid telemetry event payload.');
      }
      return;
    default:
      throw new TypeError('Invalid telemetry event payload.');
  }
}