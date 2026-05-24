import { createHash } from 'node:crypto';
import type { TelemetryEvent, TelemetryMeasurements, TelemetryProperties } from './telemetryContract';

const PROHIBITED_PROPERTY_KEY_PATTERN = /(markdown|selectedtext|selected_text|prompt|response|renderedhtml|rendered_html|filepath|file_path|documenturi|document_uri|uri|secret|token|connectionstring|connection_string|credential|path)/i;
const ALLOWED_PROPERTY_KEYS = new Set([
  'surface',
  'scope_kind',
  'provider_kind',
  'reason_code',
  'selection_length_bucket',
  'document_length_bucket'
]);
const ALLOWED_MEASUREMENT_KEY_PATTERN = /^(duration_ms|retry_count|selection_length|document_length)$/;

export type SelectionLengthBucket = 'short' | 'medium' | 'long' | 'chapter_scale';
export type DocumentLengthBucket = 'small' | 'medium' | 'large';

export function sanitizeTelemetryProperties(properties: TelemetryProperties | undefined): Record<string, string> {
  if (!properties) {
    return {};
  }

  const sanitizedEntries = Object.entries(properties).flatMap(([key, value]) => {
    if (value === undefined || PROHIBITED_PROPERTY_KEY_PATTERN.test(key) || !ALLOWED_PROPERTY_KEYS.has(key)) {
      return [];
    }

    return [[key, String(value)] as const];
  });

  return Object.fromEntries(sanitizedEntries);
}

export function sanitizeTelemetryMeasurements(measurements: TelemetryMeasurements | undefined): Record<string, number> {
  if (!measurements) {
    return {};
  }

  const sanitizedEntries = Object.entries(measurements).flatMap(([key, value]) => {
    if (value === undefined || !Number.isFinite(value) || !ALLOWED_MEASUREMENT_KEY_PATTERN.test(key)) {
      return [];
    }

    return [[key, value] as const];
  });

  return Object.fromEntries(sanitizedEntries);
}

export function toPseudonymousSessionId(sessionId: string): string {
  return createHash('sha256').update(sessionId).digest('hex').slice(0, 16);
}

export function toSelectionLengthBucket(length: number): SelectionLengthBucket {
  if (length >= 2000) {
    return 'chapter_scale';
  }

  if (length >= 500) {
    return 'long';
  }

  if (length >= 120) {
    return 'medium';
  }

  return 'short';
}

export function toDocumentLengthBucket(length: number): DocumentLengthBucket {
  if (length >= 5000) {
    return 'large';
  }

  if (length >= 1500) {
    return 'medium';
  }

  return 'small';
}

export function sanitizeTelemetryEvent(event: TelemetryEvent): TelemetryEvent {
  return {
    ...event,
    context: {
      ...event.context,
      sessionId: toPseudonymousSessionId(event.context.sessionId)
    },
    properties: sanitizeTelemetryProperties(event.properties),
    measurements: sanitizeTelemetryMeasurements(event.measurements)
  };
}