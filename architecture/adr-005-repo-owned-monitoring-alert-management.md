# ADR 005: Contract-Driven Monitoring Automation

## Status

Accepted

## Context

Inlinr already has real monitoring artifacts in the repository, but they currently sit at different abstraction levels.

- [monitoring/monitoring-scenarios.md](../monitoring/monitoring-scenarios.md) is the readable operational scenario catalog.
- [monitoring/scenario-contract.yaml](../monitoring/scenario-contract.yaml) is the canonical machine-readable monitoring contract.
- [monitoring/telemetry-guidelines.md](../monitoring/telemetry-guidelines.md) defines telemetry and alerting rules.
- [src/telemetry/scenarioRegistry.ts](../src/telemetry/scenarioRegistry.ts) defines what the runtime actually emits today.
- [tools/monitoring/generate-monitoring-artifacts.mjs](../tools/monitoring/generate-monitoring-artifacts.mjs) and [infra/monitoring/main.bicep](../infra/monitoring/main.bicep) deploy Azure monitoring resources.
- [.github/workflows/monitoring-scenarios.md](../.github/workflows/monitoring-scenarios.md) is an existing LLM workflow that maintains the readable monitoring scenario catalog from code, issues, pull requests, and product context.
- [.github/workflows/monitoring-contract.md](../.github/workflows/monitoring-contract.md) is an existing LLM workflow that maintains the canonical monitoring contract from current implementation, monitoring scenarios, and telemetry policy.
- [.github/workflows/monitoring-telemetry.md](../.github/workflows/monitoring-telemetry.md) is an existing LLM workflow that proposes runtime telemetry implementation changes when contract-aligned instrumentation is missing or stale.

That is enough to deploy alerts, but it is not the cleanest long-term operating model for AI-assisted monitoring.

The structural problem is drift:

1. the readable scenario catalog can drift from machine-readable alert intent
2. alert intent can drift from runtime instrumentation
3. an agent that discovers a new scenario still has to coordinate multiple artifacts manually

The desired future state is simpler:

1. one human-readable business and operations view
2. one machine-readable monitoring contract
3. deterministic generation of runtime and alert deployment artifacts from that contract
4. production deployment through workflows, not portal edits

## Decision

Adopt a contract-driven monitoring model.

The control model is:

1. [monitoring/monitoring-scenarios.md](../monitoring/monitoring-scenarios.md) remains the human-readable business and operations view.
2. A machine-readable scenario contract becomes the canonical automation source of truth.
3. Runtime instrumentation and deployable alert artifacts are derived from that contract, with reviewable code and generated outputs committed in the repo.
4. GitHub Actions validates and generates monitoring artifacts on monitoring changes, and the release workflow deploys and verifies production Azure monitoring resources.
5. Azure remains a reconciled target, not an authoring surface.

This means the readable scenario catalog is for human understanding, while the contract is for automation.

## Why This Replaces The Previous Shape

The repository does need structured alert semantics somewhere. It does not need those semantics to live forever in a separately hand-maintained alert-intent file.

Under this decision:

1. the readable markdown scenario catalog is not the only machine-driving artifact
2. the machine-readable contract is the automation source of truth
3. deployable alert artifacts are derived directly from the contract rather than through a separately maintained intermediate alert-intent file

## Artifact Roles

