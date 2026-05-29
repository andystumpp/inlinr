Rewrite only the Markdown content inside the explicit selection markers according to the user request.
You may restructure content inside the selection markers if needed.
Do not change any Markdown content outside the selection markers.
Return only the rewritten selection wrapped by the exact selection markers (do not return the full document).
Do not include commentary or code fences.

User request:
{{requestText}}

Selected Markdown:
{{selectedMarkdown}}

Selection marker id:
{{selectionMarkerId}}

Marked full document Markdown:
{{markedDocumentMarkdown}}
