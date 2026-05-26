# ADR 006: Auto-Merge-First PR Governance With Maintainability Policy

## Status

Proposed

## Context

The problem is not simply "add more PR automation." The real goal is to reduce the amount of time Andy must spend reading and triaging pull requests while still protecting the repository from:

- security regressions
- low-quality or overconfident AI-generated changes
- design drift and "AI slop"
- accidental approval of changes that still need human judgment

This creates a bounded architectural decision about how pull requests should be governed.

### Current state

Today the repository has a minimal pull request path:

- [`.github/workflows/ci.yml`](../.github/workflows/ci.yml) is the main PR check and covers compile, tests, packaging, and artifact upload.
- Pull request review is still primarily manual.
- Copilot can participate in review, but there is no repository-specific review policy that makes security, code quality, and merge-readiness the primary outputs.
- `main` is branch protected requiring `build-test-package` and `conclusion` (agentic security review).
- Repository auto-merge is enabled.
- An agentic security reviewer runs on every PR and classifies it as `merge-ready`, `needs-human-review`, or `blocked`.
- The repository effectively operates with one time-constrained human reviewer.

### Current gate inventory and gaps

| Area | Already have | Still needed for ADR 006 |
|---|---|---|
| **Core CI gate** | `.github/workflows/ci.yml` runs on `pull_request` and `push` and does `npm ci`, `npm run compile`, `npm test`, and `npm run package:vsix`; `build-test-package` is now a required status check on `main` | Add the remaining required checks after dependency review, code scanning, and gatekeeper workflows exist |
| **Specialized deterministic gate** | `.github/workflows/monitoring-alerts.yml` validates and generates monitoring artifacts for monitoring-related PRs | Decide whether it becomes a required check for its path scope |
| **Branch protection** | **Present** on `main`, requiring `build-test-package` and `conclusion` (agentic security review) | — |
| **Repository auto-merge** | **Enabled** (`allow_auto_merge: true`) | — |
| **Dependency review gate** | `.github/workflows/dependency-review.yml` exists; runs on all PRs | `dependency-review-action` requires GitHub Advanced Security on private repos — same constraint as CodeQL. Check is NOT required. Workflow remains as informational; a future `npm audit` step in CI is the practical alternative |
| **Code scanning / security gate** | **Consciously skipped** — CodeQL requires GitHub Advanced Security (paid) on private repos; dependency review covers the dependency risk class | Logic and security vulnerabilities covered by the agentic review gatekeeper instead |
| **Agentic review gatekeeper** | `.github/workflows/pr-security-review.md` + compiled `.lock.yml`; reviews all PRs against 12 Inlinr-specific security patterns; classifies as `merge-ready` (APPROVE), `needs-human-review` (COMMENT), or `blocked` (REQUEST_CHANGES); `conclusion` check is required on `main` | Add maintainability review pass; configure auto-approval for `merge-ready` low-risk PRs |
| **Auto-approval for low-risk PRs** | **Not present** | Add only after low-risk and protected-path policy exists |
| **Protected-file / high-risk routing policy** | Defined in ADR 006 conceptually, not implemented as repo policy/workflow | Encode the actual path/risk rules and route those PRs to human review |

### Target state

The repository needs a pull request operating model where:

1. objective checks stay deterministic
2. most PRs flow through auto-merge by default
3. agentic review is used to shrink human review effort, not replace all judgment
4. AI-generated changes are treated as higher-risk by default until proven otherwise
5. only exceptions are routed to human review

The main tradeoff is therefore where to place each responsibility:

- deterministic checks such as build, tests, dependency, and code-scanning results
- judgment-heavy review such as security reasoning, design quality, SOLID-style concerns, and whether a PR really needs human attention
- approval and merge automation once a PR appears safe

## Decision

Use an auto-merge-first PR governance model optimized for reviewer time reduction and exception-based human review.

1. Keep objective PR gates as conventional GitHub Actions checks.
2. Enable branch protection and repository auto-merge early, not as a later-stage optimization.
3. Add a focused agentic gatekeeper that decides whether a PR is merge-ready, needs human review, or is blocked.
4. Use automated approval only where branch protection requires approval and the PR is explicitly classified as low-risk.

The intended control model is:

- **Deterministic checks** handle compile, tests, packaging, dependency review, and code scanning. These remain the hard baseline because they are objective and reviewable.
- **Agentic PR review** acts as a repository-tuned gatekeeper. Its job is not to generate lots of comments. Its job is to reduce reviewer reading time by producing:
  - a concise merge-readiness summary
  - only high-confidence security or quality findings
  - a clear statement of what, if anything, still needs human review
- **Auto-approval** is allowed only for low-risk PRs after deterministic checks pass and the agentic reviewer finds no blockers.
- **Auto-merge** is part of the intended near-term path. Most PRs should reach merge automatically once required checks pass and the gatekeeper classifies them as merge-ready.

### Merge routing model

The default path should be:

1. PR opens
2. deterministic checks run
3. gatekeeper classifies the PR
4. if the PR is `merge-ready`, enable auto-merge immediately
5. if branch protection requires approval and the PR is low-risk, the automation may also add an approval
6. only `needs-human-review` or `blocked` PRs should wait on manual review

### Review output standard

The agentic reviewer should optimize for signal, not volume.

- It should prefer one short summary over many low-value comments.
- It should call out security, trust, correctness, and design risks before style.
- It should explicitly identify when a PR is safe enough to skim versus when Andy must read specific files or decisions.
- It should treat changes to protected or high-risk files as human-review candidates by default.

### Maintainability policy

The maintainability policy is not a generic style review. It exists to prevent long-term drag, AI slop, and hidden future review cost.

The gatekeeper should evaluate these dimensions:

