import fs from 'node:fs/promises';
import path from 'node:path';
import YAML from 'yaml';
import { projectRoot } from './alertPolicyUtils.mjs';

const scenarioContractPath = path.join(projectRoot, 'monitoring', 'scenario-contract.yaml');

const ALLOWED_CRITICALITY = new Set(['core', 'important']);
const ALLOWED_READINESS = new Set(['planned', 'instrumented', 'deployable', 'retired']);

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function cloneValue(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

function mergeAlertDefinition(baseAlert, overrideAlert = {}) {
  const merged = {
    ...cloneValue(baseAlert),
    ...cloneValue(overrideAlert)
  };

  if (isPlainObject(baseAlert?.threshold) || isPlainObject(overrideAlert?.threshold)) {
    merged.threshold = {
      ...(isPlainObject(baseAlert?.threshold) ? cloneValue(baseAlert.threshold) : {}),
      ...(isPlainObject(overrideAlert?.threshold) ? cloneValue(overrideAlert.threshold) : {})
    };
  }

  delete merged.template_id;
  delete merged.requires_checkpoint_id;

  return merged;
}

function pushError(errors, message) {
  errors.push(message);
}

export async function readScenarioContract() {
  const fileText = await fs.readFile(scenarioContractPath, 'utf8');
  const parsed = YAML.parse(fileText);

  if (!isPlainObject(parsed)) {
    throw new Error('monitoring/scenario-contract.yaml must parse to an object.');
  }

  return parsed;
}

function buildCompiledPolicy(contract, scenario, errors) {
  const pathLabel = `scenarios[${scenario.scenario_id}]`;

  if (typeof scenario.scenario_id !== 'string' || scenario.scenario_id.trim().length === 0) {
    pushError(errors, `${pathLabel}.scenario_id must be a non-empty string.`);
    return null;
  }

  if (!ALLOWED_CRITICALITY.has(scenario.criticality)) {
    pushError(errors, `${pathLabel}.criticality must be one of: ${[...ALLOWED_CRITICALITY].join(', ')}.`);
  }

  if (!isPlainObject(scenario.runtime)) {
    pushError(errors, `${pathLabel}.runtime must be an object.`);
    return null;
  }

  if (!ALLOWED_READINESS.has(scenario.runtime.readiness)) {
    pushError(errors, `${pathLabel}.runtime.readiness must be one of: ${[...ALLOWED_READINESS].join(', ')}.`);
  }

  if (typeof scenario.runtime.scenario_version !== 'string' || scenario.runtime.scenario_version.trim().length === 0) {
    pushError(errors, `${pathLabel}.runtime.scenario_version must be a non-empty string.`);
  }

  if (!Array.isArray(scenario.runtime.checkpoints) || scenario.runtime.checkpoints.length === 0) {
    pushError(errors, `${pathLabel}.runtime.checkpoints must contain at least one checkpoint.`);
    return null;
  }

  const checkpointIds = [];
  const checkpointIdSet = new Set();

  for (const [index, checkpoint] of scenario.runtime.checkpoints.entries()) {
    if (!isPlainObject(checkpoint) || typeof checkpoint.checkpoint_id !== 'string' || checkpoint.checkpoint_id.trim().length === 0) {
      pushError(errors, `${pathLabel}.runtime.checkpoints[${index}].checkpoint_id must be a non-empty string.`);
      continue;
    }

    if (checkpointIdSet.has(checkpoint.checkpoint_id)) {
      pushError(errors, `${pathLabel}.runtime.checkpoints contains duplicate checkpoint_id ${checkpoint.checkpoint_id}.`);
      continue;
    }

    checkpointIdSet.add(checkpoint.checkpoint_id);
    checkpointIds.push(checkpoint.checkpoint_id);
  }

  if (!isPlainObject(scenario.alerting) || typeof scenario.alerting.profile !== 'string') {
    pushError(errors, `${pathLabel}.alerting.profile must be a non-empty string.`);
    return null;
  }

  const profile = contract.defaults?.alert_profiles?.[scenario.alerting.profile];

  if (!isPlainObject(profile)) {
    pushError(errors, `${pathLabel}.alerting.profile references unknown profile ${scenario.alerting.profile}.`);
    return null;
  }

  const primaryAlert = mergeAlertDefinition(profile.primary_alert, scenario.alerting.overrides?.primary_alert);

  if (!contract.defaults?.route_refs?.[primaryAlert.route_ref]) {
    pushError(errors, `${pathLabel}.primary_alert.route_ref references unknown defaults.route_refs key ${primaryAlert.route_ref}.`);
  }

  const supportingTemplates = Array.isArray(profile.supporting_alert_templates)
    ? profile.supporting_alert_templates
    : [];
  const supportingTemplatesById = new Map();

  for (const [index, template] of supportingTemplates.entries()) {
    if (!isPlainObject(template) || typeof template.template_id !== 'string' || template.template_id.trim().length === 0) {
      pushError(errors, `${pathLabel}.profile.supporting_alert_templates[${index}].template_id must be a non-empty string.`);
      continue;
    }

    if (supportingTemplatesById.has(template.template_id)) {
      pushError(errors, `${pathLabel}.profile.supporting_alert_templates contains duplicate template_id ${template.template_id}.`);
      continue;
    }

    supportingTemplatesById.set(template.template_id, template);
  }

  const supportingOverrides = scenario.alerting?.overrides?.supporting_alerts;
  const supportingOverridesById = new Map();
  const supportingAlerts = [];

  if (supportingOverrides != null && !Array.isArray(supportingOverrides)) {
    pushError(errors, `${pathLabel}.alerting.overrides.supporting_alerts must be an array when provided.`);
  }

  if (Array.isArray(supportingOverrides)) {
    for (const [index, override] of supportingOverrides.entries()) {
      if (!isPlainObject(override) || typeof override.template_id !== 'string' || override.template_id.trim().length === 0) {
        pushError(errors, `${pathLabel}.alerting.overrides.supporting_alerts[${index}].template_id must be a non-empty string.`);
        continue;
      }

      if (supportingOverridesById.has(override.template_id)) {
        pushError(errors, `${pathLabel}.alerting.overrides.supporting_alerts contains duplicate template_id ${override.template_id}.`);
        continue;
      }

      if (!supportingTemplatesById.has(override.template_id)) {
        pushError(errors, `${pathLabel}.alerting.overrides.supporting_alerts[${index}] references unknown template_id ${override.template_id}.`);
        continue;
      }

      supportingOverridesById.set(override.template_id, override);
    }
  }

  for (const [index, template] of supportingTemplates.entries()) {
    const override = supportingOverridesById.get(template.template_id) ?? {};

    if (template.requires_checkpoint_id && (typeof override.checkpoint_id !== 'string' || override.checkpoint_id.trim().length === 0)) {
      pushError(errors, `${pathLabel}.alerting.overrides.supporting_alerts must provide checkpoint_id for template ${template.template_id}.`);
      continue;
    }

    if (typeof override.checkpoint_id === 'string' && !checkpointIdSet.has(override.checkpoint_id)) {
      pushError(errors, `${pathLabel}.alerting.overrides.supporting_alerts checkpoint_id references unknown checkpoint ${override.checkpoint_id}.`);
      continue;
    }

    const compiledAlert = mergeAlertDefinition(template, override);

    if (!contract.defaults?.route_refs?.[compiledAlert.route_ref]) {
      pushError(errors, `${pathLabel}.supporting_alerts[${index}].route_ref references unknown defaults.route_refs key ${compiledAlert.route_ref}.`);
    }

    supportingAlerts.push(compiledAlert);
  }

  return {
    scenario_id: scenario.scenario_id,
    criticality: scenario.criticality,
    readiness: scenario.runtime.readiness,
    runtime_binding: {
      scenario_id: scenario.scenario_id,
      scenario_version: scenario.runtime.scenario_version,
      checkpoint_ids: checkpointIds
    },
    primary_alert: primaryAlert,
    supporting_alerts: supportingAlerts
  };
}

export function compileAlertPolicies(contract) {
  const errors = [];

  if (contract.schema_version !== 1) {
    pushError(errors, 'monitoring/scenario-contract.yaml schema_version must be 1.');
  }

  if (!isPlainObject(contract.defaults)) {
    pushError(errors, 'monitoring/scenario-contract.yaml defaults must be an object.');
  }

  if (!isPlainObject(contract.defaults?.route_refs)) {
    pushError(errors, 'monitoring/scenario-contract.yaml defaults.route_refs must be an object.');
  }

  if (!isPlainObject(contract.defaults?.alert_profiles)) {
    pushError(errors, 'monitoring/scenario-contract.yaml defaults.alert_profiles must be an object.');
  }

  const scenarios = Array.isArray(contract.scenarios) ? contract.scenarios : [];

  if (scenarios.length === 0) {
    pushError(errors, 'monitoring/scenario-contract.yaml must define at least one scenario.');
  }

  const compiledScenarios = [];
  const seenScenarioIds = new Set();

  for (const scenario of scenarios) {
    if (!isPlainObject(scenario)) {
      pushError(errors, 'Each scenario contract entry must be an object.');
      continue;
    }

    if (typeof scenario.scenario_id === 'string') {
      if (seenScenarioIds.has(scenario.scenario_id)) {
        pushError(errors, `Duplicate scenario_id in monitoring/scenario-contract.yaml: ${scenario.scenario_id}.`);
        continue;
      }

      seenScenarioIds.add(scenario.scenario_id);
    }

    const compiledScenario = buildCompiledPolicy(contract, scenario, errors);

    if (compiledScenario) {
      compiledScenarios.push(compiledScenario);
    }
  }

  return {
    errors,
    alertPolicies: {
      schema_version: contract.schema_version,
      defaults: {
        deployable_readiness_states: Array.isArray(contract.defaults?.deployable_readiness_states)
          ? cloneValue(contract.defaults.deployable_readiness_states)
          : ['deployable'],
        route_refs: cloneValue(contract.defaults?.route_refs ?? {})
      },
      scenarios: compiledScenarios
    }
  };
}

export function formatAlertPolicies(alertPolicies) {
  return YAML.stringify(alertPolicies);
}