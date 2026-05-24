# ADR 005: Repo-Owned Monitoring Alert Management

## Status

Accepted

## Context

Inlinr's monitoring model is already scenario-first and repo-owned at the telemetry layer.

- [monitoring/monitoring-scenarios.md](../monitoring/monitoring-scenarios.md) defines the user-visible journeys that matter operationally.
- [monitoring/telemetry-guidelines.md](../monitoring/telemetry-guidelines.md) defines how those journeys map to telemetry and alert posture.
- [src/telemetry/scenarioRegistry.ts](../src/telemetry/scenarioRegistry.ts) defines the runtime scenario identifiers and checkpoint structure.
    
The remaining gap is how Azure Monitor and Application Insights alert resources should be managed over time.

The project does not want humans maintaining alert rules manually in the Azure portal. The expected operating model is that AI agents and GitHub Actions update monitoring configuration by reading repo-owned monitoring definitions and reconciling Azure to that intent.

That creates a bounded architectural decision with lasting consequences:

- what the system of record for alert definitions is
- whether agents write Azure resources directly or through workflows
- whether Azure alert resources are managed declaratively or imperatively
- how drift between repo intent and Azure configuration is prevented

## Decision

Manage monitoring alerts as repo-owned declarative infrastructure, deployed to Azure by workflows, not by manual portal edits.

The control model is:

1. Monitoring meaning stays in repo source files.
2. Agents update repo-owned monitoring definitions, not Azure resources directly.
3. GitHub Actions validates those definitions, generates Azure alert resources, and deploys them.
4. Azure is treated as a reconciled target, not the authoring surface.

### Document hierarchy and flow

The repo should have one clear monitoring hierarchy.

| Layer | File | Purpose | Derived from |
|---|---|---|---|
| Product journeys | product source docs and current code paths | Define the user journeys that matter to the product. | Product direction and implementation reality |
| Operational monitoring scenarios | [monitoring/monitoring-scenarios.md](../monitoring/monitoring-scenarios.md) | Capture which journeys must be monitored and at what criticality. | Product journeys plus current code paths |
| Telemetry pattern | [monitoring/telemetry-guidelines.md](../monitoring/telemetry-guidelines.md) | Define how monitored scenarios map to telemetry, failure classes, and alerting concepts. | Monitoring scenarios |
| Alert intent | `monitoring/alert-policies.yaml` | Define the intended alert posture for each monitored business scenario in a machine-readable form. This is the alert-intent file. | Monitoring scenarios plus telemetry guidelines |
| Runtime emitted scenarios | [src/telemetry/scenarioRegistry.ts](../src/telemetry/scenarioRegistry.ts) | Define the scenario IDs and checkpoints the extension actually emits at runtime for scenarios that are already instrumented. | Monitoring scenarios plus telemetry guidelines |
| Deployable Azure infrastructure | `infra/monitoring/` | Render alert intent into Bicep modules, parameters, and deployment artifacts. | Alert intent |
| Applied Azure state | Azure Monitor and Application Insights resources | The deployed alert rules, action groups, and related monitoring resources. | Workflow deployment from repo artifacts |

The flow is therefore:

1. Agents derive [monitoring/monitoring-scenarios.md](../monitoring/monitoring-scenarios.md) from product intent and actual code paths.
2. [monitoring/telemetry-guidelines.md](../monitoring/telemetry-guidelines.md) defines the technical monitoring pattern for those scenarios.
3. `monitoring/alert-policies.yaml` captures the intended alert posture for those monitored business scenarios, even if runtime instrumentation is not complete yet.
4. [src/telemetry/scenarioRegistry.ts](../src/telemetry/scenarioRegistry.ts) defines the runtime-emitted scenario IDs and checkpoints for scenarios that are implemented in code.
5. `infra/monitoring/` converts the deployable subset of alert intent into Bicep deployment artifacts.
6. GitHub Actions validates, generates, deploys, and verifies Azure resources.

This means:

- [monitoring/monitoring-scenarios.md](../monitoring/monitoring-scenarios.md) says what should be monitored.
- [monitoring/telemetry-guidelines.md](../monitoring/telemetry-guidelines.md) says how to express that monitoring technically.
- `monitoring/alert-policies.yaml` says what the intended alert posture is for each monitored business scenario.
- [src/telemetry/scenarioRegistry.ts](../src/telemetry/scenarioRegistry.ts) says what the runtime actually emits today.

[monitoring/alert-policies.yaml](../monitoring/alert-policies.yaml) is the concrete repo artifact that captures alert intent.

The precedence is therefore:

1. Business monitoring need comes first.
2. Alert intent may be added as soon as that need is recognized.
3. Runtime registry entries are added when the scenario is actually instrumented in code.
4. Azure deployment should only include alert intent entries that are marked deployable for the current runtime state.

### Alert intent object

The repo-owned alert layer should not be implied only by prose. It should be represented by an explicit machine-readable object per monitored business scenario in [monitoring/alert-policies.yaml](../monitoring/alert-policies.yaml).

The minimum deployable shape is:

