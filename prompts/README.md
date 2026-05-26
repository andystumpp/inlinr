# Prompt harness

This directory contains versioned prompt templates used by the execution pipeline.

## Structure

- Prompt files use the naming convention: `<prompt-name>-<version>.md` (example: `selection-scoped-edit-v1.md`).
- Each file starts with YAML-like front matter metadata:
  - `version`: prompt version label (for example `v1`)
  - `purpose`: what the prompt is for
  - `input_variables`: required template variables
  - `changelog`: human-readable prompt history entries
- Prompt body uses `{{variableName}}` placeholders.

## Versioning convention

- Do not overwrite old prompt behavior in-place.
- Add a new file when behavior changes (for example `selection-scoped-edit-v2.md`).
- Keep the changelog in each prompt file updated so prompt evolution is auditable in Git history.

## Runtime usage

`src/requests/promptLoader.ts` loads a prompt file at runtime, validates metadata and required variables, and renders placeholders.

`src/requests/executionService.ts` currently renders `selection-scoped-edit-v1` for execution requests and returns the selected `promptVersion` in the execution result for traceability.

## Testing prompt changes

- `tests/unit/promptLoader.test.ts` validates:
  - prompt loading
  - variable substitution
  - missing-variable validation
  - contract-critical instructions in the rendered prompt
- `tests/unit/executionService.test.ts` verifies execution requests still produce expected prompts and include prompt version tagging.
