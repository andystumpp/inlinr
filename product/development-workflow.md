# Development Workflow

## Purpose

Use this workflow to move from product intent to implementation without skipping product, UX, or boundary decisions.

## Default sequence

1. **User scenario**
   Capture the user-facing behavior in `product/user-scenarios.md`.
2. **Lightweight architecture check**
   Decide whether the scenario changes extension boundaries, provider integration, persisted state, privacy posture, or command flow.
3. **Feature spec**
   Create a focused spec in `specs/` for the slice that is ready to build.
4. **Plan and tasks**
   Generate implementation planning artifacts and ordered tasks for that spec.
5. **Implementation**
   Build, test, and validate the slice.

## When to do the architecture check earlier

Do the architecture check immediately after the user scenario when the scenario introduces any of the following:

- persisted comments, anchors, or history
- background jobs or long-running AI workflows
- new provider abstractions or fallback behavior
- privacy-sensitive document handling or telemetry
- multi-file editing or broader workspace access
- non-Markdown file support

In these cases, update `architecture/high-level-architecture.md` first and add an ADR if the change creates a durable system boundary or platform rule.

## Practical rule

- If the scenario fits the existing product and system shape, go from scenario to spec.
- If the scenario changes the system shape, do a short architecture pass before the spec.

## Output by document type

- `product/user-scenarios.md`: enduring user-facing behavior
- `architecture/high-level-architecture.md`: current system and component shape
- `architecture/adr-*.md`: durable architecture decisions
- `specs/<feature>/`: scoped implementation-ready feature definition

## Testing principles

- Test behavior at the right layer instead of leaning only on editor-level end-to-end tests.
- Prefer fast, deterministic tests over brittle or slow tests.
- Cover selection anchoring, diff application, Markdown integrity, and privacy boundaries first.
- Once user scenarios are formally captured, preserve them or intentionally update the source docs and related tests.
- Bug fixes should add or update a test that would have caught the issue.

## Expected test layers

- **Unit tests:** anchoring, context building, diff generation, validation, and formatting logic.
- **Integration tests:** VS Code command flow, provider adapters, document update flow, and persistence boundaries.
- **UI tests:** inline action surfaces, diff presentation, and error handling for core editing flows.
- **Manual verification:** targeted editor walkthroughs for critical UX paths when automation is not enough.

## Verification commands

No canonical build, test, or lint commands are defined yet. Add them to this document once the repo establishes actual tooling.
