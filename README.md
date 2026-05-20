# Inlinr

Inlinr is a VS Code extension for inline, selection-based AI editing of Markdown. It lets users highlight text in docs, specs, and prompts, leave targeted change requests or comments, and apply AI-assisted revisions directly in the editor without copy-pasting into chat.

The first implemented capability is a custom Markdown viewer. Markdown files can open into the Inlinr custom editor as a preview-only surface with local rendering, document identity, and in-viewer error handling.

## Development

1. Run `npm install`.
2. Run `npm run compile` for a one-off build or `npm run watch` while developing.
3. Open Run and Debug, choose `Run Inlinr Extension`, and press `F5` to launch an Extension Development Host.
4. Run `npm test` to execute the VS Code-hosted unit and integration suites.

## Project structure

- `src/` contains the extension activation code, custom editor provider, render pipeline, session controller, and command handlers.
- `media/markdownViewer/` contains the custom editor stylesheet.
- `tests/` contains VS Code-hosted unit and integration coverage plus workspace fixtures.

## Repository guide

- `product/` holds product direction, scope, terminology, and UX guidance.
- `architecture/` holds system design, guardrails, and durable technical decisions.
- `.specify/memory/constitution.md` defines the project guardrails for selection-scoped, reviewable, privacy-bounded editing work.
- `.github/copilot-instructions.md` tells Copilot what to read first when working in this repo.