# Security Principles

- **Secure by default:** choose the safer default when convenience and privacy conflict.
- **Least privilege:** access only the document, selection, and extension capabilities required for the current action.
- **User-controlled application:** do not apply material document changes without an explicit user action.
- **Validate all external input:** treat provider responses, extension settings, and command payloads as untrusted input.
- **No secrets in source or logs:** keep API keys and sensitive configuration out of committed code, telemetry, and user-visible output.
- **Minimize document exposure:** send only the context needed to produce a good suggestion.
- **Safe AI output handling:** never trust generated edits, links, or instructions without validation and user review.
- **Clear data boundaries:** distinguish local editor state, persisted extension state, and provider-bound payloads.
- **Keep onboarding local:** first-run teaching state may persist only local completion metadata in VS Code global state and must never persist document content or selected text.
- **Auditability for sensitive actions:** make it possible to trace significant edit and provider actions during debugging.
