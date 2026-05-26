# Tasks: Scenario Monitoring

**Input**: Design documents from `/specs/004-scenario-monitoring/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, quickstart.md, contracts/scenario-monitoring-contract.md

**Tests**: Include automated coverage for telemetry contract validation, scenario registry rules, sanitization, provider-owned scenario sequencing, and Azure mapping fallback behavior. Keep manual quickstart verification for Azure ingestion and alert posture when a connection string is available.

**Organization**: Tasks are grouped by phase and user story so each story can be implemented and validated independently.

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Prepare the repository for a telemetry boundary and its test surface.

- [X] T001 Add the Azure Monitor dependency and telemetry-facing package metadata in package.json
- [X] T002 Create the telemetry module file set in src/telemetry/telemetryContract.ts, src/telemetry/telemetryAdapter.ts, src/telemetry/scenarioRegistry.ts, src/telemetry/telemetrySanitizer.ts, and src/telemetry/applicationInsightsSink.ts
- [X] T003 [P] Create telemetry test entry files in tests/unit/telemetryAdapter.test.ts, tests/unit/telemetrySanitizer.test.ts, tests/unit/scenarioRegistry.test.ts, and tests/integration/telemetryMonitoring.test.ts

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Establish the shared contracts, registry, sanitization, sink selection, and activation wiring required by every user story.

**⚠️ CRITICAL**: No user story work should begin until this phase is complete.

- [X] T004 Define the shared telemetry event, failure-class, and alert policy contracts in src/telemetry/telemetryContract.ts
- [X] T005 [P] Encode the current monitored scenarios, criticality, and checkpoint metadata in src/telemetry/scenarioRegistry.ts
- [X] T006 [P] Implement telemetry sanitization rules, bucket helpers, and prohibited-field filtering in src/telemetry/telemetrySanitizer.ts
- [X] T007 Implement no-op, recording, and Azure sink selection plus connection-string detection in src/telemetry/applicationInsightsSink.ts and src/telemetry/telemetryAdapter.ts
- [X] T008 Wire telemetry adapter creation and sink initialization into src/extension.ts
- [X] T009 Define shared recording-sink and adapter test helpers in tests/integration/helpers.ts

**Checkpoint**: The telemetry contract, scenario registry, sanitizer, sink abstraction, and activation wiring exist and all user stories can build on the same boundary.

---

## Phase 3: User Story 1 - Observe Scenario Health (Priority: P1) 🎯 MVP

**Goal**: Operators can observe the health of current monitored journeys through stable scenario attempts, ordered checkpoints, terminal outcomes, and correlated dependency or failure signals.

**Independent Test**: Trigger current monitored flows such as preview load, popup open, request submit, review, apply, reject, and failure recovery, then confirm the emitted telemetry shows one scenario attempt, ordered checkpoints, and exactly one terminal result per journey.

### Tests for User Story 1

- [X] T010 [P] [US1] Add unit coverage for scenario definitions and one-terminal-result enforcement in tests/unit/scenarioRegistry.test.ts and tests/unit/telemetryAdapter.test.ts
- [X] T011 [P] [US1] Add integration coverage for preview, popup, submit, review, apply, reject, and failure scenario sequencing in tests/integration/telemetryMonitoring.test.ts

### Implementation for User Story 1

- [X] T012 [US1] Implement scenario-attempt lifecycle tracking, checkpoint emission, and terminal-result enforcement in src/telemetry/telemetryAdapter.ts
- [X] T013 [US1] Instrument preview-load and render-failure scenarios in src/editors/markdownCustomEditorProvider.ts and src/webview/viewerState.ts
- [X] T014 [US1] Instrument popup-open, submit-to-review, apply, reject, and next-request-cycle scenarios in src/editors/markdownCustomEditorProvider.ts and src/sessions/documentSessionController.ts
- [X] T015 [US1] Emit dependency and exception telemetry for request execution outcomes in src/editors/markdownCustomEditorProvider.ts and src/telemetry/telemetryAdapter.ts

**Checkpoint**: User Story 1 is complete when current monitored journeys emit stable scenario attempts, checkpoints, dependencies, and one terminal outcome that operators can inspect independently of raw traces.

---

## Phase 4: User Story 2 - Add Monitoring For A New Scenario (Priority: P2)

**Goal**: Engineers and future agents can add a new monitored journey by following one reusable registry, contract, sink, and Azure mapping pattern.

**Independent Test**: Add or simulate an extra scenario definition, validate that the registry accepts it when complete, rejects it when incomplete, and confirm the Azure mapping and extension guidance remain reusable without changing the core event taxonomy.

### Tests for User Story 2

- [X] T016 [P] [US2] Add unit coverage for duplicate IDs, ordered checkpoints, and registry validation rules in tests/unit/scenarioRegistry.test.ts
- [X] T017 [US2] Add unit coverage for Application Insights category mapping and Azure sink fallback behavior in tests/unit/telemetryAdapter.test.ts

### Implementation for User Story 2

- [X] T018 [US2] Add reusable registry validation and scenario-mapping helpers in src/telemetry/scenarioRegistry.ts and src/telemetry/telemetryContract.ts
- [X] T019 [US2] Implement Application Insights custom-event, dependency, and exception mapping in src/telemetry/applicationInsightsSink.ts
- [X] T020 [US2] Expose Azure sink configuration and cloud-role initialization through src/extension.ts and src/telemetry/applicationInsightsSink.ts
- [X] T021 [US2] Document the future-scenario extension pattern and Azure alert mapping rules in monitoring/telemetry-guidelines.md and specs/004-scenario-monitoring/contracts/scenario-monitoring-contract.md

**Checkpoint**: User Story 2 is complete when a contributor can add a new monitored scenario through the shared registry and Azure mapping pattern without inventing new telemetry categories.

---

## Phase 5: User Story 3 - Protect Privacy And Reduce Alert Noise (Priority: P3)

**Goal**: Monitoring remains privacy-safe and operationally useful by excluding sensitive content, classifying safe blocks and user-controlled outcomes correctly, and keeping telemetry failures from breaking editing flows.

**Independent Test**: Inspect emitted telemetry from normal, cancelled, rejected, safe-blocked, and failed paths to confirm that sensitive fields are absent, user-controlled outcomes are not mislabeled as outages, and Azure misconfiguration does not interrupt editing.

### Tests for User Story 3

- [X] T022 [P] [US3] Add unit coverage for prohibited-field stripping and pseudonymous correlation handling in tests/unit/telemetrySanitizer.test.ts
- [X] T023 [P] [US3] Add integration coverage for safe-block, cancelled-user, reject, and failure classification without sensitive payload leakage in tests/integration/telemetryMonitoring.test.ts

### Implementation for User Story 3

- [X] T024 [US3] Enforce prohibited-field stripping, allowlisted properties, and numeric measurements in src/telemetry/telemetrySanitizer.ts and src/telemetry/telemetryContract.ts
- [X] T025 [US3] Classify safe blocks, user-controlled outcomes, degraded states, and outage-level failures correctly in src/telemetry/telemetryAdapter.ts and src/editors/markdownCustomEditorProvider.ts
- [X] T026 [US3] Keep telemetry failure-open for editing when Azure configuration is missing or invalid in src/telemetry/applicationInsightsSink.ts and src/extension.ts
- [X] T027 [US3] Document privacy guardrails and alert severity rules in monitoring/telemetry-guidelines.md and monitoring/monitoring-scenarios.md

**Checkpoint**: User Story 3 is complete when telemetry excludes sensitive content, reject and cancel are non-error outcomes by default, and Azure sink failures cannot break the editor workflow.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Final verification, documentation alignment, and manual Azure validation.

- [X] T028 [P] Refresh scenario-monitoring quickstart and implementation references in specs/004-scenario-monitoring/quickstart.md and .github/copilot-instructions.md
- [X] T029 Run compile verification via package.json
- [X] T030 Run unit and integration regression verification via package.json
- [X] T031 Validate Azure ingestion and alert posture manually via specs/004-scenario-monitoring/quickstart.md
- [X] T032 [P] Reconcile tasks with the spec, plan, research, data model, and contract in specs/004-scenario-monitoring/

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies and can start immediately.
- **Foundational (Phase 2)**: Depends on Setup completion and blocks all user stories.
- **User Story 1 (Phase 3)**: Depends on Foundational completion and delivers the MVP monitoring slice.
- **User Story 2 (Phase 4)**: Depends on Foundational completion and builds the reusable extension and Azure mapping path.
- **User Story 3 (Phase 5)**: Depends on Foundational completion and hardens privacy and alert semantics across the monitored flows.
- **Polish (Phase 6)**: Depends on the desired user stories being complete.

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational and does not require the later stories.
- **User Story 2 (P2)**: Can start after Foundational and should remain independently testable through registry and sink validation.
- **User Story 3 (P3)**: Can start after Foundational and should remain independently testable through sanitization and classification checks, though it will exercise flows instrumented in User Story 1.

### Within Each User Story

- Tests should be written and fail before implementation when they cover behavior, contracts, or privacy rules.
- Contract and registry changes should land before sink or provider wiring that depends on them.
- Sanitization should be enforced before enabling the Azure sink for real emissions.
- Story-specific implementation should be complete before story-level manual verification.

### Parallel Opportunities

- T003 can run in parallel with T002 after T001 lands.
- T005 and T006 can run in parallel after T004 is defined.
- T010 and T011 can run in parallel for User Story 1.
- T016 and T017 can proceed in parallel once the foundational contract is stable.
- T022 and T023 can run in parallel for User Story 3.
- T028 and T032 can run in parallel during polish.

---

## Parallel Example: User Story 1

```bash
# Launch User Story 1 tests together:
Task: "Add unit coverage for scenario definitions and one-terminal-result enforcement in tests/unit/scenarioRegistry.test.ts and tests/unit/telemetryAdapter.test.ts"
Task: "Add integration coverage for preview, popup, submit, review, apply, reject, and failure scenario sequencing in tests/integration/telemetryMonitoring.test.ts"
```

---

## Parallel Example: User Story 3

```bash
# Launch User Story 3 checks together:
Task: "Add unit coverage for prohibited-field stripping and pseudonymous correlation handling in tests/unit/telemetrySanitizer.test.ts"
Task: "Add integration coverage for safe-block, cancelled-user, reject, and failure classification without sensitive payload leakage in tests/integration/telemetryMonitoring.test.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup.
2. Complete Phase 2: Foundational.
3. Complete Phase 3: User Story 1.
4. **STOP and VALIDATE**: Confirm current monitored journeys emit scenario attempts, checkpoints, and one terminal result independently of Azure configuration.

### Incremental Delivery

1. Complete Setup + Foundational to establish the telemetry boundary.
2. Deliver User Story 1 and validate current scenario health coverage.
3. Deliver User Story 2 and validate that new scenarios can follow the same registry and Azure mapping pattern.
4. Deliver User Story 3 and validate privacy guardrails plus alert-noise reduction.
5. Finish with compile, regression checks, and manual Azure verification.

### Parallel Team Strategy

1. One developer completes Setup and Foundational tasks.
2. After Phase 2 is complete:
   - Developer A: User Story 1 instrumentation and sequencing
   - Developer B: User Story 2 Azure mapping and extensibility
   - Developer C: User Story 3 sanitization and alert classification
3. Rejoin for polish, compile/test validation, and manual Azure verification.

---

## Notes

- `[P]` tasks touch different files and can be executed in parallel when prerequisites are satisfied.
- User Story 1 is the recommended MVP scope because it establishes observable health for the current monitored journeys.
- The branch prerequisite script reported `main`, but the task breakdown is aligned to the active feature directory `specs/004-scenario-monitoring/` and the current planning artifacts.