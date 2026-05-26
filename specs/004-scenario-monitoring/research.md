# Research: Scenario Monitoring

## Decision 1: Keep the monitoring contract scenario-first and extension-host-owned

- Decision: Define a shared scenario registry and telemetry adapter in the extension host as the only place allowed to emit external monitoring signals.
- Rationale: The monitoring scenarios are user-visible journeys, not raw implementation details. The extension host already owns the canonical state transitions for viewer render, selection capture, request execution, and apply/reject behavior. Keeping telemetry emission there preserves the product's privacy boundary and avoids pushing external telemetry into the webview.
- Alternatives considered: Webview-direct telemetry was rejected because it would duplicate logic, weaken sanitization control, and make monitoring depend on transient UI state. Exception-only monitoring was rejected because it cannot distinguish user-visible outages from low-level noise.

## Decision 2: Use a vendor-neutral event contract and map it to Azure Application Insights as the default backend

- Decision: Standardize on a local contract for `scenario_attempt`, `scenario_checkpoint`, `scenario_result`, `dependency`, and `exception` events, then map those signals to Azure Application Insights as the default sink.
- Rationale: The repo guidance already requires the monitoring contract to stay abstract even while Azure is the preferred backend. Application Insights supports the telemetry categories this feature needs: `customEvents` for scenario and checkpoint events, `dependencies` for provider or future outbound calls, `exceptions` for handled and unhandled failures, `traces` for sampled diagnostics, and custom measurements for durations and coarse counters.
- Alternatives considered: Making Azure table names the primary contract would couple contributors and future agents to one backend and make later sink changes harder. Using only traces would weaken queryability and alert precision.

## Decision 3: Prefer Azure Monitor OpenTelemetry for a Node-hosted Azure sink, but isolate it behind a local sink interface

- Decision: If this slice introduces a real Azure sink, use a Node-compatible Azure Monitor Application Insights integration path behind a local sink interface and prefer `@azure/monitor-opentelemetry` as the Azure-side package boundary.
- Rationale: Microsoft documents `@azure/monitor-opentelemetry` as the current Node.js enablement path for Azure Monitor/Application Insights. That aligns with the extension-host runtime while still allowing the codebase to keep its own event shapes and sanitization rules. The sink interface also lets tests use a local recording sink and lets the extension no-op cleanly when Azure configuration is absent.
- Alternatives considered: Binding the telemetry adapter directly to a vendor SDK would make testing harder and would leak vendor concerns into core extension orchestration. Using the browser SDK was rejected because telemetry must not be emitted from the webview.

## Decision 4: Configure Azure connectivity through environment-sourced connection strings and fail open for editing when telemetry is unavailable

- Decision: Read the Application Insights connection string from environment configuration, keep Azure telemetry disabled when configuration is absent, and never let telemetry misconfiguration block normal editing behavior.
- Rationale: Azure guidance recommends environment-sourced connection strings for production. Inlinr's monitoring feature is operationally valuable, but it must not become a runtime dependency for the editing loop. If the Azure sink cannot initialize, the adapter should fall back to a no-op sink and optionally surface a local diagnostic rather than interrupting the product.
- Alternatives considered: Hardcoding connection strings was rejected for security reasons. Failing the extension or monitored scenarios when telemetry is unavailable was rejected because monitoring must not reduce product availability.

## Decision 5: Alert on scenario outcomes first, then use checkpoint and diagnostic signals for routing and triage

- Decision: Define alerts around scenario outcome degradation or failure, with checkpoint spikes, dependencies, and exceptions acting as supporting signals. Use synthetic checks for core availability and stateful log-based alerts for user-visible failure-rate and unsafe-behavior conditions.
- Rationale: The monitoring guidance explicitly aims to avoid paging on raw exceptions. Azure Monitor supports both availability-style signals and log/metric alerts. That makes it possible to page on core scenario outages or unsafe mutations while keeping checkpoint and component-health alerts non-paging by default. Stateful alerts also fit the desire to avoid repeated notifications until a scenario-level issue resolves.
- Alternatives considered: Exception-first paging was rejected because it produces noisy alerts with weak user-impact semantics. A fully synthetic-only model was rejected because it misses real-user degradations and privacy-safe scenario outcome analysis.

## Decision 6: Enforce a tight telemetry privacy model with low-cardinality dimensions and explicit sanitization

- Decision: Restrict telemetry to stable identifiers, coarse dimensions, durations, criticality, and controlled failure classes. Sanitize or omit any field that could expose raw Markdown, selected text, prompts, responses, file paths, or secrets.
- Rationale: The constitution and security principles require minimum necessary data exposure. Application Insights supports correlation fields, custom properties, and custom measurements, but that flexibility increases the need for a strict sanitizer. Low-cardinality event names and dimensions also improve queryability and reduce noisy grouping in Azure.
- Alternatives considered: Rich debug payloads were rejected because they would increase privacy risk and cardinality. Per-instance event names were rejected because Application Insights guidance favors a small set of logical event names.

## Decision 7: Model one terminal result per scenario attempt and keep retries folded into the same attempt until the journey ends

- Decision: Create a scenario-attempt correlation model that starts when the user-visible journey begins, records checkpoint progress and retry context under the same attempt, and emits exactly one terminal `scenario_result` for that attempt.
- Rationale: The spec requires one terminal result even when repeated internal failures or retries occur. This simplifies queries, failure-rate calculations, and alerting thresholds. Application Insights correlation fields such as operation and session context fit this model well.
- Alternatives considered: Emitting a new terminal result on every retry would distort failure rates and make scenario availability harder to measure. Ignoring retries entirely would remove useful triage context.

## Decision 8: Validate the monitoring slice through contract-focused tests plus manual Azure verification

- Decision: Cover the feature with unit tests for registry validation, sanitization, and event-shape enforcement; integration tests for provider-owned scenario sequencing; and a manual smoke path for Azure ingestion and alert wiring when a connection string is available.
- Rationale: Most of the risk in this slice is contract drift, privacy mistakes, and incorrect sequencing, all of which are deterministic. Azure ingestion and alert configuration are valuable to verify manually or in opt-in environments, but they are too environment-dependent to be the default regression path.
- Alternatives considered: Manual-only validation would make privacy regressions too easy to miss. Always-on live Azure tests would be brittle, slow, and configuration-dependent.

## Decision 9: No new ADR is required for this slice

- Decision: Keep the monitoring design in the planning artifacts and source-of-truth docs rather than creating a new ADR.
- Rationale: The architecture document already records the Telemetry and Monitoring Adapter boundary. This slice specifies how that boundary should be implemented and mapped to Azure/Application Insights rather than introducing a new durable system shape.
- Alternatives considered: A new ADR would become necessary if the feature introduced a separate telemetry service, persistent monitoring storage inside the extension, cross-process collection, or a non-Azure backend strategy that materially changed the architecture.