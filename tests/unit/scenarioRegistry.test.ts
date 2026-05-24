import assert from 'node:assert/strict';
import {
  CURRENT_MONITORING_SCENARIOS,
  assertValidMonitoringScenarioDefinition,
  assertValidMonitoringScenarioDefinitions,
  createScenarioRegistry,
  getScenarioCheckpointDefinition,
  getMonitoringScenarioDefinition
} from '../../src/telemetry/scenarioRegistry';

suite('Scenario registry', () => {
  test('exposes the current monitoring scenarios through the default registry', () => {
    const definition = getMonitoringScenarioDefinition('load_markdown_preview');

    assert.ok(definition);
    assert.equal(definition.criticality, 'core');
    assert.equal(definition.checkpoints.length, 3);
  });

  test('rejects duplicate scenario identifiers', () => {
    assert.throws(() => {
      createScenarioRegistry([
        ...CURRENT_MONITORING_SCENARIOS,
        {
          ...CURRENT_MONITORING_SCENARIOS[0]
        }
      ]);
    }, /Duplicate monitoring scenario id/);
  });

  test('rejects checkpoint definitions that are out of order', () => {
    assert.throws(() => {
      assertValidMonitoringScenarioDefinition({
        ...CURRENT_MONITORING_SCENARIOS[0],
        checkpoints: [
          {
            ...CURRENT_MONITORING_SCENARIOS[0].checkpoints[0]
          },
          {
            ...CURRENT_MONITORING_SCENARIOS[0].checkpoints[1],
            order: 1
          }
        ]
      });
    }, /strictly ordered/);
  });

  test('rejects duplicate checkpoint identifiers within a scenario', () => {
    assert.throws(() => {
      assertValidMonitoringScenarioDefinition({
        ...CURRENT_MONITORING_SCENARIOS[0],
        checkpoints: [
          {
            ...CURRENT_MONITORING_SCENARIOS[0].checkpoints[0]
          },
          {
            ...CURRENT_MONITORING_SCENARIOS[0].checkpoints[1],
            checkpointId: CURRENT_MONITORING_SCENARIOS[0].checkpoints[0].checkpointId,
            order: 2
          }
        ]
      });
    }, /reuses checkpoint id/);
  });

  test('validates definition collections before creating a registry', () => {
    assert.throws(() => {
      assertValidMonitoringScenarioDefinitions([
        ...CURRENT_MONITORING_SCENARIOS,
        {
          ...CURRENT_MONITORING_SCENARIOS[0]
        }
      ]);
    }, /Duplicate monitoring scenario id/);
  });

  test('exposes checkpoint lookup helpers for scenario instrumentation', () => {
    const checkpoint = getScenarioCheckpointDefinition(CURRENT_MONITORING_SCENARIOS[2], 'pending_visible');

    assert.ok(checkpoint);
    assert.equal(checkpoint.order, 2);
    assert.equal(checkpoint.component, 'request_execution');
  });
});