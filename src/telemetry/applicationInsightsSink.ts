import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import type {
  DependencyEvent,
  ExceptionEvent,
  ScenarioAttemptEvent,
  ScenarioCheckpointEvent,
  ScenarioResultEvent,
  TelemetryEvent,
  TelemetrySink,
  TelemetrySinkConfiguration,
  TelemetrySinkMode
} from './telemetryContract';

export interface ApplicationInsightsEventEnvelope {
  kind: 'event';
  name: string;
  properties: Record<string, string>;
  measurements: Record<string, number>;
}

export interface ApplicationInsightsDependencyEnvelope {
  kind: 'dependency';
  name: string;
  dependencyType: string;
  success: boolean;
  resultCode?: string;
  durationMs: number;
  properties: Record<string, string>;
  measurements: Record<string, number>;
}

export interface ApplicationInsightsExceptionEnvelope {
  kind: 'exception';
  name: string;
  handled: boolean;
  severity: 'warning' | 'error' | 'critical';
  properties: Record<string, string>;
  measurements: Record<string, number>;
}

export type ApplicationInsightsEnvelope =
  | ApplicationInsightsEventEnvelope
  | ApplicationInsightsDependencyEnvelope
  | ApplicationInsightsExceptionEnvelope;

export interface ApplicationInsightsClient {
  trackEvent?(envelope: ApplicationInsightsEventEnvelope): void;
  trackDependency?(envelope: ApplicationInsightsDependencyEnvelope): void;
  trackException?(envelope: ApplicationInsightsExceptionEnvelope): void;
  flush?(): void | Promise<void>;
  dispose?(): void | Promise<void>;
}

export interface CreateTelemetrySinkOptions {
  mode?: TelemetrySinkMode;
  environment?: NodeJS.ProcessEnv;
  applicationInsightsClient?: ApplicationInsightsClient;
  recordingSink?: RecordingTelemetrySink;
  applicationInsightsClientFactory?: (configuration: {
    connectionString: string;
    cloudRoleName?: string;
    environment: NodeJS.ProcessEnv;
  }) => ApplicationInsightsClient;
  cloudRoleName?: string;
  samplingEnabled?: boolean;
}

export interface TelemetrySinkSelection {
  sink: TelemetrySink;
  configuration: TelemetrySinkConfiguration;
}

interface ApplicationInsightsConnectionStringParts {
  instrumentationKey: string;
  ingestionEndpoint: string;
}

interface TelemetryItemContract {
  version: number;
  name: string;
  time: Date;
  instrumentationKey: string;
  tags?: Record<string, string>;
  data: {
    baseType: 'EventData' | 'RemoteDependencyData' | 'ExceptionData';
    baseData: Record<string, unknown>;
  };
}

interface GeneratedApplicationInsightsApi {
  createApplicationInsights: (
    credential: unknown,
    options?: { host?: string; apiVersion?: string }
  ) => unknown;
  track: (context: unknown, body: TelemetryItemContract[]) => Promise<unknown>;
}

const EVENT_TELEMETRY_NAME = 'Microsoft.ApplicationInsights.Event';
const DEPENDENCY_TELEMETRY_NAME = 'Microsoft.ApplicationInsights.RemoteDependency';
const EXCEPTION_TELEMETRY_NAME = 'Microsoft.ApplicationInsights.Exception';
const DEFAULT_CLOUD_ROLE_NAME = 'inlinr.vscode-extension';
const DEFAULT_API_VERSION = 'v2.1';

function msToTimeSpan(durationMs: number): string {
  const totalMilliseconds = Number.isFinite(durationMs) && durationMs > 0 ? durationMs : 0;
  const totalSeconds = Math.floor(totalMilliseconds / 1000);
  const milliseconds = totalMilliseconds % 1000;
  const seconds = totalSeconds % 60;
  const totalMinutes = Math.floor(totalSeconds / 60);
  const minutes = totalMinutes % 60;
  const totalHours = Math.floor(totalMinutes / 60);
  const hours = totalHours % 24;
  const days = Math.floor(totalHours / 24);

  return `${days}.${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.${String(milliseconds).padEnd(6, '0')}`;
}

