import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const projectRoot = path.resolve(__dirname, '..', '..');
export const generatedArtifactsDir = path.join(projectRoot, 'infra', 'monitoring', 'generated');
export const generatedAlertPoliciesPath = path.join(generatedArtifactsDir, 'alert-policies.generated.json');

const ALLOWED_CRITICALITY = new Set(['core', 'important']);
const ALLOWED_READINESS = new Set(['planned', 'instrumented', 'deployable', 'retired']);
const ALLOWED_ALERT_KIND = new Set(['scheduled_query', 'metric_alert']);
const ALLOWED_SIGNAL_TYPE = new Set([
  'synthetic_availability',
  'real_user_failure_rate',
  'latency',
  'checkpoint_spike',
  'exception_spike'
]);
const ALLOWED_SEVERITY = new Set(['page', 'non_paging', 'diagnostic_only']);
const ALLOWED_RULE_KIND = new Set(['availability', 'metric_alert', 'log_search_alert', 'simple_log_alert']);

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function pushError(errors, message) {
  errors.push(message);
}

function pushWarning(warnings, message) {
  warnings.push(message);
}

function validateAlertDefinition(alert, pathLabel, errors) {
  if (!isPlainObject(alert)) {
    pushError(errors, `${pathLabel} must be an object.`);
    return;
  }

  if (!ALLOWED_ALERT_KIND.has(alert.kind)) {
    pushError(errors, `${pathLabel}.kind must be one of: ${[...ALLOWED_ALERT_KIND].join(', ')}.`);
  }

  if (!ALLOWED_SIGNAL_TYPE.has(alert.signal_type)) {
    pushError(errors, `${pathLabel}.signal_type must be one of: ${[...ALLOWED_SIGNAL_TYPE].join(', ')}.`);
  }

  if (!ALLOWED_SEVERITY.has(alert.severity)) {
    pushError(errors, `${pathLabel}.severity must be one of: ${[...ALLOWED_SEVERITY].join(', ')}.`);
  }

  if (!ALLOWED_RULE_KIND.has(alert.rule_kind)) {
    pushError(errors, `${pathLabel}.rule_kind must be one of: ${[...ALLOWED_RULE_KIND].join(', ')}.`);
  }

  if (typeof alert.route_ref !== 'string' || alert.route_ref.trim().length === 0) {
    pushError(errors, `${pathLabel}.route_ref must be a non-empty string.`);
  }

  if (typeof alert.window !== 'string' || !alert.window.startsWith('PT')) {
    pushError(errors, `${pathLabel}.window must be an ISO-8601 duration such as PT15M.`);
  }

  if (typeof alert.evaluation_frequency !== 'string' || !alert.evaluation_frequency.startsWith('PT')) {
    pushError(errors, `${pathLabel}.evaluation_frequency must be an ISO-8601 duration such as PT5M.`);
  }

  if (!isPlainObject(alert.threshold)) {
    pushError(errors, `${pathLabel}.threshold must be an object.`);
  }

  if (
    (alert.signal_type === 'checkpoint_spike' || alert.signal_type === 'latency') &&
    (typeof alert.checkpoint_id !== 'string' || alert.checkpoint_id.length === 0)
  ) {
    pushError(errors, `${pathLabel}.checkpoint_id is required for ${alert.signal_type} alerts.`);
  }
}

export async function loadRuntimeRegistry() {
  const require = createRequire(import.meta.url);
  const registryModulePath = path.join(projectRoot, 'out', 'src', 'telemetry', 'scenarioRegistry.js');
  const registryModule = require(registryModulePath);
  return registryModule.CURRENT_MONITORING_SCENARIOS;
}

