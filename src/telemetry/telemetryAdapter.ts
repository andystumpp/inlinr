import { randomUUID } from 'node:crypto';
import { createTelemetrySinkSelection, type CreateTelemetrySinkOptions } from './applicationInsightsSink';
import { getMonitoringScenarioDefinition, getScenarioCheckpointDefinition } from './scenarioRegistry';
import { sanitizeTelemetryEvent } from './telemetrySanitizer';
import {
  assertValidTelemetryEvent,
  type CheckpointStatus,
  createScenarioTelemetryContext,
  type MonitoringScenarioDefinition,
  type ScenarioCriticality,
  type ScenarioStatus,
  type TelemetryEvent,
  type TelemetryFailureClass,
  type TelemetryMeasurements,
  type TelemetryProperties,
  type TelemetrySink,
  type TelemetrySinkConfiguration
} from './telemetryContract';

export interface ScenarioAttemptHandle {
  operationId: string;
  parentId?: string;
  sessionId: string;
  scenarioId: string;
  scenarioVersion: string;
  criticality: ScenarioCriticality;
}

export interface StartScenarioAttemptOptions {
  scenarioId: string;
  sessionId: string;
  parentId?: string;
  operationId?: string;
  startedAt?: number;
  properties?: TelemetryProperties;
  measurements?: TelemetryMeasurements;
}

export interface EmitScenarioCheckpointOptions {
  checkpointId: string;
  status: CheckpointStatus;
  failureClass?: TelemetryFailureClass;
  reasonCode?: string;
  durationMs?: number;
  properties?: TelemetryProperties;
  measurements?: TelemetryMeasurements;
}

export interface CompleteScenarioAttemptOptions {
  status: ScenarioStatus;
  durationMs?: number;
  failureClass?: TelemetryFailureClass;
  reasonCode?: string;
  properties?: TelemetryProperties;
  measurements?: TelemetryMeasurements;
}

export interface EmitDependencyOptions {
  operationName: string;
  dependencyType: string;
  status: 'success' | 'failure';
  durationMs: number;
  resultCode?: string;
  properties?: TelemetryProperties;
  measurements?: TelemetryMeasurements;
}

export interface EmitExceptionOptions {
  operationName: string;
  errorClass: string;
  handled: boolean;
  severity: 'warning' | 'error' | 'critical';
  properties?: TelemetryProperties;
  measurements?: TelemetryMeasurements;
}

interface ScenarioLifecycleState {
  attempt: ScenarioAttemptHandle;
  definition: MonitoringScenarioDefinition;
  startedAt: number;
  highestCheckpointOrder: number;
}

export class TelemetryAdapter {
  private readonly activeScenariosByOperationId = new Map<string, ScenarioLifecycleState>();
  private readonly completedScenarioResults = new Set<string>();

  public constructor(
    private readonly sink: TelemetrySink,
    public readonly configuration: TelemetrySinkConfiguration
  ) {}

  public emit(event: TelemetryEvent): void {
    assertValidTelemetryEvent(event);

    if (event.eventType === 'scenario_result') {
      if (this.completedScenarioResults.has(event.context.operationId)) {
        return;
      }

      this.completedScenarioResults.add(event.context.operationId);
      this.activeScenariosByOperationId.delete(event.context.operationId);
    }

    const sanitizedEvent = sanitizeTelemetryEvent(event);

    try {
      void Promise.resolve(this.sink.emit(sanitizedEvent)).catch(() => undefined);
    } catch {
      return;
    }
  }