| Artifact | Current or target role | Primary writer | Primary readers | Meaning | Example content |
|---|---|---|---|---|---|
| [product/user-scenarios.md](../product/user-scenarios.md) | Existing input | Humans | Scenario discovery agents, product reviewers | Product-level user journeys and expected product behavior | A user selects Markdown and requests an inline edit |
| [.github/workflows/monitoring-scenarios.md](../.github/workflows/monitoring-scenarios.md) | Existing agent workflow prompt | Humans | GitHub Actions agent runtime | Instructions for the scenario discovery agent | Read code, issues, PRs, and update the scenario catalog |
| [monitoring/monitoring-scenarios.md](../monitoring/monitoring-scenarios.md) | Existing readable business and operations view | Scenario discovery agent, humans | Humans, contract curation agent | Human-readable monitoring scenarios and checkpoints | Apply a suggested change into the document |
| [monitoring/telemetry-guidelines.md](../monitoring/telemetry-guidelines.md) | Existing technical policy | Humans | Contract curation agent, telemetry implementation agent, generators | Rules for telemetry event shape, failure classes, and alerting semantics | scenario_result, checkpoint_spike, blocked_safe |
| [monitoring/scenario-contract.yaml](../monitoring/scenario-contract.yaml) | Existing canonical automation source | Contract curation agent, humans | Telemetry implementation agent, alert compiler, validators | Structured scenario definition that combines business meaning, runtime expectations, and alert profile selection | scenario_id, criticality, checkpoints, readiness, alert profile |
| [src/telemetry/scenarioRegistry.ts](../src/telemetry/scenarioRegistry.ts) | Existing runtime registry | Telemetry implementation agent, humans | Runtime code, validators, tests | What the extension actually emits at runtime today | load_markdown_preview, checkpoint ordering, primaryAlert |
| Runtime instrumentation call sites in [src/editors/markdownCustomEditorProvider.ts](../src/editors/markdownCustomEditorProvider.ts) and [src/extension.ts](../src/extension.ts) | Existing runtime behavior | Telemetry implementation agent, humans | Runtime extension host | The code that emits scenario, checkpoint, dependency, and exception events | startScenarioAttempt, emitScenarioCheckpoint, completeScenarioAttempt |
| [.github/workflows/monitoring-contract.md](../.github/workflows/monitoring-contract.md) | Existing contract curation workflow | Humans | GitHub Actions agent runtime | Maintains the canonical contract from runtime behavior, readable scenarios, and telemetry policy | Update `monitoring/scenario-contract.yaml` without editing runtime code |
| [.github/workflows/monitoring-telemetry.md](../.github/workflows/monitoring-telemetry.md) | Existing runtime telemetry implementation workflow | Humans | GitHub Actions agent runtime | Maintains runtime telemetry code and tests so emitted behavior satisfies the contract | Update `src/telemetry/scenarioRegistry.ts`, emission call sites, and tests |
| [infra/monitoring/generated/alert-policies.generated.json](../infra/monitoring/generated/alert-policies.generated.json) | Existing generated deployment input | Generator | Bicep template, verification workflow | Concrete deployable alert rules derived from monitoring intent | 19 scheduled query rule definitions |
| [infra/monitoring/main.bicep](../infra/monitoring/main.bicep) | Existing deploy template | Humans, generator-adjacent maintainers | Release workflow, Azure | Declarative Azure resource deployment for action groups and scheduled query rules | Microsoft.Insights/actionGroups, scheduledQueryRules |
| [.github/workflows/monitoring-alerts.yml](../.github/workflows/monitoring-alerts.yml) | Existing validation and optional dev path | Humans | GitHub Actions | Validate and generate monitoring artifacts on monitoring changes; optional dev deployment path | monitoring-validate, monitoring-generate, monitoring-deploy-dev |
| [.github/workflows/release.yml](../.github/workflows/release.yml) | Existing prod deploy path | Humans | GitHub Actions | Build, test, package, deploy prod monitoring, verify, then publish | monitoring-deploy-prod, monitoring-verify-prod |
| Azure Monitor resources | Existing reconciled target | Release workflow | Operators, investigators | Actual action groups and scheduled query rules in production | ag-inlinr-pager-core-prod, prod-inlinr-* |

## End-To-End Flow

