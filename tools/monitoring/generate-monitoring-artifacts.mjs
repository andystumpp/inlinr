import fs from 'node:fs/promises';
import {
  generatedAlertPoliciesPath,
  generatedArtifactsDir,
  validateAlertPolicies
} from './alertPolicyUtils.mjs';

function slugify(value) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120);
}

function escapeKustoString(value) {
  return String(value).replace(/'/g, "''");
}

function toAzureSeverity(severity) {
  switch (severity) {
    case 'page':
      return 0;
    case 'non_paging':
      return 2;
    default:
      return 3;
  }
}

function assertSupportedAlert(alert, policy) {
  if (alert.kind !== 'scheduled_query') {
    throw new Error(`Unsupported alert kind for ${policy.scenario_id}: ${alert.kind}.`);
  }

  if (alert.rule_kind !== 'log_search_alert') {
    throw new Error(`Unsupported rule_kind for ${policy.scenario_id}: ${alert.rule_kind}.`);
  }
}

function createScenarioResultFailureQuery(runtimeScenarioId) {
  const escapedScenarioId = escapeKustoString(runtimeScenarioId);
  return `customEvents
| where name == 'scenario_result'
| where tostring(customDimensions.scenarioId) == '${escapedScenarioId}'
| extend scenarioStatus = tostring(customDimensions.status)
| summarize totalSamples = count(), failedSamples = countif(scenarioStatus != 'success' and scenarioStatus != 'cancelled_user'), resourceId = any(_ResourceId)
| project _ResourceId = resourceId, totalSamples, failedSamples`;
}

function createCheckpointFailureQuery(runtimeScenarioId, checkpointId) {
  const escapedScenarioId = escapeKustoString(runtimeScenarioId);
  const escapedCheckpointId = escapeKustoString(checkpointId);
  return `customEvents
| where name == 'scenario_checkpoint'
| where tostring(customDimensions.scenarioId) == '${escapedScenarioId}'
| where tostring(customDimensions.checkpointId) == '${escapedCheckpointId}'
| extend checkpointStatus = tostring(customDimensions.status)
| summarize failureCount = countif(checkpointStatus != 'pass'), resourceId = any(_ResourceId)
| project _ResourceId = resourceId, metricValue = todouble(failureCount)`;
}

function createLatencyQuery(runtimeScenarioId, checkpointId, minimumSampleSize) {
  const escapedScenarioId = escapeKustoString(runtimeScenarioId);
  const escapedCheckpointId = escapeKustoString(checkpointId);
  return `customEvents
| where name == 'scenario_checkpoint'
| where tostring(customDimensions.scenarioId) == '${escapedScenarioId}'
| where tostring(customDimensions.checkpointId) == '${escapedCheckpointId}'
| summarize sampleSize = count(), p95DurationMs = percentile(todouble(customMeasurements.duration_ms), 95), resourceId = any(_ResourceId)
| extend metricValue = iff(sampleSize >= ${minimumSampleSize}, p95DurationMs, 0.0)
| project _ResourceId = resourceId, metricValue`;
}

function createExceptionQuery(runtimeScenarioId) {
  const escapedScenarioId = escapeKustoString(runtimeScenarioId);
  return `exceptions
| where tostring(customDimensions.scenarioId) == '${escapedScenarioId}'
| summarize exceptionCount = count(), resourceId = any(_ResourceId)
| project _ResourceId = resourceId, metricValue = todouble(exceptionCount)`;
}

function createScheduledQuerySpec(policy, alert, sourceLabel, sourceIndex) {
  assertSupportedAlert(alert, policy);

  const runtimeScenarioId = policy.runtime_binding.scenario_id;
  const checkpointId = alert.checkpoint_id;
  let query;
  let thresholdValue;
  let operator = 'GreaterThanOrEqual';

  switch (alert.signal_type) {
    case 'synthetic_availability': {
      query = `${createScenarioResultFailureQuery(runtimeScenarioId)}
| extend metricValue = iff(totalSamples >= ${alert.threshold.minimum_sample_size}, todouble(failedSamples), 0.0)
| project _ResourceId, metricValue`;
      thresholdValue = alert.threshold.consecutive_failures;
      break;
    }
    case 'real_user_failure_rate': {
      query = `${createScenarioResultFailureQuery(runtimeScenarioId)}
| extend metricValue = iff(totalSamples >= ${alert.threshold.minimum_sample_size}, (todouble(failedSamples) * 100.0) / todouble(totalSamples), 0.0)
| project _ResourceId, metricValue`;
      thresholdValue = alert.threshold.failure_rate_percent;
      break;
    }
    case 'latency': {
      query = createLatencyQuery(runtimeScenarioId, checkpointId, alert.threshold.minimum_sample_size);
      thresholdValue = alert.threshold.p95_duration_ms;
      break;
    }
    case 'checkpoint_spike': {
      query = createCheckpointFailureQuery(runtimeScenarioId, checkpointId);
      thresholdValue = alert.threshold.failure_count;
      break;
    }
    case 'exception_spike': {
      query = createExceptionQuery(runtimeScenarioId);
      thresholdValue = alert.threshold.failure_count;
      break;
    }
    default:
      throw new Error(`Unsupported signal type for ${policy.scenario_id}: ${alert.signal_type}.`);
  }

  const sourceKey = sourceLabel === 'primary' ? 'primary' : `supporting-${sourceIndex + 1}`;
  const displayName = `${policy.scenario_id} ${sourceKey} ${alert.signal_type}`;

  return {
    ruleKey: `${policy.scenario_id}:${sourceKey}`,
    nameSuffix: slugify(`${policy.scenario_id}-${sourceKey}-${alert.signal_type}`),
    displayName,
    description: `Repo-managed monitoring alert for ${policy.scenario_id} (${sourceKey}, ${alert.signal_type}).`,
    scenarioId: policy.scenario_id,
    runtimeScenarioId,
    criticality: policy.criticality,
    signalType: alert.signal_type,
    source: sourceKey,
    routeRef: alert.route_ref,
    severity: alert.severity,
    azureSeverity: toAzureSeverity(alert.severity),
    kind: 'LogAlert',
    evaluationFrequency: alert.evaluation_frequency,
    windowSize: alert.window,
    autoMitigate: true,
    timeAggregation: 'Maximum',
    metricMeasureColumn: 'metricValue',
    operator,
    threshold: thresholdValue,
    failingPeriods: {
      numberOfEvaluationPeriods: 1,
      minFailingPeriodsToAlert: 1
    },
    query
  };
}

function buildAlertRules(deployableScenarios) {
  const alertRules = [];

  for (const policy of deployableScenarios) {
    alertRules.push(createScheduledQuerySpec(policy, policy.primary_alert, 'primary', 0));

    for (const [index, alert] of policy.supporting_alerts.entries()) {
      alertRules.push(createScheduledQuerySpec(policy, alert, 'supporting', index));
    }
  }

  return alertRules;
}

async function main() {
  const result = await validateAlertPolicies();

  if (result.errors.length > 0) {
    for (const error of result.errors) {
      console.error(`Error: ${error}`);
    }

    process.exitCode = 1;
    return;
  }

  const alertRules = buildAlertRules(result.deployableScenarios);
  const routeRefs = Object.entries(result.routeRefs).map(([routeRef, route]) => ({
    routeRef,
    description: typeof route?.description === 'string' ? route.description : ''
  }));
  const requiredRouteRefs = [...new Set(alertRules.map((rule) => rule.routeRef))];

  await fs.mkdir(generatedArtifactsDir, { recursive: true });
  await fs.writeFile(
    generatedAlertPoliciesPath,
    `${JSON.stringify(
      {
        schemaVersion: result.alertPolicies.schema_version,
        generatedAt: new Date().toISOString(),
        deployableScenarios: result.deployableScenarios,
        routeRefs,
        requiredRouteRefs,
        alertRules
      },
      null,
      2
    )}\n`,
    'utf8'
  );

  console.log(`Generated ${generatedAlertPoliciesPath}`);
  console.log(`Prepared ${result.deployableScenarios.length} deployable monitoring scenarios.`);
  console.log(`Prepared ${alertRules.length} scheduled query rules across ${requiredRouteRefs.length} routing targets.`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : error);
  process.exitCode = 1;
});