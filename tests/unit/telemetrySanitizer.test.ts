import assert from 'node:assert/strict';
import {
  sanitizeTelemetryEvent,
  sanitizeTelemetryMeasurements,
  sanitizeTelemetryProperties,
  toDocumentLengthBucket,
  toPseudonymousSessionId,
  toSelectionLengthBucket
} from '../../src/telemetry/telemetrySanitizer';
import type { TelemetryEvent } from '../../src/telemetry/telemetryContract';

suite('Telemetry sanitizer', () => {
  test('drops prohibited properties and keeps numeric measurements only', () => {
    const properties = sanitizeTelemetryProperties({
      scenarioId: 'load_markdown_preview',
      documentUri: 'file:///workspace/sample.md',
      promptText: 'Rewrite this paragraph.',
      surface: 'custom_editor',
      provider_kind: 'copilot',
      freeform_note: 'do not keep this',
      selection_length_bucket: 'medium',
      retryCount: 1
    });
    const measurements = sanitizeTelemetryMeasurements({
      duration_ms: 123,
      document_length: 2400,
      unsafe_metric: 9,
      invalid: Number.NaN
    });

    assert.deepEqual(properties, {
      surface: 'custom_editor',
      provider_kind: 'copilot',
      selection_length_bucket: 'medium'
    });
    assert.deepEqual(measurements, {
      duration_ms: 123,
      document_length: 2400
    });
  });

  test('pseudonymizes session identifiers deterministically', () => {
    const first = toPseudonymousSessionId('session-123');
    const second = toPseudonymousSessionId('session-123');

    assert.equal(first, second);
    assert.notEqual(first, 'session-123');
  });

  test('sanitizes a telemetry event before sink emission', () => {
    const event: TelemetryEvent = {
      eventType: 'scenario_result',
      context: {
        operationId: 'operation-1',
        sessionId: 'session-123',
        scenarioId: 'load_markdown_preview',
        scenarioVersion: '1',
        criticality: 'core'
      },
      status: 'success',
      durationMs: 42,
      properties: {
        documentUri: 'file:///workspace/sample.md',
        surface: 'custom_editor',
        freeform_note: 'drop this value'
      },
      measurements: {
        duration_ms: 42,
        unsafe_metric: 7
      }
    };

    const sanitizedEvent = sanitizeTelemetryEvent(event);

    assert.notEqual(sanitizedEvent.context.sessionId, 'session-123');
    assert.deepEqual(sanitizedEvent.properties, {
      surface: 'custom_editor'
    });
    assert.deepEqual(sanitizedEvent.measurements, {
      duration_ms: 42
    });
  });

  test('keeps pseudonymous session correlation stable across sanitized events', () => {
    const first = sanitizeTelemetryEvent({
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
    const second = sanitizeTelemetryEvent({
      eventType: 'scenario_result',
      context: {
        operationId: 'operation-2',
        sessionId: 'session-123',
        scenarioId: 'load_markdown_preview',
        scenarioVersion: '1',
        criticality: 'core'
      },
      status: 'success',
      durationMs: 20
    });

    assert.equal(first.context.sessionId, second.context.sessionId);
    assert.match(first.context.sessionId, /^[a-f0-9]{16}$/);
  });

  test('assigns coarse length buckets', () => {
    assert.equal(toSelectionLengthBucket(50), 'short');
    assert.equal(toSelectionLengthBucket(200), 'medium');
    assert.equal(toSelectionLengthBucket(900), 'long');
    assert.equal(toSelectionLengthBucket(2400), 'chapter_scale');

    assert.equal(toDocumentLengthBucket(500), 'small');
    assert.equal(toDocumentLengthBucket(2500), 'medium');
    assert.equal(toDocumentLengthBucket(6000), 'large');
  });
});