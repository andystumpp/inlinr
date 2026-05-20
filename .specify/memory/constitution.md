<!--
Sync Impact Report
Version change: template -> 1.0.0
Modified principles:
- Template Principle 1 -> I. Selection-Scoped Editing
- Template Principle 2 -> II. Review Before Apply
- Template Principle 3 -> III. Markdown Integrity and Anchor Safety
- Template Principle 4 -> IV. Minimum Necessary Data Exposure
- Template Principle 5 -> V. Contracted and Tested Boundaries
Added sections:
- Product Scope Constraints
- Delivery Workflow and Quality Gates
Removed sections:
- None
Templates requiring updates:
- ✅ .specify/templates/plan-template.md
- ✅ .specify/templates/spec-template.md
- ✅ .specify/templates/tasks-template.md
- ✅ README.md
- ✅ .github/architect.agent.md
Follow-up TODOs:
- None
-->

# Inlinr Constitution

## Core Principles

### I. Selection-Scoped Editing
All product behavior MUST begin from an explicit user-selected Markdown scope or an equally explicit,
user-confirmed target. Features MUST preserve visible scope throughout request creation, suggestion review,
and edit application. Chat-first, whole-document, multi-file, or autonomous editing flows are out of scope
unless the source-of-truth product and architecture documents are updated first. Rationale: Inlinr exists to
make AI edits feel attached to the exact text the user selected.

### II. Review Before Apply
AI-generated changes MUST remain reviewable and user-controlled. Material document changes MUST be presented
as a scoped suggestion or diff before application, and the user MUST be able to apply, reject, refine, or
undo the change through an editor-native flow. Hidden or automatic application is prohibited. Rationale:
reviewability is the core trust mechanism for AI-assisted editing.

### III. Markdown Integrity and Anchor Safety
Features MUST preserve Markdown structure, surrounding intent, and formatting unless the user explicitly asks
for broader transformation. Selection anchoring or re-finding logic MUST fail clearly when the intended
target is ambiguous; it MUST NOT silently mutate a nearby range. Behavior that changes anchoring, diffing,
or edit application MUST include validation at the layer that owns the risk. Rationale: precise edits are
more important than aggressive mutation.

### IV. Minimum Necessary Data Exposure
Provider requests, logs, telemetry, and persisted state MUST use the least document context required for the
current action. External payloads MUST contain only the selected text and the minimum nearby context needed
to produce a useful suggestion. Secrets and sensitive configuration MUST stay out of source, logs, and
user-visible diagnostics. Rationale: privacy and user trust depend on tight data boundaries.

### V. Contracted and Tested Boundaries
Command payloads, provider requests and responses, suggestion objects, and edit-application inputs MUST be
treated as explicit contracts. Boundary data MUST be runtime-validated, provider output MUST be normalized
before document mutation, and behavior changes MUST add or update tests at the right layer. Any feature that
changes persisted state, provider interfaces, background execution, or cross-file scope MUST document the
boundary in specs and architecture materials before implementation. Rationale: stable contracts are how the
extension stays predictable as AI behavior varies.

## Product Scope Constraints

Inlinr MUST stay Markdown-first, VS Code-first, and inline-first unless a product document changes that
scope. The baseline product does not include whole-repo autonomous editing, hidden AI edits, broad content
generation as the primary workflow, or provider-specific UX lock-in. New work that introduces non-Markdown
files, multi-file edits, background jobs, persisted comments or history, new provider abstractions, or
privacy-sensitive data flows MUST trigger an architecture check and, when the system shape changes
materially, an ADR.

## Delivery Workflow and Quality Gates

Work MUST follow the repository workflow from enduring user scenario, to architecture check when needed, to
feature spec, to plan and tasks, to implementation and verification. Every spec MUST record the targeted
user selection or scope, the review/apply behavior, the data sent outside the editor, and the relevant
non-goals or out-of-scope expansions. Every plan MUST pass a Constitution Check covering scope preservation,
review before apply, data minimization, contract updates, and test coverage. Every task set MUST include
work for contract validation, privacy and security safeguards, and test or manual verification updates
whenever the change touches those areas.

## Governance

This constitution overrides conflicting local habits, prompt shortcuts, and undocumented workflow
preferences. Amendments MUST be made in the same change set that updates any affected templates,
source-of-truth product or architecture documents, and guidance files. Compliance MUST be reviewed during
spec creation, plan review, task generation, and pull request review.

Versioning policy follows semantic versioning for governance changes: MAJOR for incompatible removals or
principle redefinitions, MINOR for new principles or materially expanded obligations, and PATCH for
clarifications that do not change required behavior.

Compliance review expectations are mandatory: reviewers MUST reject work that expands scope beyond explicit
selection targeting, bypasses review-before-apply, weakens data minimization, or introduces undocumented
boundary changes. Temporary exceptions require documented justification in the plan or ADR and a follow-up
removal path.

**Version**: 1.0.0 | **Ratified**: 2026-05-19 | **Last Amended**: 2026-05-19
