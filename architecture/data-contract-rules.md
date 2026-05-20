# Data Contract Rules

- **Schema first:** define command payloads, provider requests, provider responses, and suggestion objects before wiring behavior around them.
- **Runtime validation at boundaries:** validate data at extension command, settings, persistence, and provider boundaries.
- **Separate contract layers:** keep editor state, domain models, persisted models, and provider payloads distinct.
- **Stable suggestion shape:** use a predictable structure for scoped edits instead of ad hoc provider output.
- **Standard identifiers and timestamps:** use consistent IDs and timestamps if requests or comments become persisted entities.
- **Normalize provider output:** do not let raw provider responses flow directly into document mutation logic.
- **Version intentionally:** treat breaking request or suggestion contract changes as explicit decisions.
- **No silent contract drift:** when a contract changes, update docs, validators, and related tests together.