| Dimension | What it prevents | What it promotes |
|---|---|---|
| **Boundary integrity** | logic moving into the wrong layer, hidden coupling, wrong-owner code | clearer responsibilities, safer changes, easier reasoning |
| **Complexity control** | giant functions, branching growth, hidden state machines, overgrown controllers | simpler flows, explicit state, easier debugging |
| **Duplication control** | AI copy-paste slop, rule divergence, repeated bug surfaces | shared helpers, single rule definitions, more consistent behavior |
| **Test adequacy** | shallow happy-path tests, false confidence, behavior changes without regression protection | tests at the right layer, edge-case coverage, trustworthy checks |
| **Scope hygiene** | unrelated cleanup, hidden risk, bloated PRs, review fatigue | reviewable slices, clearer history, faster human decisions |

### SOLID in this policy

SOLID remains part of the review lens, but only when it materially affects maintainability.

- **Single Responsibility** is primarily enforced through boundary integrity. A reviewer should escalate when one module starts owning UI, orchestration, policy, and mutation logic at once.
- **Open/Closed** matters when each new case requires editing a central switchboard instead of extending a focused module.
- **Liskov Substitution** matters where provider, renderer, or service contracts are expected to remain interchangeable.
- **Interface Segregation** matters when broad interfaces force unrelated consumers to depend on methods or data they should not need.
- **Dependency Inversion** matters when policy and orchestration start depending directly on concrete provider, UI, or infrastructure details instead of stable contracts.

The goal is not to produce generic SOLID commentary. The goal is to detect concrete maintainability risks that map to SOLID concerns.

### Review examples

For this repository, the maintainability policy should catch patterns such as:

- webview or renderer code taking on provider-request construction
- raw provider output bypassing normalization or validation layers
- telemetry or review logic bypassing sanitization boundaries
- growing one controller or service into the place where every new edge case gets added
- copying anchor, payload, or diff rules into multiple files instead of reusing one source of truth
- adding shallow tests that only assert mocked calls or snapshots without protecting the changed behavior
- bundling broad refactors with a small feature or bug fix

### Operating rule for AI-generated changes

AI-assisted changes should not become trusted merely because they came from Copilot or another agent.

- Deterministic checks establish baseline validity.
- Agentic review establishes whether the change looks materially safe and well-bounded.
- Human review remains the final backstop for high-risk, cross-cutting, or ambiguous changes.

### From current state to target state

The rollout path is intentionally staged.

1. **Current**
   - CI exists
   - PR review is mostly manual
   - branch protection is enabled with CI required
   - no repo-specific agentic PR gatekeeper
2. **Near-term target**
   - deterministic PR gates cover compile, tests, dependency review, and code scanning
   - branch protection is enabled
   - repository auto-merge is enabled
   - an agentic reviewer summarizes security, quality, maintainability, and merge readiness
   - most PRs are marked merge-ready and flow into auto-merge
   - low-risk PRs can be auto-approved where needed
   - human review is reserved for escalated files and decisions
3. **Later target**
   - merge readiness policy is tuned from real PR results
   - protected-path policy is refined
   - the auto-merge rate stays high without eroding code quality or safety

## Consequences

- PR safety keeps a strong deterministic base rather than relying only on AI review.
- Reviewer time should decrease because the agentic layer is explicitly designed to compress reading and triage work.
- Security and design review can become more targeted than a generic Copilot review pass because the repository can define its own review lens.
- "AI slop" is treated as a governance concern, not just a coding concern; the review architecture is expected to filter it before merge.
- Approval automation must stay narrowly scoped to low-risk PRs and protected file boundaries.
- Additional workflow, label, and protected-file policy is required for review routing.
- Branch protection and auto-merge settings become part of the effective architecture for the merge path.
- The repository must define what counts as low-risk versus always-human-review work.
- The repository must define what maintainability problems are blocking, escalatory, or advisory.

## Alternatives considered

- **Fully manual PR review and approval**
  - Simplest to reason about, but does not reduce reviewer load enough for a single-reviewer repo.

- **All-agentic PR governance**
  - Rejected as the default. It increases the chance that AI-generated noise or weak judgment becomes part of the approval path.

- **Manual-first review with occasional automation**
  - Rejected as the target state. It still leaves too much recurring review burden on the single human reviewer.

## Operational checklist

Use this checklist when defining or evaluating the PR governance flow.

### Deterministic gates to enforce

- compile must pass
- automated unit and integration tests must pass
- dependency review must run on package-manifest changes
- code scanning should run for repository-supported languages
- packaging should succeed for release-relevant changes

### Agentic review outcomes to enforce

- produce one short merge-readiness summary
- flag concrete security concerns before style concerns
- identify missing or shallow tests for behavior-changing PRs
- evaluate maintainability using boundary integrity, complexity control, duplication control, test adequacy, and scope hygiene
- call out SOLID concerns only when they map to a concrete maintainability problem
- explicitly say which files or decisions still need human review

### Changes that should default to human review

- `.github/workflows/**`
- release or publishing automation
- secret handling, auth, permissions, billing, or data-handling paths
- large refactors or cross-cutting changes
- architecture-affecting changes that should be backed by an ADR

### Changes that can become auto-approval candidates

- bounded bug fixes
- small docs-only or test-only PRs
- small implementation PRs with passing deterministic checks, no protected-file changes, and no blocking agentic findings

### Conditions for auto-merge

- branch protection enabled
- required checks configured
- repository auto-merge enabled
- PR labeled as low-risk / merge-ready
- no unresolved human-review findings
- no protected-file or high-risk-path changes

## Related documents

- `architecture/high-level-architecture.md`
- `.github/workflows/ci.yml`
- `.github/workflows/issue-triage.md`
- `architecture/adr-template.md`