function parseApplicationInsightsConnectionString(
  connectionString: string
): ApplicationInsightsConnectionStringParts | undefined {
  const parts = Object.fromEntries(
    connectionString
      .split(';')
      .map((segment) => segment.trim())
      .filter((segment) => segment.length > 0)
      .map((segment) => {
        const separatorIndex = segment.indexOf('=');
        const key = separatorIndex === -1 ? segment : segment.slice(0, separatorIndex);
        const value = separatorIndex === -1 ? '' : segment.slice(separatorIndex + 1);
        return [key.toLowerCase(), value] as const;
      })
  );

  const instrumentationKey = parts.instrumentationkey?.trim();
  const ingestionEndpoint = (parts.ingestionendpoint?.trim() || 'https://dc.services.visualstudio.com').replace(/\/+$/, '');

  if (!instrumentationKey) {
    return undefined;
  }

  return {
    instrumentationKey,
    ingestionEndpoint
  };
}

function getCloudRoleName(environment: NodeJS.ProcessEnv = process.env, fallback = DEFAULT_CLOUD_ROLE_NAME): string {
  return environment.INLINR_TELEMETRY_CLOUD_ROLE_NAME?.trim() || fallback;
}

function getCloudRoleInstance(environment: NodeJS.ProcessEnv = process.env): string {
  return environment.WEBSITE_INSTANCE_ID?.trim() || environment.COMPUTERNAME?.trim() || environment.HOSTNAME?.trim() || os.hostname();
}

function createApplicationInsightsTags(input: {
  cloudRoleName?: string;
  cloudRoleInstance: string;
  envelope: ApplicationInsightsEnvelope;
}): Record<string, string> {
  const tags: Record<string, string> = {
    'ai.cloud.role': input.cloudRoleName ?? DEFAULT_CLOUD_ROLE_NAME,
    'ai.cloud.roleInstance': input.cloudRoleInstance
  };

  const operationId = input.envelope.properties.operationId;
  const parentId = input.envelope.properties.parentId;

  if (operationId) {
    tags['ai.operation.id'] = operationId;
  }

  if (parentId) {
    tags['ai.operation.parentId'] = parentId;
  }

  return tags;
}

function toSeverityLevel(severity: ApplicationInsightsExceptionEnvelope['severity']): 'Warning' | 'Error' | 'Critical' {
  switch (severity) {
    case 'warning':
      return 'Warning';
    case 'critical':
      return 'Critical';
    default:
      return 'Error';
  }
}

function createTelemetryItemFromEnvelope(input: {
  instrumentationKey: string;
  cloudRoleName?: string;
  cloudRoleInstance: string;
  envelope: ApplicationInsightsEnvelope;
}): TelemetryItemContract {
  const common = {
    version: 1,
    time: new Date(),
    instrumentationKey: input.instrumentationKey,
    tags: createApplicationInsightsTags({
      cloudRoleName: input.cloudRoleName,
      cloudRoleInstance: input.cloudRoleInstance,
      envelope: input.envelope
    })
  };

  switch (input.envelope.kind) {
    case 'event':
      return {
        ...common,
        name: EVENT_TELEMETRY_NAME,
        data: {
          baseType: 'EventData',
          baseData: {
            version: 2,
            kind: 'EventData',
            name: input.envelope.name,
            properties: input.envelope.properties,
            measurements: input.envelope.measurements
          }
        }
      };
    case 'dependency':
      return {
        ...common,
        name: DEPENDENCY_TELEMETRY_NAME,
        data: {
          baseType: 'RemoteDependencyData',
          baseData: {
            version: 2,
            kind: 'RemoteDependencyData',
            id: input.envelope.properties.operationId,
            name: input.envelope.name,
            resultCode: input.envelope.resultCode,
            data: input.envelope.name,
            type: input.envelope.dependencyType,
            target: input.cloudRoleName ?? DEFAULT_CLOUD_ROLE_NAME,
            duration: msToTimeSpan(input.envelope.durationMs),
            success: input.envelope.success,
            properties: input.envelope.properties,
            measurements: input.envelope.measurements
          }
        }
      };
    case 'exception':
      return {
        ...common,
        name: EXCEPTION_TELEMETRY_NAME,
        data: {
          baseType: 'ExceptionData',
          baseData: {
            version: 2,
            kind: 'ExceptionData',
            severityLevel: toSeverityLevel(input.envelope.severity),
            problemId: input.envelope.name,
            exceptions: [
              {
                typeName: input.envelope.properties.errorClass,
                message: `${input.envelope.name}${input.envelope.handled ? ' (handled)' : ''}`,
                hasFullStack: false
              }
            ],
            properties: input.envelope.properties,
            measurements: input.envelope.measurements
          }
        }
      };
  }
}

