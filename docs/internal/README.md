# Internal Repository Guide

This document is for contributors working in the repository. Keep Marketplace-facing documentation in the root `README.md` and avoid copying internal guidance into public release materials.

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