# Implementation Plan: Scenario Monitoring

**Branch**: `main` | **Date**: 2026-05-23 | **Spec**: `/specs/004-scenario-monitoring/spec.md`
**Input**: Feature specification from `/specs/004-scenario-monitoring/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/plan-template.md` for the execution workflow.

## Summary

Define a scenario-first monitoring layer for Inlinr by turning the operational scenarios in `monitoring/monitoring-scenarios.md` into a stable registry, emitting sanitized scenario/checkpoint/result/dependency/failure telemetry from the extension-host boundary, and mapping that vendor-neutral contract to Azure Application Insights as the default backend. Keep the semantic contract independent of Azure-specific table names, use Application Insights-compatible telemetry types and Azure Monitor alert rules for storage and alerting, and ensure that telemetry never includes document content, prompts, model responses, file paths, or other sensitive request material.

## Technical Context

**Language/Version**: TypeScript 5.8.x for the VS Code extension host and Markdown documentation artifacts  
**Primary Dependencies**: `vscode` API (`^1.90.0`), existing session/editor/request modules, Mocha, `@vscode/test-cli`, `@vscode/test-electron`, and an Azure Monitor/Application Insights-compatible Node telemetry sink behind a local adapter boundary; prefer `@azure/monitor-opentelemetry` if an Azure sink is added in this slice  
**Storage**: N/A for persisted product state; telemetry is emitted to an optional external Azure Application Insights / Log Analytics resource when configured, otherwise the sink remains local no-op or recording-only  
**Testing**: `npm run compile`, `npm run test:unit`, `npm run test:integration`, focused manual verification in the Extension Development Host, and document-level review of telemetry/privacy contracts  
**Target Platform**: VS Code Desktop extension host on Windows, macOS, and Linux local workspaces, with Azure Monitor / Application Insights as the initial monitoring backend  
**Project Type**: Single VS Code desktop extension with extension-host services, a custom editor webview, and new telemetry/monitoring support modules  
**Performance Goals**: Telemetry emission must be asynchronous and add no user-visible delay to viewer open, popup open, request submit, apply, reject, or failure recovery flows; hot-path instrumentation should stay effectively immediate for typical local extension interactions  
**Constraints**: Emit telemetry only from the extension-host boundary; emit at scenario boundaries and checkpoints rather than every UI state change; produce at most one terminal result event per scenario attempt; use Application Insights-compatible telemetry categories and correlation fields; store no raw Markdown, selected text, prompts, model responses, file paths, or secrets in telemetry; if Azure configuration is absent or invalid, monitoring must fail closed for telemetry and fail open for editing  
**Scale/Scope**: Cover the current eight monitoring scenarios and provide an extension pattern for future scenarios, with one scenario registry, one shared telemetry contract, one default Azure mapping, and alert definitions that distinguish `core` from `important` scenarios

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- [x] The feature monitors existing selection-scoped user journeys without expanding the underlying editing scope; the architecture source of truth already documents the Telemetry and Monitoring Adapter boundary.
- [x] The user review and apply flow remains mandatory for material document changes because this feature only observes and alerts on existing editing behavior.
- [x] Provider, logging, and persistence boundaries minimize document exposure: telemetry is extension-host only, vendor-neutral, and explicitly excludes document content, prompts, model responses, file paths, and secrets.
- [x] Command, provider, suggestion, and edit-application contracts will be complemented by a telemetry contract, scenario registry contract, and sink-mapping rules with runtime validation at the instrumentation boundary.
- [x] Tests and manual verification will cover telemetry sanitization, one-terminal-result enforcement, checkpoint sequencing, alert classification, and non-regression of existing editing flows.
- [x] No new ADR is required for this slice because the architecture update is already captured in `architecture/high-level-architecture.md` and the feature introduces no new provider abstraction, persisted workspace state, or background workflow beyond the documented telemetry boundary.

**Post-Phase 1 Re-check**: Pass. The research, data model, contract, and quickstart artifacts keep the monitoring model scenario-first, extension-host-owned, privacy-minimized, and aligned with the existing VS Code extension architecture and Azure/Application Insights backend direction.

## Project Structure

### Documentation (this feature)

```text
specs/004-scenario-monitoring/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── scenario-monitoring-contract.md
└── tasks.md
```

### Source Code (repository root)

```text
package.json
src/
├── extension.ts
├── editors/
│   └── markdownCustomEditorProvider.ts
├── sessions/
│   └── documentSessionController.ts
├── webview/
│   ├── viewerProtocol.ts
│   └── viewerState.ts
└── telemetry/
    ├── applicationInsightsSink.ts
    ├── scenarioRegistry.ts
    ├── telemetryAdapter.ts
    ├── telemetryContract.ts
    └── telemetrySanitizer.ts

monitoring/
├── monitoring-scenarios.md
└── telemetry-guidelines.md

tests/
├── integration/
│   ├── helpers.ts
│   └── telemetryMonitoring.test.ts
└── unit/
    ├── telemetryAdapter.test.ts
    ├── telemetrySanitizer.test.ts
    └── scenarioRegistry.test.ts
```

**Structure Decision**: Extend the existing root-level VS Code extension rather than adding a separate monitoring service. Keep the scenario registry, telemetry contract, sanitizer, and sink abstraction under a new `src/telemetry/` boundary in the extension host; wire provider-owned scenario transitions through that boundary from existing editor/session modules; keep operational source-of-truth docs in `monitoring/`; and validate the feature through focused unit and integration tests in the existing `tests/` layout.

## Complexity Tracking

No constitution deviations are required. The feature introduces a documented telemetry boundary but does not expand editing scope, weaken review-before-apply, or broaden data exposure beyond the already approved monitoring architecture update.
