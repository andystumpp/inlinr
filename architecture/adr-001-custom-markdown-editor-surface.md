# ADR 001: Use A Custom Markdown Editor Surface For Inlinr

## Status

Accepted

## Context

Inlinr is a VS Code extension for inline, selection-based AI editing of Markdown. The first shipped
capability is a Markdown viewer that opens `.md` files directly into an Inlinr-controlled surface in
the current editor tab, renders Markdown as preview-only content, keeps failures inside the Inlinr
surface, and does not send document content to external services.

This creates an early architectural choice: whether to build the initial capability on top of a
dedicated custom editor surface, reuse VS Code's existing Markdown preview, or introduce a secondary
panel or side view. The choice has lasting consequences because the same surface is expected to become
the future editing window for selection-based AI workflows.

The repository's current product and security guidance requires a VS Code-first, Markdown-first,
selection-oriented experience with clear local data boundaries and user-trust-preserving behavior.

## Decision

Inlinr will use a VS Code custom editor as the primary Markdown document surface.

The initial implementation will:

- contribute a custom editor for Markdown files with Inlinr as the default open path for the targeted
  `.md` experience
- use a `CustomTextEditorProvider` so the underlying VS Code text document remains the source of truth
- render the document inside a webview hosted in the current editor tab
- keep the v1 surface preview-only, with no inline source editing controls yet
- introduce a document-session layer between the text document and the webview so later selection,
  anchoring, diff review, and apply flows can attach to the same surface
- keep all rendering local to the extension for the initial slice, with no provider calls required to
  open or view a document

## Consequences

- The initial viewer and the later editing experience can share the same document surface instead of
  forcing a later re-platform from preview to editor.
- The underlying text document remains canonical, which simplifies future edit application,
  synchronization, and review flows.
- Webview rendering becomes an explicit trust boundary, so message contracts, content security policy,
  and rendering sanitization must be treated as first-class concerns.
- The extension must own a small document-session lifecycle layer instead of relying entirely on the
  built-in Markdown preview behavior.
- The first implementation should keep AI orchestration out of the rendering surface and add provider,
  selection, and review services behind the extension boundary later.

## Alternatives considered

- Use `CustomReadonlyEditorProvider` for the first version only.
  - Simpler for a preview-only slice.
  - Rejected because it makes the eventual transition to an editable, document-backed surface more
    likely to require a migration.
- Reuse or wrap VS Code's built-in Markdown preview.
  - Faster for rendering-only output.
  - Rejected because it does not naturally become Inlinr's long-term editing surface and gives weaker
    control over future selection and review behavior.
- Open Inlinr in a side panel, editor column, or separate window.
  - Keeps the default editor unchanged.
  - Rejected because it conflicts with the approved feature direction of opening Markdown directly in
    the current editor tab and weakens the inline editing model.

## Related documents

- `product/product-outline.md`
- `architecture/high-level-architecture.md`
- `architecture/security-principles.md`
- `specs/001-markdown-viewer/spec.md`