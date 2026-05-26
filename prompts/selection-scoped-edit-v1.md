---
version: v1
purpose: Selection-scoped Markdown editing with marker preservation
input_variables:
  - requestText
  - selectedMarkdown
  - selectionMarkerId
  - markedDocumentMarkdown
changelog:
  - 2026-05-26: Initial extraction from src/requests/executionService.ts buildExecutionPrompt().
---

Rewrite only the Markdown content inside the explicit selection markers according to the user request.
You may restructure content inside the selection markers if needed.
Do not change any Markdown content outside the selection markers.
Return the full Markdown document and preserve the selection markers exactly.
Do not include commentary or code fences.

User request:
{{requestText}}

Selected Markdown:
{{selectedMarkdown}}

Selection marker id:
{{selectionMarkerId}}

Marked full document Markdown:
{{markedDocumentMarkdown}}
