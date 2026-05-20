# High-Level Architecture

## MVP stack direction

- **Editor platform:** VS Code extension
- **Primary surface:** Inlinr custom Markdown editor hosted in the current editor tab
- **Initial document experience:** Render Markdown locally as preview-only content inside the Inlinr surface
- **AI layer:** provider client plus a thin request/response harness for scoped editing
- **Edit application:** diff or replacement flow that updates only the intended document region

See `architecture/adr-001-custom-markdown-editor-surface.md` for the decision to use a custom editor
surface as the foundation for both the initial viewer and later inline editing flows.

## Current component diagram

```mermaid
flowchart LR
    user[User in VS Code]

    subgraph editor[VS Code]
        markdown[Markdown Text Document]
        custom[Inlinr Custom Editor Tab]
        review[Suggestion Review and Apply Flow]
    end

    subgraph extension[Inlinr Extension]
        session[Document Session Controller]
        render[Markdown Render Pipeline]
        anchor[Selection and Anchor Logic]
        request[Scoped Request Builder]
        provider[AI Provider Client]
        normalize[Suggestion Normalizer]
        apply[Edit Application Service]
    end

    user --> markdown
    markdown --> custom
    custom --> session
    session --> render
    session --> anchor
    anchor --> request
    request --> provider
    provider --> normalize
    normalize --> review
    review --> apply
    apply --> markdown
```

## Core components

| Component | Responsibility |
|---|---|
| Markdown Text Document | Holds the user-authored source text and remains the canonical document model. |
| Inlinr Custom Editor Tab | Replaces the default Markdown editor surface for Inlinr-controlled document opens. |
| Document Session Controller | Coordinates a text document, its visible Inlinr editor instance, refresh, and future editing state. |
| Markdown Render Pipeline | Converts Markdown text into locally rendered preview content for the custom editor webview. |
| Selection and Anchor Logic | Tracks what text the request targets and keeps that intent stable as edits happen. |
| Scoped Request Builder | Packages the selected text and nearby context for an AI edit request. |
| AI Provider Client | Calls the configured model backend. |
| Suggestion Normalizer | Converts provider output into a predictable suggested edit shape. |
| Suggestion Review and Apply Flow | Shows the proposed change and lets the user accept, reject, or refine it. |
| Edit Application Service | Applies the approved edit to the intended range in the document. |

## Architecture principles

- Keep the document surface under Inlinr control so viewing and later editing share one editor model.
- Keep the editing loop precise and selection-scoped.
- Keep provider details behind a stable contract.
- Preserve document integrity and user trust.
- Favor simple local extension flows before adding background orchestration.

## Current architecture gaps and backlog

| Gap | Why it matters | Likely next move |
|---|---|---|
| No explicit custom editor shell | The initial viewer needs a durable document surface that can later host editing. | Add the custom editor, document-session controller, and local render pipeline described in ADR 001. |
| No durable anchoring strategy | Requests can become ambiguous as documents change. | Add a stable anchor model that can re-find intended text or fail clearly. |
| No prompt harness system of record | Editing behavior can drift if request construction lives only in code. | Add a prompt and instruction layer with versioned editing templates. |
| No evaluation harness | AI changes will be hard to compare and regressions will be easy to miss. | Add a small corpus of Markdown editing fixtures and expected outcomes. |
| No explicit provider policy | Cost, latency, and quality tradeoffs will otherwise stay implicit. | Define default model choice, escalation rules, and timeout behavior. |
| No persisted comment model | Some UX flows may eventually need state beyond one request. | Decide whether comments and request history stay ephemeral or become saved workspace data. |