function loadGeneratedApplicationInsightsApi(): GeneratedApplicationInsightsApi {
  const require = createRequire(__filename);
  const packageJsonPath = require.resolve('@azure/monitor-opentelemetry-exporter/package.json');
  const packageRoot = path.dirname(packageJsonPath);
  const apiModulePath = path.join(packageRoot, 'dist', 'commonjs', 'generated', 'api', 'index.js');
  const operationsModulePath = path.join(packageRoot, 'dist', 'commonjs', 'generated', 'api', 'operations.js');
  const apiModule = require(apiModulePath) as { createApplicationInsights: GeneratedApplicationInsightsApi['createApplicationInsights'] };
  const operationsModule = require(operationsModulePath) as { track: GeneratedApplicationInsightsApi['track'] };

  return {
    createApplicationInsights: apiModule.createApplicationInsights,
    track: operationsModule.track
  };
}

export function getTelemetryCloudRoleName(
  environment: NodeJS.ProcessEnv = process.env,
  fallback = DEFAULT_CLOUD_ROLE_NAME
): string {
  return getCloudRoleName(environment, fallback);
}

export function isTelemetrySamplingConfigured(environment: NodeJS.ProcessEnv = process.env): boolean {
  return Boolean(environment.OTEL_TRACES_SAMPLER?.trim() || environment.OTEL_TRACES_SAMPLER_ARG?.trim());
}

export function createAzureMonitorApplicationInsightsClient(input: {
  connectionString: string;
  cloudRoleName?: string;
  environment?: NodeJS.ProcessEnv;
  generatedApi?: GeneratedApplicationInsightsApi;
}): ApplicationInsightsClient {
  const connection = parseApplicationInsightsConnectionString(input.connectionString);

  if (!connection) {
    throw new Error('Invalid Application Insights connection string.');
  }

  const environment = input.environment ?? process.env;
  const generatedApi = input.generatedApi ?? loadGeneratedApplicationInsightsApi();
  const clientContext = generatedApi.createApplicationInsights(undefined, {
    host: connection.ingestionEndpoint,
    apiVersion: DEFAULT_API_VERSION
  });
  const cloudRoleName = input.cloudRoleName ?? getTelemetryCloudRoleName(environment);
  const cloudRoleInstance = getCloudRoleInstance(environment);
  const pendingSends = new Set<Promise<unknown>>();

  const submitEnvelope = (envelope: ApplicationInsightsEnvelope): Promise<void> => {
    const sendPromise = generatedApi.track(clientContext, [
      createTelemetryItemFromEnvelope({
        instrumentationKey: connection.instrumentationKey,
        cloudRoleName,
        cloudRoleInstance,
        envelope
      })
    ]);
    pendingSends.add(sendPromise);

    return sendPromise
      .catch(() => undefined)
      .then(() => {
        pendingSends.delete(sendPromise);
      });
  };

  return {
    trackEvent(envelope) {
      void submitEnvelope(envelope);
    },
    trackDependency(envelope) {
      void submitEnvelope(envelope);
    },
    trackException(envelope) {
      void submitEnvelope(envelope);
    },
    async flush() {
      await Promise.allSettled([...pendingSends]);
    },
    async dispose() {
      await Promise.allSettled([...pendingSends]);
    }
  };
}