  public startScenarioAttempt(options: StartScenarioAttemptOptions): ScenarioAttemptHandle {
    const definition = getMonitoringScenarioDefinition(options.scenarioId);

    if (!definition) {
      throw new Error(`Unknown monitoring scenario: ${options.scenarioId}`);
    }

    const operationId = options.operationId ?? randomUUID();

    if (this.activeScenariosByOperationId.has(operationId) || this.completedScenarioResults.has(operationId)) {
      throw new Error(`Telemetry operation id is already in use: ${operationId}`);
    }

    const attempt: ScenarioAttemptHandle = {
      operationId,
      parentId: options.parentId,
      sessionId: options.sessionId,
      scenarioId: definition.scenarioId,
      scenarioVersion: definition.scenarioVersion,
      criticality: definition.criticality
    };

    this.activeScenariosByOperationId.set(operationId, {
      attempt,
      definition,
      startedAt: options.startedAt ?? Date.now(),
      highestCheckpointOrder: 0
    });

    this.emit({
      eventType: 'scenario_attempt',
      context: this.toContext(attempt),
      status: 'started',
      properties: options.properties,
      measurements: options.measurements
    });

    return attempt;
  }

  public emitScenarioCheckpoint(attempt: ScenarioAttemptHandle, options: EmitScenarioCheckpointOptions): boolean {
    const state = this.activeScenariosByOperationId.get(attempt.operationId);

    if (!state) {
      return false;
    }

    const checkpoint = getScenarioCheckpointDefinition(state.definition, options.checkpointId);

    if (!checkpoint || checkpoint.order <= state.highestCheckpointOrder) {
      return false;
    }

    state.highestCheckpointOrder = checkpoint.order;

    this.emit({
      eventType: 'scenario_checkpoint',
      context: this.toContext(attempt),
      checkpointId: checkpoint.checkpointId,
      status: options.status,
      component: checkpoint.component,
      failureClass: options.failureClass,
      reasonCode: options.reasonCode,
      durationMs: options.durationMs,
      properties: options.properties,
      measurements: options.measurements
    });

    return true;
  }

  public completeScenarioAttempt(attempt: ScenarioAttemptHandle, options: CompleteScenarioAttemptOptions): boolean {
    const state = this.activeScenariosByOperationId.get(attempt.operationId);

    if (!state || this.completedScenarioResults.has(attempt.operationId)) {
      return false;
    }

    this.emit({
      eventType: 'scenario_result',
      context: this.toContext(attempt),
      status: options.status,
      durationMs: options.durationMs ?? Math.max(0, Date.now() - state.startedAt),
      failureClass: options.failureClass,
      reasonCode: options.reasonCode,
      properties: options.properties,
      measurements: options.measurements
    });

    return true;
  }

  public emitDependency(attempt: ScenarioAttemptHandle, options: EmitDependencyOptions): void {
    this.emit({
      eventType: 'dependency',
      context: this.toContext(attempt),
      operationName: options.operationName,
      dependencyType: options.dependencyType,
      status: options.status,
      durationMs: options.durationMs,
      resultCode: options.resultCode,
      properties: options.properties,
      measurements: options.measurements
    });
  }

  public emitException(attempt: ScenarioAttemptHandle, options: EmitExceptionOptions): void {
    this.emit({
      eventType: 'exception',
      context: this.toContext(attempt),
      operationName: options.operationName,
      errorClass: options.errorClass,
      handled: options.handled,
      severity: options.severity,
      properties: options.properties,
      measurements: options.measurements
    });
  }

  public async flush(): Promise<void> {
    if (this.sink.flush) {
      await this.sink.flush();
    }
  }

  public async dispose(): Promise<void> {
    if (this.sink.dispose) {
      await this.sink.dispose();
    }
  }

  private toContext(attempt: ScenarioAttemptHandle) {
    return createScenarioTelemetryContext({
      operationId: attempt.operationId,
      parentId: attempt.parentId,
      sessionId: attempt.sessionId,
      scenario: {
        scenarioId: attempt.scenarioId,
        scenarioVersion: attempt.scenarioVersion,
        criticality: attempt.criticality
      }
    });
  }
}

export function createTelemetryAdapter(options: CreateTelemetrySinkOptions = {}): TelemetryAdapter {
  const { sink, configuration } = createTelemetrySinkSelection(options);
  return new TelemetryAdapter(sink, configuration);
}