| Step | Actor | Reads | Writes | Why this artifact exists | Example |
|---|---|---|---|---|---|
| 1 | Humans and product context | [product/user-scenarios.md](../product/user-scenarios.md), issues, incidents, roadmap | Product changes, issue reports, specs | Define what users depend on and what changed | A new editing recovery case becomes important after an incident |
| 2 | Scenario discovery agent from [.github/workflows/monitoring-scenarios.md](../.github/workflows/monitoring-scenarios.md) | current implementation, issues, pull requests, specs, product docs | [monitoring/monitoring-scenarios.md](../monitoring/monitoring-scenarios.md) | Keep a crisp human-readable catalog of what operations must be monitored | Add a scenario such as Keep the document unchanged when execution or targeting fails |
| 3 | Contract curation agent from [.github/workflows/monitoring-contract.md](../.github/workflows/monitoring-contract.md) or human reviewer | [monitoring/monitoring-scenarios.md](../monitoring/monitoring-scenarios.md), [monitoring/telemetry-guidelines.md](../monitoring/telemetry-guidelines.md), [src/telemetry/scenarioRegistry.ts](../src/telemetry/scenarioRegistry.ts) | [monitoring/scenario-contract.yaml](../monitoring/scenario-contract.yaml) | Convert readable business scenarios into structured automation inputs | Pick criticality, runtime readiness, alert profile, checkpoint metadata |
| 4 | Telemetry implementation agent from [.github/workflows/monitoring-telemetry.md](../.github/workflows/monitoring-telemetry.md) | [monitoring/scenario-contract.yaml](../monitoring/scenario-contract.yaml), [src/telemetry/scenarioRegistry.ts](../src/telemetry/scenarioRegistry.ts), runtime code | [src/telemetry/scenarioRegistry.ts](../src/telemetry/scenarioRegistry.ts), instrumentation call sites, tests | Make runtime behavior actually emit the intended scenario and checkpoint events | Add checkpoint review_apply_blocked and instrument the failure path |
| 5 | Alert compiler or generator | Machine-readable scenario contract and [monitoring/telemetry-guidelines.md](../monitoring/telemetry-guidelines.md) | [infra/monitoring/generated/alert-policies.generated.json](../infra/monitoring/generated/alert-policies.generated.json) | Produce deterministic deployable alert definitions from the contract | Derive a page-level synthetic alert and a non-paging checkpoint alert |
| 6 | Monitoring validation workflow in [.github/workflows/monitoring-alerts.yml](../.github/workflows/monitoring-alerts.yml) | readable scenario catalog, contract, runtime registry, generated alert artifacts | CI result only | Prevent drift across readable scenarios, contract, runtime, and deployable alerts | Fail when a checkpoint alert references a checkpoint the runtime does not emit |
| 7 | Optional dev monitoring deployment workflow | generated alert artifacts, [infra/monitoring/main.bicep](../infra/monitoring/main.bicep) | Azure dev resources | Smoke-test non-production monitoring changes before release when needed | Deploy action groups and rules into a dev resource group |
| 8 | Release workflow in [.github/workflows/release.yml](../.github/workflows/release.yml) | generated alert artifacts, [infra/monitoring/main.bicep](../infra/monitoring/main.bicep), release inputs | Azure production resources, release result | Reconcile production monitoring to the reviewed repo state before marketplace publication | Deploy and verify the full prod-inlinr-* rule set |
| 9 | Post-release tuning agent or human operator | live telemetry, alert history, incidents, Azure state | contract changes, threshold adjustments, scenario catalog updates | Improve signal quality without making the portal the source of truth | Reduce noisy checkpoint alerts from page to non-paging |

## Proposed Machine-Readable Scenario Contract

The target contract should combine business scenario identity, runtime telemetry requirements, and alert profile selection in one object per scenario.

Minimum shape:

```yaml
schema_version: 1

scenarios:
	- scenario_id: submit_request_receive_review
		title: Submit a request and receive inline review state
		criticality: core
		journey:
			start_condition: A user submits a request from the inline popup.
			success_condition: Pending feedback appears and a reviewable inline suggestion is rendered at the targeted location.
			safe_block_condition: Execution or targeting fails visibly and the document remains unchanged.
		runtime:
			readiness: deployable
			scenario_version: "1"
			owner_component: request_execution
			checkpoints:
				- checkpoint_id: request_submitted
					order: 1
					component: request_execution
				- checkpoint_id: pending_visible
					order: 2
					component: request_execution
					latency_sensitive: true
		telemetry:
			result_event: scenario_result
			safe_block_status: blocked_safe
			allowed_supporting_signals:
				- checkpoint
				- dependency
				- latency
				- exception
		alerting:
			profile: core_request_execution
			overrides:
				supporting_alerts:
					- template_id: latency
						checkpoint_id: pending_visible
```

