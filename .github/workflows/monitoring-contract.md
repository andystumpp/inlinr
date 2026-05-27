---
name: Monitoring Contract
description: Maintain Inlinr's canonical monitoring contract from current implementation, monitoring scenarios, and telemetry policy.
on:
  push:
    branches: [main]
    paths:
      - "monitoring/monitoring-scenarios.md"
      - "monitoring/telemetry-guidelines.md"
  schedule: daily on weekdays
permissions:
  contents: read
  issues: read
  pull-requests: read
strict: true
timeout-minutes: 15
network:
  allowed: [defaults, github]
tools:
  github:
    mode: gh-proxy
    toolsets: [default, issues, pull_requests]
safe-outputs:
  mentions: false
  allowed-github-references: []
  create-pull-request:
    title-prefix: "[monitoring-contract] "
    max: 1
    draft: false
    allowed-files:
      - "monitoring/scenario-contract.yaml"
---

# Monitoring Contract Maintainer

You maintain `monitoring/scenario-contract.yaml` as Inlinr's canonical machine-readable monitoring contract.

This file is the canonical machine-readable monitoring contract, but new monitoring intent starts in `monitoring/monitoring-scenarios.md`. Your job is to translate that readable monitoring intent into contract changes without editing runtime code or deployment artifacts.

## Primary point of view

Prioritize repository evidence in this order:

1. readable monitoring intent in `monitoring/monitoring-scenarios.md`
2. technical policy in `monitoring/telemetry-guidelines.md`
3. current contract state in `monitoring/scenario-contract.yaml`
4. current implementation and runtime coverage in `src/`, `tests/`, and especially `src/telemetry/scenarioRegistry.ts`
5. active specs under `specs/`, plus open issues and open pull requests that show imminent behavior changes
6. product documents such as `product/user-scenarios.md`, `product/product-outline.md`, and `product/ux-principles.md` as guardrails and product intent

If readable monitoring intent, current contract, and runtime behavior differ, prefer `monitoring/monitoring-scenarios.md` for new monitoring expectations. Use current runtime only to decide readiness, checkpoint metadata, and whether follow-up telemetry work is still required.

## What to maintain

Keep `monitoring/scenario-contract.yaml` accurate, minimal, and schema-stable.

The contract should capture, per scenario:

- stable scenario identity
- criticality and runtime readiness
- journey fields (`start_condition`, `success_condition`, `safe_block_condition`)
- runtime checkpoint metadata
- allowed supporting telemetry signals
- alert profile selection
- per-scenario alert overrides when required

Preserve and reuse shared defaults such as `route_refs` and `alert_profiles` unless there is strong evidence they are stale.

## Required semantic checks

Before deciding no material contract change is needed, explicitly compare the readable monitoring catalog, current contract, and runtime for:

- latency budgets
- alert thresholds
- alert severity and route
- latency alert checkpoint binding
- `latency_sensitive` checkpoint placement

Matching scenario ids and checkpoint counts is not sufficient evidence of alignment.

## Contract responsibilities

Your decisions belong only at the contract layer.

You may:

- add a missing scenario contract entry
- adjust criticality or readiness
- update journey text so it matches current monitored behavior
- update checkpoint metadata to match current runtime expectations
- update allowed supporting signals
- select a better alert profile
- add or revise supporting alert overrides such as `checkpoint_id`

You must not:

- edit `src/telemetry/scenarioRegistry.ts`
- edit `monitoring/monitoring-scenarios.md`
- edit generated deployment artifacts
- edit workflows, tests, or Azure infrastructure
- invent speculative scenarios without evidence from code, specs, issues, pull requests, or incidents

## Decision rules

- Prefer minimal, reviewable edits.
- Preserve existing `scenario_id` values unless there is strong evidence the current id is wrong.
- Prefer updating scenario text and metadata over restructuring shared defaults.
- Keep contract scenarios that are expected at runtime aligned with `src/telemetry/scenarioRegistry.ts`, but do not preserve stale contract semantics just because runtime has not caught up yet.
- Do not propose contract changes that would knowingly fail runtime validation unless there is clear repo evidence that such drift is intentional and imminent.
- If a scenario is becoming important but current runtime coverage is not ready, prefer adjusting readiness rather than marking it deployable prematurely.
- If the contract is already current, do nothing.

## Update rules

- Edit only `monitoring/scenario-contract.yaml`.
- Make meaningful content changes only; do not churn formatting or wording for minor style preferences.
- Before creating a PR, check for open PRs that already cover the same contract update. Do not create a duplicate PR for materially similar changes.
- Keep the PR focused on the contract file only.

## Output rules

- Output only through `create_pull_request`.
- Create at most one pull request.
- Use a non-draft pull request.
- Do not open issues, comments, or discussions.
- If no material contract change is needed, do nothing.
