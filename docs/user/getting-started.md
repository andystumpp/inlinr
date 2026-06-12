# Inlinr — Inline AI Editing for Markdown

Inlinr is a VS Code extension that brings selection-based AI editing to Markdown documents. Select text, ask for a revision, review the change in place, and apply it — all without leaving your document.

## What it does

- **Rendered Markdown view** — Read your document in a polished, theme-aware presentation while editing the source.
- **Selection-scoped AI edits** — Highlight a word, sentence, or section and request a targeted rewrite. The AI suggestion applies only to what you selected.
- **Inline review** — See exactly what will change before you accept it. Apply, reject, or refine until it reads the way you want.
- **Lightweight formatting** — Apply bold, italic, and structure changes directly from the editor surface.
- **Presentation presets** — Switch between reading styles (dense spec view, comfortable reading view) without modifying your Markdown source.

## When to use it

Inlinr is built for anyone who writes or maintains Markdown artifacts in an AI-driven workflow:

- Prompts, specs, and plans that drive development
- ADRs, checklists, and task breakdowns
- Any Markdown document where you want precise, scoped AI revisions instead of broad rewrites

Use Inlinr when you want to iterate on specific passages quickly without copying text into a chat window or rewriting entire documents.

## How to use it

### 1. Open a Markdown file

Open any `.md` file in VS Code. Inlinr activates automatically and provides its rendered view.

### 2. Select text

Highlight the passage you want to revise — a phrase, a sentence, a list item, or an entire section.

### 3. Request an edit

An inline popup appears on your selection. Type your instruction (e.g., "make this clearer," "add acceptance criteria," "shorten to one sentence") and submit.

### 4. Review the suggestion

Inlinr shows the proposed change as a scoped diff against your selection. You can:

- **Apply** — Accept the suggestion into your document.
- **Reject** — Dismiss it and keep your original text.
- **Refine** — Submit another instruction on the same selection to iterate further.

### 5. Repeat

Continue selecting and revising anywhere in the document. Each edit stays scoped to the text you chose.

## Requirements

- VS Code 1.90.0 or newer
- Access to a Copilot-backed chat model via the VS Code Language Model API

If no supported model is available, Inlinr still provides the rendered view and formatting actions but will not execute AI rewrites.

## Tips

- **Stay precise** — Smaller selections produce more predictable results. Select exactly what you want changed.
- **Iterate freely** — You can refine the same selection multiple times until the wording is right.
- **Use presets** — Switch rendering presets to match the task: a denser view for specs, a wider view for reading.
- **Trust the source** — The rendered view always reflects your actual Markdown. Presentation presets never modify document content.