function withSharedProperties(event: TelemetryEvent): Record<string, string> {
  const properties: Record<string, string> = {
    operationId: event.context.operationId,
    sessionId: event.context.sessionId
  };

  if (event.context.parentId) {
    properties.parentId = event.context.parentId;
  }

  if (event.context.scenarioId) {
    properties.scenarioId = event.context.scenarioId;
  }

  if (event.context.scenarioVersion) {
    properties.scenarioVersion = event.context.scenarioVersion;
  }

  if (event.context.criticality) {
    properties.criticality = event.context.criticality;
  }

  for (const [key, value] of Object.entries(event.properties ?? {})) {
    if (value !== undefined) {
      properties[key] = String(value);
    }
  }

  return properties;
}

function withSharedMeasurements(event: TelemetryEvent): Record<string, number> {
  const measurements: Record<string, number> = {};

  for (const [key, value] of Object.entries(event.measurements ?? {})) {
    if (value !== undefined) {
      measurements[key] = value;
    }
  }

  return measurements;
}

function mapScenarioEventName(event: ScenarioAttemptEvent | ScenarioCheckpointEvent | ScenarioResultEvent): string {
  switch (event.eventType) {
    case 'scenario_attempt':
      return 'scenario_attempt';
    case 'scenario_checkpoint':
      return 'scenario_checkpoint';
    case 'scenario_result':
      return 'scenario_result';
  }
}

export function mapTelemetryEventToApplicationInsightsEnvelope(event: TelemetryEvent): ApplicationInsightsEnvelope {
  if (event.eventType === 'dependency') {
    const dependencyEvent = event as DependencyEvent;

    return {
      kind: 'dependency',
      name: dependencyEvent.operationName,
      dependencyType: dependencyEvent.dependencyType,
      success: dependencyEvent.status === 'success',
      resultCode: dependencyEvent.resultCode,
      durationMs: dependencyEvent.durationMs,
      properties: withSharedProperties(event),
      measurements: {
        ...withSharedMeasurements(event),
        duration_ms: dependencyEvent.durationMs
      }
    };
  }

  if (event.eventType === 'exception') {
    const exceptionEvent = event as ExceptionEvent;

    return {
      kind: 'exception',
      name: exceptionEvent.operationName,
      handled: exceptionEvent.handled,
      severity: exceptionEvent.severity,
      properties: {
        ...withSharedProperties(event),
        errorClass: exceptionEvent.errorClass
      },
      measurements: withSharedMeasurements(event)
    };
  }

  const scenarioEvent = event as ScenarioAttemptEvent | ScenarioCheckpointEvent | ScenarioResultEvent;
  const properties = withSharedProperties(event);
  const measurements = withSharedMeasurements(event);

  if (scenarioEvent.eventType === 'scenario_checkpoint') {
    properties.checkpointId = scenarioEvent.checkpointId;
    properties.status = scenarioEvent.status;
    properties.component = scenarioEvent.component;

    if (scenarioEvent.failureClass) {
      properties.failureClass = scenarioEvent.failureClass;
    }

    if (scenarioEvent.reasonCode) {
      properties.reasonCode = scenarioEvent.reasonCode;
    }

    if (scenarioEvent.durationMs !== undefined) {
      measurements.duration_ms = scenarioEvent.durationMs;
    }
  }

  if (scenarioEvent.eventType === 'scenario_result') {
    properties.status = scenarioEvent.status;

    if (scenarioEvent.failureClass) {
      properties.failureClass = scenarioEvent.failureClass;
    }

    if (scenarioEvent.reasonCode) {
      properties.reasonCode = scenarioEvent.reasonCode;
    }

    measurements.duration_ms = scenarioEvent.durationMs;
  }

  return {
    kind: 'event',
    name: mapScenarioEventName(scenarioEvent),
    properties,
    measurements
  };
}

