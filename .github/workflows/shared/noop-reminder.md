---
source: github/gh-aw/.github/workflows/shared/noop-reminder.md@88a8ca3f64116a0c338ec9bfa775ea177221ee4d
---
**Important**: If no action is needed after completing your analysis, you **MUST** call the `noop` safe-output tool with a brief explanation. Failing to call any safe-output tool is the most common cause of safe-output workflow failures.

```json
{"noop": {"message": "No action needed: [brief explanation of what was analyzed and why]"}}
```