```yaml
scenario_id: submit_request_receive_review
criticality: core
readiness: instrumented
runtime_binding:
	scenario_id: submit_request_receive_review
	checkpoint_ids:
		- request_submitted
		- pending_visible
primary_alert:
	kind: scheduled_query
	signal_type: real_user_failure_rate
	severity: page
	window: PT15M
	evaluation_frequency: PT5M
	threshold:
		min_failures: 3
		min_volume: 10
supporting_alerts:
	- kind: scheduled_query
		signal_type: checkpoint_spike
		checkpoint_id: pending_visible
		severity: non_paging
```

Each alert intent object should capture, at minimum:

- `scenario_id`
- `criticality`
- `readiness` such as `planned`, `instrumented`, `deployable`, or `retired`
- optional `runtime_binding` to a concrete runtime scenario ID and checkpoint set
- `primary_alert`
- `supporting_alerts`
- `signal_type`
- `severity`
- `rule_kind` or deployable alert kind
- evaluation window and frequency
- threshold summary or structured threshold values
- action group or routing target reference

[monitoring/alert-policies.yaml](../monitoring/alert-policies.yaml) is the source of truth for alert intent. Runtime telemetry code is the source of truth for what is currently instrumented. Deployment should be driven from the subset of alert intent entries that are both intended and runtime-ready.

### Deployment model

- Use Bicep as the default Azure infrastructure format for alert resources.
- Store alert modules and parameters in a repo-owned infrastructure path, for example `infra/monitoring/`.
- Deploy Azure resources through GitHub Actions using Azure OIDC and least-privilege permissions.
- Prefer deterministic generation and idempotent deployment so agents can change monitoring intent through pull requests.

### Recommended workflow stages

The default workflow sequence should be explicit so agents and maintainers follow the same control path.

Recommended stages:

1. `monitoring-validate`
	- Parse monitoring scenarios, scenario registry, and alert intent.
	- Fail if any core scenario lacks a primary alert definition.
	- Fail if any deployable alert references an unknown runtime scenario ID, checkpoint ID, or unsupported signal type.
	- Allow non-deployable alert intent entries to exist before runtime instrumentation is complete.
2. `monitoring-generate`
	- Generate or refresh Bicep parameters or generated deployment artifacts from the deployable subset of the alert intent layer.
	- Fail if generated output is stale relative to committed source files.
3. `monitoring-deploy-dev`
	- Deploy alerts to a non-production Azure target for smoke validation.
4. `monitoring-deploy-prod`
	- Deploy alerts to the production monitoring resource after protected-environment approval or equivalent branch protection.
5. `monitoring-verify`
	- Run post-deploy Azure queries or smoke checks to confirm expected rules exist and are scoped to the intended Application Insights component or workspace.

This workflow sequence is part of the decision. Agents are expected to work through repo changes that feed these stages rather than treating Azure as the authoring interface.

### Azure resources in scope

The workflow-managed layer should own:

- `Microsoft.Insights/scheduledQueryRules`
- `Microsoft.Insights/metricAlerts`
- `Microsoft.Insights/actionGroups`

For Inlinr, scheduled query rules are expected to be the primary alert mechanism because scenario health is defined mainly through `customEvents`, `dependencies`, and `exceptions` rather than platform request metrics.

### Agent operating rules

- Agents should edit monitoring definitions and alert intent in the repo.
- Agents should not make ad hoc portal changes part of the normal control model.
- Agents may use Azure CLI or similar tools for validation, smoke checks, or emergency investigation, but durable changes should be represented in repo-owned declarative files.
- CI should fail if core scenarios do not have corresponding alert intent or if deployable artifacts drift from source monitoring definitions.

## Consequences

- Monitoring configuration becomes reviewable, diffable, and reproducible.
- Alert changes can be derived from code and scenario definitions rather than tribal knowledge.
- AI agents gain a safe operating model: edit repo files, let workflows validate and deploy.
- The Azure portal stops being the system of record for monitoring posture.
- Additional tooling is required to validate repo intent, generate deployable artifacts, and detect drift.
- The project must define a machine-readable alert intent layer rather than relying only on prose guidance.
- Production workflow permissions and environment protections become part of the monitoring architecture.

## Alternatives considered

### Raw ARM templates

Viable, but less maintainable for humans and agents than Bicep. Bicep still compiles to ARM while providing a more readable and easier-to-review authoring model.

### Terraform

Reasonable if the broader Azure estate is already Terraform-first. It is not the default choice here because the current problem is narrowly Azure-specific and the repo does not already establish Terraform as the infrastructure standard.

### Imperative Azure CLI or SDK updates from agents

Useful for diagnostics and validation, but not as the long-term control plane. Imperative updates are harder to diff, harder to review, and more likely to drift from repo intent.

### Manual Azure portal management

Rejected. The desired operating model is explicitly repo-driven and workflow-managed, with agents and automation reconciling Azure from code and scenario definitions.

## Related documents

- [monitoring/monitoring-scenarios.md](../monitoring/monitoring-scenarios.md)
- [monitoring/telemetry-guidelines.md](../monitoring/telemetry-guidelines.md)
- [architecture/high-level-architecture.md](./high-level-architecture.md)
- [specs/004-scenario-monitoring/plan.md](../specs/004-scenario-monitoring/plan.md)