export function getApplicationInsightsConnectionString(environment: NodeJS.ProcessEnv = process.env): string | undefined {
  const value = environment.APPLICATIONINSIGHTS_CONNECTION_STRING?.trim();
  return value && value.length > 0 ? value : undefined;
}

export class NoopTelemetrySink implements TelemetrySink {
  public emit(_event: TelemetryEvent): void {
    // Intentionally empty.
  }

  public async flush(): Promise<void> {
    // Intentionally empty.
  }

  public async dispose(): Promise<void> {
    // Intentionally empty.
  }
}

export class RecordingTelemetrySink implements TelemetrySink {
  private readonly recordedEvents: TelemetryEvent[] = [];

  public emit(event: TelemetryEvent): void {
    this.recordedEvents.push(event);
  }

  public getEvents(): readonly TelemetryEvent[] {
    return this.recordedEvents;
  }

  public clear(): void {
    this.recordedEvents.length = 0;
  }
}

export class AzureMonitorTelemetrySink implements TelemetrySink {
  public constructor(private readonly client?: ApplicationInsightsClient) {}

  public async emit(event: TelemetryEvent): Promise<void> {
    const envelope = mapTelemetryEventToApplicationInsightsEnvelope(event);

    switch (envelope.kind) {
      case 'event':
        await Promise.resolve(this.client?.trackEvent?.(envelope));
        return;
      case 'dependency':
        await Promise.resolve(this.client?.trackDependency?.(envelope));
        return;
      case 'exception':
        await Promise.resolve(this.client?.trackException?.(envelope));
        return;
    }
  }

  public async flush(): Promise<void> {
    await Promise.resolve(this.client?.flush?.());
  }

  public async dispose(): Promise<void> {
    await Promise.resolve(this.client?.dispose?.());
  }
}

export function createTelemetrySinkSelection(options: CreateTelemetrySinkOptions = {}): TelemetrySinkSelection {
  const environment = options.environment ?? process.env;
  const connectionString = getApplicationInsightsConnectionString(environment);
  const requestedMode = options.mode;
  const enabledAt = new Date().toISOString();
  const samplingEnabled = options.samplingEnabled ?? isTelemetrySamplingConfigured(environment);
  const cloudRoleName = options.cloudRoleName ?? getTelemetryCloudRoleName(environment);

  if (requestedMode === 'recording') {
    return {
      sink: options.recordingSink ?? new RecordingTelemetrySink(),
      configuration: {
        mode: 'recording',
        connectionStringPresent: Boolean(connectionString),
        cloudRoleName,
        samplingEnabled,
        enabledAt
      }
    };
  }

  if (requestedMode === 'azure_monitor' || connectionString) {
    let client = options.applicationInsightsClient;

    if (!client && connectionString) {
      try {
        client = (options.applicationInsightsClientFactory ?? createAzureMonitorApplicationInsightsClient)({
          connectionString,
          cloudRoleName,
          environment
        });
      } catch {
        client = undefined;
      }
    }

    if (!client) {
      return {
        sink: new NoopTelemetrySink(),
        configuration: {
          mode: 'noop',
          connectionStringPresent: Boolean(connectionString),
          cloudRoleName,
          samplingEnabled,
          enabledAt
        }
      };
    }

    return {
      sink: new AzureMonitorTelemetrySink(client),
      configuration: {
        mode: 'azure_monitor',
        connectionStringPresent: Boolean(connectionString),
        cloudRoleName,
        samplingEnabled,
        enabledAt
      }
    };
  }

  return {
    sink: new NoopTelemetrySink(),
    configuration: {
      mode: 'noop',
      connectionStringPresent: false,
      cloudRoleName,
      samplingEnabled,
      enabledAt
    }
  };
}