This contract is the key change in this ADR. It allows one structured source to drive both runtime coverage and deployed alerting.

## Workflow Responsibilities

| Actor | What it should decide | What it should not decide |
|---|---|---|
| Scenario discovery agent | Which user-visible scenarios and checkpoints belong in the readable catalog | Final deployment thresholds or Azure resource details |
| Contract curation agent | Which scenarios are deployable, what alert profile applies, and what runtime coverage is required | Direct Azure mutations |
| Telemetry implementation agent | How code and runtime registry must change to satisfy the contract | Alert routing outside the contract |
| Alert compiler | Deterministic rendering of deployable alert artifacts | New business semantics |
| Release workflow | Whether reviewed monitoring changes can be deployed and verified in prod | New scenario meaning |

## Agent Matrix

This matrix is the intended closed-loop operating model. It identifies which actors already exist, which are still missing, and where approval is required.

| Actor | Status | Trigger | Reads | Writes | Files touched | Approval boundary |
|---|---|---|---|---|---|---|
| Scenario discovery agent | Existing | Scheduled run, monitoring-focused repo changes, issue and PR activity | [product/user-scenarios.md](../product/user-scenarios.md), current implementation, issues, pull requests, specs, [monitoring/telemetry-guidelines.md](../monitoring/telemetry-guidelines.md) | Updated readable scenario catalog | [monitoring/monitoring-scenarios.md](../monitoring/monitoring-scenarios.md) | Pull request review before merge |
| Contract curation agent | Existing | Scenario catalog changes, product behavior changes, incidents, monitoring review requests | [monitoring/monitoring-scenarios.md](../monitoring/monitoring-scenarios.md), [monitoring/telemetry-guidelines.md](../monitoring/telemetry-guidelines.md), runtime registry, incidents, current contract | Structured monitoring intent and deployability decisions | [.github/workflows/monitoring-contract.md](../.github/workflows/monitoring-contract.md), [monitoring/scenario-contract.yaml](../monitoring/scenario-contract.yaml) | Pull request review before merge |
| Telemetry implementation agent | Existing, initial | Contract changes that require new or changed runtime coverage | [monitoring/scenario-contract.yaml](../monitoring/scenario-contract.yaml), [src/telemetry/scenarioRegistry.ts](../src/telemetry/scenarioRegistry.ts), runtime code, current tests | Code patches for telemetry registry and instrumentation, plus tests | [.github/workflows/monitoring-telemetry.md](../.github/workflows/monitoring-telemetry.md), [src/telemetry/scenarioRegistry.ts](../src/telemetry/scenarioRegistry.ts), [src/editors/markdownCustomEditorProvider.ts](../src/editors/markdownCustomEditorProvider.ts), [src/extension.ts](../src/extension.ts), adjacent runtime ownership files under [src/](../src/), tests under [tests/](../tests/) | Pull request review plus executable validation |
| Alert compiler | Existing, deterministic | Contract changes on PRs, pushes, and release | Target contract, [monitoring/telemetry-guidelines.md](../monitoring/telemetry-guidelines.md) | Deployable alert artifacts | [infra/monitoring/generated/alert-policies.generated.json](../infra/monitoring/generated/alert-policies.generated.json) | No human judgment in the generation step; review happens on the source artifacts |
| Monitoring validation workflow | Existing | Monitoring pull requests, monitoring-related pushes, release preparation | Readable scenario catalog, target contract, runtime registry, generated artifacts | Validation result only | CI result only; no durable artifact change | Required CI pass before merge or release |
| Optional dev deployment workflow | Existing | Manual non-production validation request | Generated artifacts, [infra/monitoring/main.bicep](../infra/monitoring/main.bicep), dev environment configuration | Azure dev monitoring resources | Azure dev action groups and scheduled query rules | Environment approval and successful workflow run |
| Release workflow | Existing | Release workflow dispatch or tag-based release | Generated monitoring artifacts, [infra/monitoring/main.bicep](../infra/monitoring/main.bicep), release inputs, packaged extension | Azure production monitoring resources and marketplace publication result | Azure prod action groups and scheduled query rules, release artifacts | Protected environment approval and successful verification before publication |
| Post-release tuning agent | Missing | Incident review, false-positive review, new telemetry patterns, alert fatigue review | Live Azure telemetry, alert history, incidents, current contract, readable scenario catalog | Proposed threshold, severity, routing, or scenario changes | Target contract and [monitoring/monitoring-scenarios.md](../monitoring/monitoring-scenarios.md) | Pull request review before merge |

