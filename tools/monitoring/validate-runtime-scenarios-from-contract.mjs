import path from 'node:path';
import { createRequire } from 'node:module';
import { readScenarioContract } from './generate-alert-policies-from-contract.mjs';
import { projectRoot } from './alertPolicyUtils.mjs';

const RUNTIME_REQUIRED_READINESS = new Set(['instrumented', 'deployable']);

function compareStringField(errors, scenarioId, fieldName, expectedValue, actualValue) {
  if (expectedValue !== actualValue) {
    errors.push(
      `Scenario ${scenarioId} ${fieldName} mismatch. Expected ${JSON.stringify(expectedValue)}, got ${JSON.stringify(actualValue)}.`
    );
  }
}

function toRuntimePrimaryAlert(contractScenario, errors) {
  const primaryAlert = contractScenario.alerting?.profile
    ? contractScenario.__resolvedPrimaryAlert
    : undefined;

  if (!primaryAlert) {
    errors.push(`Scenario ${contractScenario.scenario_id} could not resolve a primary alert from the contract profile.`);
    return 'non_paging_diagnostic';
  }

  if (primaryAlert.severity !== 'page') {
    return 'non_paging_diagnostic';
  }

  if (
    primaryAlert.signal_type === 'synthetic_availability' ||
    primaryAlert.signal_type === 'real_user_failure_rate' ||
    primaryAlert.signal_type === 'latency'
  ) {
    return primaryAlert.signal_type;
  }

  errors.push(
    `Scenario ${contractScenario.scenario_id} has unsupported page-level primary signal ${primaryAlert.signal_type} for runtime registry projection.`
  );
  return 'non_paging_diagnostic';
}

function resolvePrimaryAlert(contract, contractScenario) {
  const profile = contract.defaults?.alert_profiles?.[contractScenario.alerting?.profile];

  if (!profile?.primary_alert) {
    return undefined;
  }

  return {
    ...profile.primary_alert,
    ...(contractScenario.alerting?.overrides?.primary_alert ?? {}),
    threshold: {
      ...(profile.primary_alert.threshold ?? {}),
      ...(contractScenario.alerting?.overrides?.primary_alert?.threshold ?? {})
    }
  };
}

function normalizeSupportingSignals(signals) {
  return [...new Set(signals)].sort();
}

function buildExpectedRuntimeScenarios(contract) {
  const errors = [];
  const contractScenarios = Array.isArray(contract.scenarios) ? contract.scenarios : [];
  const expectedScenarios = [];

  for (const contractScenario of contractScenarios) {
    const readiness = contractScenario.runtime?.readiness;

    if (!RUNTIME_REQUIRED_READINESS.has(readiness)) {
      continue;
    }

    const resolvedPrimaryAlert = resolvePrimaryAlert(contract, contractScenario);
    const scenarioWithResolvedAlert = {
      ...contractScenario,
      __resolvedPrimaryAlert: resolvedPrimaryAlert
    };

    expectedScenarios.push({
      scenarioId: contractScenario.scenario_id,
      scenarioVersion: contractScenario.runtime.scenario_version,
      title: contractScenario.title,
      criticality: contractScenario.criticality,
      startCondition: contractScenario.journey.start_condition,
      successCondition: contractScenario.journey.success_condition,
      safeBlockCondition: contractScenario.journey.safe_block_condition,
      checkpoints: (contractScenario.runtime.checkpoints ?? []).map((checkpoint) => ({
        checkpointId: checkpoint.checkpoint_id,
        order: checkpoint.order,
        description: checkpoint.description,
        component: checkpoint.component,
        ...(checkpoint.latency_sensitive ? { latencySensitive: true } : {})
      })),
      primaryAlert: toRuntimePrimaryAlert(scenarioWithResolvedAlert, errors),
      supportingSignals: normalizeSupportingSignals(contractScenario.telemetry?.allowed_supporting_signals ?? [])
    });
  }

  return { expectedScenarios, errors };
}

async function loadRuntimeScenarios() {
  const require = createRequire(import.meta.url);
  const registryModulePath = path.join(projectRoot, 'out', 'src', 'telemetry', 'scenarioRegistry.js');
  const registryModule = require(registryModulePath);
  return registryModule.CURRENT_MONITORING_SCENARIOS;
}

