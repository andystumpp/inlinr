import assert from 'node:assert/strict';
import {
  RecordingTelemetrySink,
  createAzureMonitorApplicationInsightsClient,
  createTelemetrySinkSelection,
  getTelemetryCloudRoleName,
  isTelemetrySamplingConfigured,
  mapTelemetryEventToApplicationInsightsEnvelope
} from '../../src/telemetry/applicationInsightsSink';
import { createTelemetryAdapter } from '../../src/telemetry/telemetryAdapter';
import { createScenarioTelemetryContext, type TelemetryEvent } from '../../src/telemetry/telemetryContract';

function createScenarioResultEvent(): TelemetryEvent {
  return {
    eventType: 'scenario_result',
    context: {
      operationId: 'operation-1',
      sessionId: 'session-123',
      scenarioId: 'load_markdown_preview',
      scenarioVersion: '1',
      criticality: 'core'
    },
    status: 'success',
    durationMs: 250,
    properties: {
      surface: 'custom_editor',
      documentUri: 'file:///workspace/sample.md'
    },
    measurements: {
      duration_ms: 250
    }
  };
}

suite('Telemetry adapter', () => {
  test('records sanitized telemetry events when a recording sink is selected', () => {
    const sink = new RecordingTelemetrySink();
    const adapter = createTelemetryAdapter({
      mode: 'recording',
      recordingSink: sink
    });

    adapter.emit(createScenarioResultEvent());

    assert.equal(sink.getEvents().length, 1);
    assert.deepEqual(sink.getEvents()[0].properties, {
      surface: 'custom_editor'
    });
  });

  test('emits at most one terminal result per scenario attempt', () => {
    const sink = new RecordingTelemetrySink();
    const adapter = createTelemetryAdapter({
      mode: 'recording',
      recordingSink: sink
    });
    const attempt = adapter.startScenarioAttempt({
      scenarioId: 'load_markdown_preview',
      sessionId: 'session-123'
    });

    adapter.completeScenarioAttempt(attempt, {
      status: 'success',
      durationMs: 10
    });

    const secondCompletion = adapter.completeScenarioAttempt(attempt, {
      status: 'failure',
      durationMs: 20,
      failureClass: 'unexpected_exception'
    });

    const resultEvents = sink.getEvents().filter((event) => event.eventType === 'scenario_result');

    assert.equal(secondCompletion, false);
    assert.equal(resultEvents.length, 1);
    assert.equal(resultEvents[0].status, 'success');
  });

  test('rejects out-of-order scenario checkpoints for the same attempt', () => {
    const sink = new RecordingTelemetrySink();
    const adapter = createTelemetryAdapter({
      mode: 'recording',
      recordingSink: sink
    });
    const attempt = adapter.startScenarioAttempt({
      scenarioId: 'load_markdown_preview',
      sessionId: 'session-123'
    });

    const firstCheckpoint = adapter.emitScenarioCheckpoint(attempt, {
      checkpointId: 'render_markdown',
      status: 'pass'
    });
    const secondCheckpoint = adapter.emitScenarioCheckpoint(attempt, {
      checkpointId: 'route_to_viewer',
      status: 'pass'
    });

    assert.equal(firstCheckpoint, true);
    assert.equal(secondCheckpoint, false);
    assert.equal(sink.getEvents().filter((event) => event.eventType === 'scenario_checkpoint').length, 1);
  });

  test('defaults to a no-op sink when Azure configuration is absent', () => {
    const adapter = createTelemetryAdapter({
      environment: {}
    });

    assert.equal(adapter.configuration.mode, 'noop');
    assert.equal(adapter.configuration.connectionStringPresent, false);
  });

  test('maps scenario results to Application Insights custom event envelopes', () => {
    const envelope = mapTelemetryEventToApplicationInsightsEnvelope(createScenarioResultEvent());

    assert.equal(envelope.kind, 'event');
    assert.equal(envelope.name, 'scenario_result');
    assert.equal(envelope.properties.scenarioId, 'load_markdown_preview');
    assert.equal(envelope.measurements.duration_ms, 250);
  });

  test('creates an Azure sink selection when a connection string is present', () => {
    const selection = createTelemetrySinkSelection({
      environment: {
        APPLICATIONINSIGHTS_CONNECTION_STRING: 'InstrumentationKey=fake;IngestionEndpoint=https://example.test/'
      }
    });

    assert.equal(selection.configuration.mode, 'azure_monitor');
    assert.equal(selection.configuration.connectionStringPresent, true);
  });

  test('creates a reusable scenario telemetry context from scenario metadata', () => {
    const context = createScenarioTelemetryContext({
      operationId: 'operation-1',
      parentId: 'parent-1',
      sessionId: 'session-123',
      scenario: {
        scenarioId: 'load_markdown_preview',
        scenarioVersion: '1',
        criticality: 'core'
      }
    });

    assert.deepEqual(context, {
      operationId: 'operation-1',
      parentId: 'parent-1',
      sessionId: 'session-123',
      scenarioId: 'load_markdown_preview',
      scenarioVersion: '1',
      criticality: 'core'
    });
  });

  test('uses a provided Azure client factory and preserves cloud role configuration', () => {
    const createdClients: object[] = [];

    const selection = createTelemetrySinkSelection({
      environment: {
        APPLICATIONINSIGHTS_CONNECTION_STRING: 'InstrumentationKey=fake;IngestionEndpoint=https://example.test/',
        INLINR_TELEMETRY_CLOUD_ROLE_NAME: 'custom-role',
        OTEL_TRACES_SAMPLER: 'microsoft.fixed_percentage'
      },
      applicationInsightsClientFactory(configuration) {
        const client = {
          configuration,
          trackEvent() {
            return undefined;
          }
        };

        createdClients.push(client);
        return client;
      }
    });

    assert.equal(selection.configuration.mode, 'azure_monitor');
    assert.equal(selection.configuration.cloudRoleName, 'custom-role');
    assert.equal(selection.configuration.samplingEnabled, true);
    assert.equal(createdClients.length, 1);
  });

  test('fails open when Azure client initialization throws', async () => {
    const selection = createTelemetrySinkSelection({
      environment: {
        APPLICATIONINSIGHTS_CONNECTION_STRING: 'InstrumentationKey=fake;IngestionEndpoint=https://example.test/'
      },
      applicationInsightsClientFactory() {
        throw new Error('invalid-azure-config');
      }
    });

    assert.equal(selection.configuration.mode, 'noop');
    assert.equal(selection.configuration.connectionStringPresent, true);
    await assert.doesNotReject(async () => {
      await selection.sink.emit({
        eventType: 'scenario_attempt',
        context: {
          operationId: 'operation-1',
          sessionId: 'session-123',
          scenarioId: 'load_markdown_preview',
          scenarioVersion: '1',
          criticality: 'core'
        },
        status: 'started'
      });
    });
  });

  test('creates a direct Azure client that translates envelopes into Breeze telemetry items', async () => {
    const trackedItems: unknown[][] = [];
    const client = createAzureMonitorApplicationInsightsClient({
      connectionString: 'InstrumentationKey=fake;IngestionEndpoint=https://example.test/',
      cloudRoleName: 'inlinr.role',
      environment: {
        COMPUTERNAME: 'test-machine'
      },
      generatedApi: {
        createApplicationInsights() {
          return { kind: 'context' };
        },
        async track(_context, body) {
          trackedItems.push(body);
        }
      }
    });

    client.trackDependency?.({
      kind: 'dependency',
      name: 'execute_selection_request',
      dependencyType: 'copilot_language_model',
      success: false,
      resultCode: 'execution-error',
      durationMs: 125,
      properties: {
        operationId: 'operation-1',
        scenarioId: 'submit_request_receive_review'
      },
      measurements: {
        duration_ms: 125
      }
    });
    await client.flush?.();

    assert.equal(trackedItems.length, 1);

    const dependencyItem = trackedItems[0][0] as {
      name: string;
      instrumentationKey: string;
      tags: Record<string, string>;
      data: { baseType: string; baseData: { type: string; duration: string; success: boolean } };
    };

    assert.equal(dependencyItem.name, 'Microsoft.ApplicationInsights.RemoteDependency');
    assert.equal(dependencyItem.instrumentationKey, 'fake');
    assert.equal(dependencyItem.tags['ai.cloud.role'], 'inlinr.role');
    assert.equal(dependencyItem.tags['ai.cloud.roleInstance'], 'test-machine');
    assert.equal(dependencyItem.data.baseType, 'RemoteDependencyData');
    assert.equal(dependencyItem.data.baseData.type, 'copilot_language_model');
    assert.equal(dependencyItem.data.baseData.success, false);
    assert.match(dependencyItem.data.baseData.duration, /^0\./);
  });

  test('derives cloud role and sampling settings from the environment', () => {
    assert.equal(
      getTelemetryCloudRoleName({
        INLINR_TELEMETRY_CLOUD_ROLE_NAME: 'custom-role'
      }, 'fallback-role'),
      'custom-role'
    );
    assert.equal(isTelemetrySamplingConfigured({ OTEL_TRACES_SAMPLER: 'always_on' }), true);
    assert.equal(isTelemetrySamplingConfigured({}), false);
  });
});