The loop is only fully closed when all of these are present:

1. a readable scenario updater
2. a contract writer
3. a telemetry implementation writer
4. deterministic alert compilation and deployment
5. a post-release tuning step that feeds production learnings back into repo-owned intent

At the current repo state, items 1 through 4 exist. Item 5 remains missing.

## Transition Plan

The repository should move in phases rather than rewrite everything at once.

### Phase 1 (complete)

Introduce the contract as the canonical machine-readable source while keeping the existing deploy path stable.

1. [monitoring/monitoring-scenarios.md](../monitoring/monitoring-scenarios.md) remains the readable business and operations view.
2. [monitoring/scenario-contract.yaml](../monitoring/scenario-contract.yaml) becomes the canonical machine-readable source.

### Phase 2 (complete)

Make validation and deployable artifact generation consume the contract directly.

### Phase 3 (partially complete)

Generate or validate [src/telemetry/scenarioRegistry.ts](../src/telemetry/scenarioRegistry.ts) from the contract and fail CI when runtime instrumentation does not satisfy contract requirements.

Current status:

1. `npm run monitoring:validate-runtime` validates the runtime registry against the contract.
2. Runtime instrumentation already exists in the extension host and is exercised by telemetry integration tests.
3. [.github/workflows/monitoring-telemetry.md](../.github/workflows/monitoring-telemetry.md) now provides the initial repo-owned telemetry implementation workflow for contract-to-runtime maintenance.
4. Post-release tuning from live Azure telemetry and alert history remains future work.

## Consequences

### Positive

1. The readable scenario catalog stays understandable to humans.
2. AI workflows have one structured artifact to update instead of juggling multiple independent machine-readable files.
3. Runtime telemetry and deployable alerts can be validated against the same contract.
4. Production Azure monitoring remains repo-driven and release-gated.

### Tradeoffs

1. The repository must introduce and maintain a new machine-readable contract artifact.
2. Contract compilers and validators become more important and must remain deterministic and reviewable.
3. Agents need explicit role boundaries so scenario discovery, telemetry implementation, and alert compilation do not silently collapse into one opaque step.

## Rejected Alternatives

### Keep separate hand-authored scenario markdown, runtime registry, and alert-policies forever

Rejected as the long-term target because it creates avoidable drift and forces agents to coordinate too many artifacts manually.

### Make readable markdown the only source of truth

Rejected because prose alone is not sufficient to drive runtime coverage validation or deterministic alert deployment.

### Author Azure resources directly from agents or the portal

Rejected because the repo, review process, and release workflow should remain the control plane.

## Related Documents

- [monitoring/monitoring-scenarios.md](../monitoring/monitoring-scenarios.md)
- [monitoring/scenario-contract.yaml](../monitoring/scenario-contract.yaml)
- [monitoring/telemetry-guidelines.md](../monitoring/telemetry-guidelines.md)
- [src/telemetry/scenarioRegistry.ts](../src/telemetry/scenarioRegistry.ts)
- [.github/workflows/monitoring-scenarios.md](../.github/workflows/monitoring-scenarios.md)
- [.github/workflows/monitoring-contract.md](../.github/workflows/monitoring-contract.md)
- [.github/workflows/monitoring-telemetry.md](../.github/workflows/monitoring-telemetry.md)
- [.github/workflows/monitoring-alerts.yml](../.github/workflows/monitoring-alerts.yml)
- [.github/workflows/release.yml](../.github/workflows/release.yml)
