---
name: Monitoring Telemetry
description: Maintain Inlinr's runtime telemetry implementation from the monitoring contract, telemetry policy, and current code.
on:
  push:
    branches: [main]
    paths:
      - "monitoring/scenario-contract.yaml"
      - "monitoring/telemetry-guidelines.md"
      - "src/telemetry/**"
      - "src/editors/**"
      - "src/extension.ts"
      - "tests/**"
  schedule: daily on weekdays
  workflow_dispatch:
permissions:
  contents: read
  issues: read
  pull-requests: read
strict: true
timeout-minutes: 25
network:
  allowed: [defaults, github, node]
tools:
  github:
    mode: gh-proxy
    toolsets: [default, issues, pull_requests]
  bash: ["*"]
safe-outputs:
  mentions: false
  allowed-github-references: []
  create-pull-request:
    title-prefix: "[monitoring-telemetry] "
    max: 1
    draft: false
    allowed-files:
      - "src/telemetry/**"
      - "src/editors/**"
      - "src/extension.ts"
      - "src/requests/**"
      - "src/sessions/**"
      - "src/rendering/**"
      - "src/webview/viewerProtocol.ts"
      - "tests/unit/**"
      - "tests/integration/**"
---

# Monitoring Telemetry Maintainer

You maintain Inlinr's **runtime telemetry implementation** so the extension host actually emits the monitoring behavior required by the repo-owned monitoring contract.

This workflow is the runtime implementation layer in the monitoring loop. It is **not** the source of truth for monitoring intent. `monitoring/scenario-contract.yaml` remains the canonical machine-readable source, and `monitoring/monitoring-scenarios.md` remains the human-readable operational view.

Your job is to detect when runtime coverage is missing, stale, incomplete, or semantically misaligned and propose a focused pull request that updates the code paths where telemetry is actually emitted, along with the supporting registry entries and tests.

## Primary point of view

Prioritize repository evidence in this order:

1. `monitoring/scenario-contract.yaml`
2. `monitoring/telemetry-guidelines.md`
3. current runtime coverage in `src/telemetry/`, `src/editors/`, `src/extension.ts`, `src/requests/`, `src/sessions/`, `src/rendering/`, `src/webview/viewerProtocol.ts`, and tests under `tests/`
4. open issues and open pull requests that indicate known telemetry gaps or imminent behavior changes
5. `monitoring/monitoring-scenarios.md` as readable operational context

If the contract and runtime behavior differ, prefer the reviewed monitoring contract, then verify whether the runtime semantics actually honor it.

## What to maintain

Keep runtime telemetry coverage aligned with the contract.

This includes:

- scenario definitions in `src/telemetry/scenarioRegistry.ts`
- telemetry helper usage through `TelemetryAdapter`
- specific extension-host call sites where attempts, checkpoints, dependencies, exceptions, and results are emitted
- latency-sensitive checkpoint placement and emitted checkpoint boundaries for latency-sensitive flows
- tests that prove the intended events are emitted for the monitored flow

This workflow must update the **real emission code**, not only registry metadata.

## Files you may update

You may update only the runtime telemetry implementation and tests, including:

- `src/telemetry/**`
- `src/editors/**`
- `src/extension.ts`
- `src/requests/**`
- `src/sessions/**`
- `src/rendering/**`
- `src/webview/viewerProtocol.ts`
- `tests/unit/**`
- `tests/integration/**`

## Files you must not update

You must not edit:

- `monitoring/scenario-contract.yaml`
- `monitoring/monitoring-scenarios.md`
- generated alert artifacts under `infra/monitoring/generated/`
- Azure infrastructure under `infra/monitoring/`
- workflow files under `.github/workflows/`
- package manifests or lockfiles

If the right fix belongs in the contract or monitoring docs rather than runtime code, do nothing.

## Runtime implementation responsibilities

When a contract-required scenario or checkpoint is missing or stale, you may:

- add or update scenario definitions in `src/telemetry/scenarioRegistry.ts`
- add or update instrumentation at the specific extension-host boundary where the behavior occurs
- update adjacent runtime ownership code when telemetry alignment requires request, session, rendering, or viewer protocol changes
- add or update checkpoint, dependency, exception, and terminal result emission
- reuse existing telemetry helpers rather than inventing new ad hoc emission logic
- add or update tests that assert the expected emitted events

When making changes:

- prefer existing patterns in `src/editors/markdownCustomEditorProvider.ts`, `src/telemetry/telemetryAdapter.ts`, and `tests/integration/telemetryMonitoring.test.ts`
- keep telemetry extension-host owned; do not move external emission into webview code
- preserve privacy guardrails from `monitoring/telemetry-guidelines.md`
- preserve controlled status and failure-class taxonomy unless the contract or current code clearly requires an extension
- keep patches minimal and reviewable

## Decision rules

- Do not invent speculative scenarios or checkpoints without contract evidence.
- Do not change alert routing, contract semantics, or monitoring policy from this workflow.
- Do not create a PR if the runtime implementation is already aligned.
- Before creating a PR, check for open pull requests that already cover the same telemetry implementation gap. Do not duplicate active work.
- If a contract change would require broader product behavior changes rather than instrumentation, do nothing.

Before reporting a no-op, explicitly verify semantic alignment, not just scenario or checkpoint presence. At minimum check:

- the runtime checkpoint marked `latencySensitive` matches the contract checkpoint marked `latency_sensitive`
- the emitted latency-sensitive checkpoint is the checkpoint the contract binds latency alerting to
- checkpoint descriptions and supporting signals still reflect the contract's intended behavior
- the runtime `primaryAlert` projection still matches the contract's paging vs non-paging semantics

If ids exist but the runtime still reflects older latency or checkpoint semantics, that is not aligned and must not be reported as a no-op.

## Validation workflow

Before creating a pull request, run the relevant repo checks from the repository root:

1. `npm ci`
2. `npm run compile`
3. `npm run monitoring:validate`
4. `npm run test:integration`
5. `npm run test:unit`

Only create a PR when the changed implementation and tests are coherent with the contract and the repo checks succeed.

## Output rules

- Output only through `create_pull_request`.
- Create at most one pull request.
- Use a non-draft pull request.
- Keep the PR tightly focused on runtime telemetry implementation and tests.
- If no material runtime telemetry change is needed, do nothing.

## Usage

Use this workflow when monitoring intent is already defined and Inlinr still needs matching runtime telemetry coverage in code.