export async function validateAlertPolicies(inputAlertPolicies) {
  if (!isPlainObject(inputAlertPolicies)) {
    throw new Error('Compiled monitoring alert policies must be provided to validateAlertPolicies().');
  }

  const alertPolicies = inputAlertPolicies;
  const runtimeScenarios = await loadRuntimeRegistry();
  const errors = [];
  const warnings = [];

  if (alertPolicies.schema_version !== 1) {
    pushError(errors, 'Compiled monitoring alert policies schema_version must be 1.');
  }

  if (!isPlainObject(alertPolicies.defaults)) {
    pushError(errors, 'Compiled monitoring alert policies defaults must be an object.');
  }

  const deployableReadinessStates = Array.isArray(alertPolicies.defaults?.deployable_readiness_states)
    ? alertPolicies.defaults.deployable_readiness_states
    : ['deployable'];
  const routeRefs = isPlainObject(alertPolicies.defaults?.route_refs) ? alertPolicies.defaults.route_refs : {};
  const policies = Array.isArray(alertPolicies.scenarios) ? alertPolicies.scenarios : [];

  if (policies.length === 0) {
    pushError(errors, 'Compiled monitoring alert policies must define at least one scenario alert policy.');
  }

  const runtimeScenarioById = new Map(runtimeScenarios.map((scenario) => [scenario.scenarioId, scenario]));
  const policyById = new Map();

  for (const [index, policy] of policies.entries()) {
    const pathLabel = `scenarios[${index}]`;

    if (!isPlainObject(policy)) {
      pushError(errors, `${pathLabel} must be an object.`);
      continue;
    }

    if (typeof policy.scenario_id !== 'string' || policy.scenario_id.trim().length === 0) {
      pushError(errors, `${pathLabel}.scenario_id must be a non-empty string.`);
      continue;
    }

    if (policyById.has(policy.scenario_id)) {
      pushError(errors, `Duplicate alert policy scenario_id: ${policy.scenario_id}.`);
      continue;
    }

    policyById.set(policy.scenario_id, policy);

    if (!ALLOWED_CRITICALITY.has(policy.criticality)) {
      pushError(errors, `${pathLabel}.criticality must be one of: ${[...ALLOWED_CRITICALITY].join(', ')}.`);
    }

    if (!ALLOWED_READINESS.has(policy.readiness)) {
      pushError(errors, `${pathLabel}.readiness must be one of: ${[...ALLOWED_READINESS].join(', ')}.`);
    }

    validateAlertDefinition(policy.primary_alert, `${pathLabel}.primary_alert`, errors);

    if (Array.isArray(policy.supporting_alerts)) {
      for (const [supportingIndex, supportingAlert] of policy.supporting_alerts.entries()) {
        validateAlertDefinition(supportingAlert, `${pathLabel}.supporting_alerts[${supportingIndex}]`, errors);
      }
    } else {
      pushError(errors, `${pathLabel}.supporting_alerts must be an array.`);
    }

    if (typeof policy.primary_alert?.route_ref === 'string' && !routeRefs[policy.primary_alert.route_ref]) {
      pushError(errors, `${pathLabel}.primary_alert.route_ref references an unknown defaults.route_refs key.`);
    }

    for (const [supportingIndex, supportingAlert] of (policy.supporting_alerts ?? []).entries()) {
      if (typeof supportingAlert.route_ref === 'string' && !routeRefs[supportingAlert.route_ref]) {
        pushError(errors, `${pathLabel}.supporting_alerts[${supportingIndex}].route_ref references an unknown defaults.route_refs key.`);
      }
    }

    const deployable = deployableReadinessStates.includes(policy.readiness);
    const runtimeBinding = policy.runtime_binding;

    if (deployable) {
      if (!isPlainObject(runtimeBinding)) {
        pushError(errors, `${pathLabel}.runtime_binding is required when readiness is deployable.`);
        continue;
      }

      if (typeof runtimeBinding.scenario_id !== 'string' || runtimeBinding.scenario_id.trim().length === 0) {
        pushError(errors, `${pathLabel}.runtime_binding.scenario_id must be a non-empty string.`);
        continue;
      }

      const runtimeScenario = runtimeScenarioById.get(runtimeBinding.scenario_id);

      if (!runtimeScenario) {
        pushError(errors, `${pathLabel}.runtime_binding.scenario_id references an unknown runtime scenario: ${runtimeBinding.scenario_id}.`);
        continue;
      }

      if (policy.criticality !== runtimeScenario.criticality) {
        pushError(errors, `${pathLabel}.criticality does not match runtime scenario ${runtimeScenario.scenarioId}.`);
      }

      if (policy.scenario_id !== runtimeBinding.scenario_id) {
        pushWarning(warnings, `${pathLabel}.scenario_id differs from runtime_binding.scenario_id; this is allowed but should be intentional.`);
      }

      const runtimeCheckpointIds = new Set(runtimeScenario.checkpoints.map((checkpoint) => checkpoint.checkpointId));
      const boundCheckpointIds = Array.isArray(runtimeBinding.checkpoint_ids) ? runtimeBinding.checkpoint_ids : [];

      if (boundCheckpointIds.length === 0) {
        pushError(errors, `${pathLabel}.runtime_binding.checkpoint_ids must contain at least one checkpoint.`);
      }

      for (const checkpointId of boundCheckpointIds) {
        if (!runtimeCheckpointIds.has(checkpointId)) {
          pushError(errors, `${pathLabel}.runtime_binding.checkpoint_ids references unknown checkpoint ${checkpointId}.`);
        }
      }
    }
  }

  for (const runtimeScenario of runtimeScenarios) {
    if (!policyById.has(runtimeScenario.scenarioId)) {
      pushError(errors, `Runtime monitoring scenario ${runtimeScenario.scenarioId} is missing an alert intent entry.`);
    }
  }

  const deployableScenarios = policies
    .filter((policy) => deployableReadinessStates.includes(policy.readiness))
    .map((policy) => ({
      scenario_id: policy.scenario_id,
      criticality: policy.criticality,
      readiness: policy.readiness,
      runtime_binding: policy.runtime_binding,
      primary_alert: policy.primary_alert,
      supporting_alerts: policy.supporting_alerts
    }));

  return {
    alertPolicies,
    runtimeScenarios,
    deployableReadinessStates,
    routeRefs,
    deployableScenarios,
    errors,
    warnings
  };
}