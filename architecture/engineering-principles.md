# Engineering Principles

- **Keep it simple:** prefer the simplest design that supports the current editing workflow.
- **YAGNI:** do not add broad automation, abstraction, or configuration before a current use case requires it.
- **DRY:** avoid duplicating prompt construction rules, anchoring logic, and edit application logic.
- **SOLID:**
  - **S — Single Responsibility:** keep command handling, document modeling, provider integration, and UI rendering clearly separated.
  - **O — Open/Closed:** extend behavior through focused modules instead of repeatedly editing stable core flows.
  - **L — Liskov Substitution:** interchangeable provider adapters should preserve the expected suggestion contract.
  - **I — Interface Segregation:** prefer small interfaces for commands, provider clients, and edit application services.
  - **D — Dependency Inversion:** depend on clear boundaries rather than concrete provider details or UI surfaces.
- **Explicit boundaries:** separate VS Code extension logic, editor-facing UI, document transformation logic, and provider calls.
- **Reviewable change flow:** optimize for suggested edits that can be inspected and applied deliberately.
- **Fast feedback:** prioritize short iteration loops for both product UX and developer workflows.
- **Evolve in layers:** start with a reliable Markdown editing path before adding wider file and collaboration features.