function compareRuntimeScenarios(expectedScenarios, runtimeScenarios) {
  const errors = [];
  const expectedById = new Map(expectedScenarios.map((scenario) => [scenario.scenarioId, scenario]));
  const runtimeById = new Map(runtimeScenarios.map((scenario) => [scenario.scenarioId, scenario]));

  for (const expectedScenario of expectedScenarios) {
    const runtimeScenario = runtimeById.get(expectedScenario.scenarioId);

    if (!runtimeScenario) {
      errors.push(`Runtime registry is missing scenario ${expectedScenario.scenarioId} required by the monitoring contract.`);
      continue;
    }

    compareStringField(errors, expectedScenario.scenarioId, 'scenarioVersion', expectedScenario.scenarioVersion, runtimeScenario.scenarioVersion);
    compareStringField(errors, expectedScenario.scenarioId, 'title', expectedScenario.title, runtimeScenario.title);
    compareStringField(errors, expectedScenario.scenarioId, 'criticality', expectedScenario.criticality, runtimeScenario.criticality);
    compareStringField(errors, expectedScenario.scenarioId, 'startCondition', expectedScenario.startCondition, runtimeScenario.startCondition);
    compareStringField(errors, expectedScenario.scenarioId, 'successCondition', expectedScenario.successCondition, runtimeScenario.successCondition);
    compareStringField(errors, expectedScenario.scenarioId, 'safeBlockCondition', expectedScenario.safeBlockCondition, runtimeScenario.safeBlockCondition);
    compareStringField(errors, expectedScenario.scenarioId, 'primaryAlert', expectedScenario.primaryAlert, runtimeScenario.primaryAlert);

    const expectedSignals = normalizeSupportingSignals(expectedScenario.supportingSignals);
    const actualSignals = normalizeSupportingSignals(runtimeScenario.supportingSignals ?? []);
    if (JSON.stringify(expectedSignals) !== JSON.stringify(actualSignals)) {
      errors.push(
        `Scenario ${expectedScenario.scenarioId} supportingSignals mismatch. Expected ${JSON.stringify(expectedSignals)}, got ${JSON.stringify(actualSignals)}.`
      );
    }

    if (expectedScenario.checkpoints.length !== runtimeScenario.checkpoints.length) {
      errors.push(
        `Scenario ${expectedScenario.scenarioId} checkpoint count mismatch. Expected ${expectedScenario.checkpoints.length}, got ${runtimeScenario.checkpoints.length}.`
      );
      continue;
    }

    for (let index = 0; index < expectedScenario.checkpoints.length; index += 1) {
      const expectedCheckpoint = expectedScenario.checkpoints[index];
      const actualCheckpoint = runtimeScenario.checkpoints[index];
      const checkpointLabel = `${expectedScenario.scenarioId} checkpoint ${expectedCheckpoint.checkpointId}`;

      compareStringField(errors, checkpointLabel, 'checkpointId', expectedCheckpoint.checkpointId, actualCheckpoint.checkpointId);
      compareStringField(errors, checkpointLabel, 'description', expectedCheckpoint.description, actualCheckpoint.description);
      compareStringField(errors, checkpointLabel, 'component', expectedCheckpoint.component, actualCheckpoint.component);

      if (expectedCheckpoint.order !== actualCheckpoint.order) {
        errors.push(
          `Scenario ${checkpointLabel} order mismatch. Expected ${expectedCheckpoint.order}, got ${actualCheckpoint.order}.`
        );
      }

      if (Boolean(expectedCheckpoint.latencySensitive) !== Boolean(actualCheckpoint.latencySensitive)) {
        errors.push(
          `Scenario ${checkpointLabel} latencySensitive mismatch. Expected ${Boolean(expectedCheckpoint.latencySensitive)}, got ${Boolean(actualCheckpoint.latencySensitive)}.`
        );
      }
    }
  }

  for (const runtimeScenario of runtimeScenarios) {
    if (!expectedById.has(runtimeScenario.scenarioId)) {
      errors.push(`Runtime registry contains scenario ${runtimeScenario.scenarioId} that is not required by the monitoring contract.`);
    }
  }

  return errors;
}

async function main() {
  const contract = await readScenarioContract();
  const { expectedScenarios, errors: projectionErrors } = buildExpectedRuntimeScenarios(contract);

  if (projectionErrors.length > 0) {
    for (const error of projectionErrors) {
      console.error(`Error: ${error}`);
    }

    process.exitCode = 1;
    return;
  }

  const runtimeScenarios = await loadRuntimeScenarios();
  const errors = compareRuntimeScenarios(expectedScenarios, runtimeScenarios);

  if (errors.length > 0) {
    for (const error of errors) {
      console.error(`Error: ${error}`);
    }

    process.exitCode = 1;
    return;
  }

  console.log(`Validated ${expectedScenarios.length} contract-derived runtime monitoring scenarios.`);
  console.log(`Validated ${runtimeScenarios.length} runtime registry scenarios.`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : error);
  process.exitCode = 1;
});