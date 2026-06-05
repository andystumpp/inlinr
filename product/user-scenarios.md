# User Scenarios

## Core scenarios

1. A user opens a Markdown prompt, spec, or plan and reads it in a polished rendered view while still working from trustworthy source Markdown.
2. A new user opens a Markdown document in Inlinr, sees subtle in-document guidance that teaches them to select text to begin the inline editing workflow, and then stops seeing that teaching UI after dismissing it or making their first qualifying selection.
3. A user highlights one sentence in a prompt or spec and asks Inlinr to make it clearer without changing the surrounding section.
4. A user uses a lightweight formatting action, such as bold or italic, from the inline document surface without leaving the editor flow.
5. A user highlights a Markdown subsection and asks Inlinr to expand it with concrete acceptance criteria while preserving heading structure and list formatting.
6. A user reviews a suggested edit as a scoped change, then applies or rejects it without losing the original text.
7. A user iterates on the same selection multiple times until the wording is right, without copying text into an external chat.
8. A user edits a Markdown document for AI-driven development work and can quickly understand both source structure and rendered meaning without juggling separate tools.
9. A user switches between a small set of rendering presets, such as a denser spec view or a more comfortable reading view, without changing the underlying Markdown or losing selection-based editing affordances.

## Non-functional requirements

- For the inline request flow, a user should see a reviewable suggested change within 2 seconds of submitting a request from the popup.
- For rendered selections, the inline request popup should appear within 500ms.

These scenarios are the starting point for behavior that should keep working unless intentionally changed by source-of-truth docs.
