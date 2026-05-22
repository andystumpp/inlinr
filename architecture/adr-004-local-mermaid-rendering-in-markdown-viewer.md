# ADR 004: Use Local Mermaid Rendering In The Markdown Viewer

## Status

Accepted

## Context

The Markdown viewer is now expected to render Mermaid fenced code blocks as diagrams inside the
Inlinr custom editor surface. That requirement belongs to the local viewer architecture, not to the
selection or AI execution flows.

This creates a bounded architectural decision: where Mermaid rendering should happen and what trust
boundary should own it.

The current extension architecture already establishes several constraints:

- Markdown documents open into an Inlinr-owned custom editor surface backed by a canonical VS Code
  `TextDocument`.
- Markdown rendering stays local to the extension and viewer surface.
- Opening or refreshing a document must not send document content to external providers or network
  services.
- The viewer should remain capability-minimal by default, but the webview is already an explicit
  trust boundary for document presentation.
- Rendering failures should stay inside the Inlinr surface rather than falling back silently to a
  different editor experience.

Mermaid support introduces a practical tradeoff. Inlinr can keep using `markdown-it` for Markdown
parsing, but Mermaid itself is diagram-oriented rendering logic rather than ordinary Markdown
formatting. The main alternatives are to render Mermaid entirely outside the webview, to render it
locally in the webview using a packaged Mermaid library, or to avoid Mermaid rendering and leave
blocks as raw source.

## Decision

Inlinr will keep Markdown parsing in the local extension-host pipeline and use a packaged local
Mermaid rendering path in the Markdown viewer webview for Mermaid fenced blocks.

The implementation direction is:

- keep `markdown-it` as the Markdown parser and continue treating the extension host as the owner of
  document parsing and render decisions
- detect Mermaid fenced code blocks during local Markdown rendering and emit viewer-controlled
  placeholder or fallback markup instead of treating them as ordinary code fences
- package the Mermaid rendering library with the extension and load it only from extension-owned
  local resources
- allow a narrowly scoped webview script capability only if it is required for strictly local
  Mermaid rendering
- render Mermaid output locally in the webview without network calls, provider calls, or remote
  asset fetches
- treat Mermaid block failures as diagram-level fallback conditions when the rest of the Markdown can
  still render
- reserve full viewer error states for document-level render failures rather than invalidating the
  whole viewer because one Mermaid block fails

## Consequences

- Inlinr keeps its existing Markdown stack and does not need to re-platform away from `markdown-it`
  just to add Mermaid.
- Mermaid support stays inside the same local privacy and trust boundary as the rest of the viewer.
- The webview capability contract becomes slightly broader because local Mermaid rendering may
  require a packaged script path.
- The renderer must explicitly distinguish ordinary document render failures from Mermaid block
  fallback conditions.
- Viewer tests and manual verification must include both successful Mermaid rendering and invalid
  Mermaid fallback behavior.

## Alternatives considered

- Render Mermaid entirely in the extension host.
  - Keeps more logic outside the webview.
  - Rejected because Mermaid rendering is naturally browser-oriented and would add unnecessary
    complexity to the host-side pipeline.
- Switch to a different Markdown stack primarily for Mermaid support.
  - Could unify more rendering in one transformed pipeline.
  - Rejected because it creates broad architectural churn without solving a problem that cannot be
    handled by the current Markdown plus local-diagram split.
- Use remote Mermaid rendering or CDN-hosted Mermaid assets.
  - Simplifies packaging in the short term.
  - Rejected because it violates the local-only document exposure boundary.
- Leave Mermaid blocks as raw fenced source.
  - Simplest implementation.
  - Rejected because the viewer specification now treats Mermaid as part of the expected rendered
    Markdown experience.

## Related documents

- `product/product-outline.md`
- `architecture/high-level-architecture.md`
- `architecture/security-principles.md`
- `architecture/adr-001-custom-markdown-editor-surface.md`
- `specs/001-markdown-viewer/spec.md`
- `specs/001-markdown-viewer/research.md`
- `specs/001-markdown-viewer/contracts/viewer-session-contract.md`