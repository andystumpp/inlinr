# Copilot Instructions

*Each instruction file must not exceed 4,000 characters.*

## Source of truth

- Read `product/product-outline.md` first for product goals, users, scope, and assumptions.
- Read `product/non-goals.md` before expanding scope.
- Read `product/glossary.md` to keep product and editing terms consistent.
- Read `product/ux-principles.md` for default UX guidance.
- Read `product/user-scenarios.md` for core behavior that should keep working.
- Read `product/development-workflow.md` for the default path from scenario to implementation.
- Read `architecture/high-level-architecture.md` for current system shape.
- Use `architecture/engineering-principles.md` for default engineering choices.
- Use `architecture/data-contract-rules.md` for provider, command, and diff contract guidance.
- Use `architecture/security-principles.md` for security and privacy guardrails.
- Use `architecture/adr-template.md` when recording a durable technical decision.

## Product direction

- Inlinr is a VS Code extension for inline, selection-based AI editing of Markdown.
- Optimize for precise, scoped edits attached to selected text, not detached chat workflows.
- Favor clarity, speed, and reviewable changes over autonomous or whole-document rewriting.

## Working in this repository

- Treat `product/` as product source of truth and `architecture/` as technical source of truth.
- Treat root `README.md` as Marketplace-public content, not an internal contributor document.
- Never add contributor setup, development workflow, project structure, or internal repository path references to `README.md`.
- Put internal contributor guidance in `docs/internal/`, not in Marketplace-facing documentation.
- Keep docs concise, decision-oriented, and easy for future agents to apply.
- Do not invent build, test, or lint commands until the corresponding tooling exists in the repo.
- When using SpecKit, stay on the current branch; do not create or switch Git branches for `/speckit.specify` or related planning commands.
- If a task changes product or architecture direction, update the relevant source doc instead of leaving the decision only in code or chat history.
- For scenario monitoring work, keep `monitoring/monitoring-scenarios.md` and `monitoring/telemetry-guidelines.md` aligned with the runtime behavior, especially privacy-safe property allowlists, scenario status classification, and Azure fail-open rules.

## Code review guidelines

- Only comment on issues likely to cause bugs, broken tests, security problems, or material architectural harm.
- Do not comment on wording polish, minor phrasing, or low-impact documentation nits.
- Leave at most one comment per root issue; do not repeat the same finding across multiple lines.
- For docs-only PRs, comment only on contradictions that would mislead implementation, policy, or operations — not stylistic or editorial inconsistencies.
- Do not flag gaps that are already acknowledged and documented as future work within the same file.

## PR verification requirements

- Every PR must include completed verification in its body: exact commands run or explicit blockers with open issue references.
- Bug-fix PRs must name the regression test added or updated (file and test description). Flag as incomplete if absent.
- PRs touching webview selection handling, popup behavior, selection anchors, or geometry logic must record `npm run test:webview` results.
- PRs changing any user-visible UX surface must record a manual walkthrough. 
- Treat "tests blocked locally" as a workflow defect to surface and track, not as acceptable context in a PR body.

<!-- SPECKIT START -->
For additional context about technologies to be used, project structure,
shell commands, and other important information, read `specs/004-scenario-monitoring/plan.md`
<!-- SPECKIT END -->
