# User Scenarios

## Core scenarios

1. A user opens a Markdown prompt, spec, or plan and reads it in a polished rendered view while still working from trustworthy source Markdown.
2. A user highlights one sentence in a prompt or spec and asks Inlinr to make it clearer without changing the surrounding section.
3. A user uses a lightweight formatting action, such as bold or italic, from the inline document surface without leaving the editor flow.
4. A user highlights a Markdown subsection and asks Inlinr to expand it with concrete acceptance criteria while preserving heading structure and list formatting.
5. A user reviews a suggested edit as a scoped change, then applies or rejects it without losing the original text.
6. A user iterates on the same selection multiple times until the wording is right, without copying text into an external chat.
7. A user edits a Markdown document for AI-driven development work and can quickly understand both source structure and rendered meaning without juggling separate tools.

## Non-functional requirements

- For the inline request flow, a user should see a reviewable suggested change within 2 seconds of submitting a request from the popup.

These scenarios are the starting point for behavior that should keep working unless intentionally changed by source-of-truth docs.
