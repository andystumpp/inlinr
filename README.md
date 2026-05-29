# Inlinr

Inlinr is a preview VS Code extension for inline, selection-based AI editing of Markdown. It lets you highlight text in docs, specs, and prompts, ask for a targeted revision, review the proposed change in context, and apply it directly in the editor without detouring into chat.

## Features

- Select Markdown and open a request directly from the targeted text.
- Keep AI edits scoped to the selected passage instead of the whole document.
- Review the suggested change inline before applying it.
- Preserve Markdown structure and surrounding context where possible.
- Iterate quickly on prompts, specs, and working docs without copy-paste.

## Preview

Inlinr is currently in preview. The selection-scoped editing workflow is functional, but the experience is still evolving and some behaviors may change as the inline review flow is refined.

## Requirements

- VS Code `1.90.0` or newer
- Access to a Copilot-backed chat model through the VS Code Language Model API

If a supported model is unavailable or access is denied, Inlinr keeps the request flow available for capture and review state management but will not execute the rewrite request.

## Development

1. Run `npm install`.
2. Run `npm run compile` for a one-off build or `npm run watch` while developing.
3. Run `npm test` to execute the default VS Code-hosted integration and unit suites.
4. To run the dedicated browser-based webview suite, first install the Playwright browser once with `npm run test:webview:install`, then run `npm run test:webview`.
5. Open Run and Debug, choose `Run Inlinr Extension`, and press `F5` to launch an Extension Development Host.
6. Run `npm run package:vsix` to build a Marketplace-ready extension package.

## Project structure

- `src/` contains the extension activation code, custom editor provider, render pipeline, selection-scoped request flow, and document session controller.
- `media/markdownViewer/` contains the custom editor scripts and stylesheet.
- `tests/` contains VS Code-hosted unit and integration coverage, Playwright webview contract tests, and workspace fixtures.

## Repository guide

- `product/` holds product direction, scope, terminology, and UX guidance.
- `architecture/` holds system design, guardrails, and durable technical decisions.
- `.specify/memory/constitution.md` defines the project guardrails for selection-scoped, reviewable, privacy-bounded editing work.
- `.github/copilot-instructions.md` tells Copilot what to read first when working in this repo.
