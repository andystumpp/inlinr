# Glossary

- **User:** the person editing a Markdown document in VS Code with Inlinr.
- **Document:** the current Markdown file being edited.
- **Selection:** the exact text range the user highlighted.
- **Anchor:** the mechanism used to keep a request or suggestion attached to the intended text.
- **Inline request:** a targeted instruction attached to a selection, such as "make this clearer" or "expand this section."
- **Comment:** a note or request associated with a document selection.
- **Suggested edit:** the AI-proposed replacement, insertion, or rewrite for the selected content.
- **Diff:** the visible comparison between current document text and a suggested edit.
- **Apply:** the user action that accepts a suggested edit into the document.
- **Session:** a bounded editing period in which the user makes one or more inline requests.
- **Provider:** the AI service or model backend that generates suggestions.
- **Source-of-truth document:** a committed document in `product/` or `architecture/` that defines product direction, constraints, or technical decisions.
