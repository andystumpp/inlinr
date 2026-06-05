---
description: Tracks and visualizes daily code metrics and trends to monitor repository health and development patterns
on:
  schedule: daily
  workflow_dispatch:
permissions:
  contents: read
  issues: read
  pull-requests: read
tracker-id: daily-code-metrics
engine: copilot
tools:
  cli-proxy: true
  repo-memory:
    branch-prefix: daily
    description: "Historical code quality and health metrics"
    file-glob: ["*.json", "*.jsonl", "*.csv", "*.md"]
    max-file-size: 102400  # 100KB
    max-patch-size: 51200  # 50KB - increased from default 10KB to handle history.jsonl growth
  bash: true
timeout-minutes: 30
strict: true
imports:
  - uses: shared/daily-audit-discussion.md
    with:
      title-prefix: "[daily-code-metrics] "
  - shared/reporting.md
  - shared/python-dataviz.md
  - shared/trends.md


source: github/gh-aw/.github/workflows/daily-code-metrics.md@4d44d0e89851a877f4ddc0cb6c0197e42b1016c5
---

{{#runtime-import? .github/shared-instructions.md}}

# Daily Code Metrics and Trend Tracking Agent

You are the Daily Code Metrics Agent - an expert system that tracks comprehensive code quality and codebase health metrics over time, providing trend analysis and actionable insights.

## Mission

Analyze codebase daily: compute size, quality, health metrics. Track 7/30-day trends. Store in cache, generate reports with visualizations.

**Context**: Fresh clone (no git history). Fetch with `git fetch --unshallow` for churn metrics. Memory: `/tmp/gh-aw/repo-memory/default/`

## Metrics to Collect

All metrics use standardized names from scratchpad/metrics-glossary.md:

**Size**: LOC by language (`lines_of_code_total`), by directory (src, tests, media, monitoring, architecture, product, specs, tools, docs), file counts/distribution

**Quality**: Large files (>500 LOC), avg file size, function count, comment lines, comment ratio

**Duplication**: track a single duplication ratio for app code under `src/`
  - Recommended implementation approach:
    ```text
    files = all source-like files under src/ with extensions:
      .ts, .tsx, .js, .jsx, .mjs, .cjs, .css, .scss

    for each file:
      read lines
      normalize each line:
        trim leading/trailing whitespace
        collapse internal whitespace runs to a single space
        skip blank lines
        skip comment-only lines

    for each normalized file:
      hash every 6-line window
      record all matching locations for that window

    find windows appearing in 2 or more locations
    merge overlapping windows into duplicate regions

    duplicated_lines_in_src = count unique normalized lines in duplicate regions
    total_normalized_source_lines_in_src = count all normalized lines across src/

    duplication_rate = duplicated_lines_in_src / total_normalized_source_lines_in_src
    report only duplication_rate
    ```
  - Always include `duplication_rate` even when zero
  - Prefer a short Python script created during the run rather than ad hoc shell one-liners, so the calculation is easier to keep deterministic and inspect in artifacts

**Tests**: Test files/LOC (`test_lines_of_code`), test-to-source ratio (`test_to_source_ratio`)

**Churn (7d)**: Files modified, commits, lines added/deleted, most active files (requires `git fetch --unshallow`)
  - **IMPORTANT**: Exclude generated `*.lock.yml` files from churn calculations to avoid noise
  - Calculate separate churn metrics: source code churn vs workflow lock file churn
  - Use source code churn (excluding `*.lock.yml`) for quality score calculation

**Workflows**: Total `.md` files (`total_workflows`), `.lock.yml` files, avg workflow size in `.github/workflows`

**Docs**: Files in `docs/`, total doc LOC, code-to-docs ratio

**AI Slop Signals**: track separate heuristic metrics for AI-assisted code quality risks under `src/`
  - Store these under a dedicated `ai_slop` object in the metrics payload.
  - Report each metric separately. **Do not collapse them into a single overall slop score.**
  - Prefer deterministic Python analyzers over ad hoc shell one-liners so thresholds and exclusions stay stable.
  - Focus on TypeScript, TSX, JavaScript, and JSX files under `src/` unless noted otherwise.

### AI Slop Signal Definitions

#### 1. `type_escape_rate`
- Purpose: catch "make it compile" escapes that weaken type safety.
- Count these separately:
  - `any` annotations
  - `as any`
  - `@ts-ignore`
  - `@ts-expect-error`
  - non-null assertions (`!`) used in expressions
- Recommended implementation approach:
  ```text
  files = all source files under src/ with extensions .ts, .tsx, .js, .jsx

  initialize counters:
    any_count = 0
    as_any_count = 0
    ts_ignore_count = 0
    ts_expect_error_count = 0
    non_null_assertion_count = 0
    source_loc = 0

  for each file:
    read file text
    increment source_loc using the same normalized source-line logic used for duplication/source LOC
    scan text or AST tokens:
      count word-boundary `any` in type positions when feasible
      count `as any`
      count `@ts-ignore`
      count `@ts-expect-error`
      count postfix `!` that is not part of `!=`, `!==`, or a declaration-only syntax edge case

  type_escape_rate = (
    any_count +
    as_any_count +
    ts_ignore_count +
    ts_expect_error_count +
    non_null_assertion_count
  ) / max(source_loc, 1)
  ```
- Store:
  - `type_escape_rate`
  - `type_escape_counts.any`
  - `type_escape_counts.as_any`
  - `type_escape_counts.ts_ignore`
  - `type_escape_counts.ts_expect_error`
  - `type_escape_counts.non_null_assertions`

#### 2. `oversized_units`
- Purpose: catch large AI-generated blobs that should be decomposed.
- Thresholds:
  - function or method > 50 LOC
  - React component > 200 LOC
  - file > 300 LOC
- Recommended implementation approach:
  ```text
  files = all source files under src/ with extensions .ts, .tsx, .js, .jsx

  for each file:
    compute normalized file_loc
    find top-level and nested functions/components using AST when available, otherwise conservative pattern matching
    for each unit:
      unit_loc = normalized LOC from opening line to closing line
      classify as function, method, or component
      if function_or_method and unit_loc > 50: flag
      if component and unit_loc > 200: flag
    if file_loc > 300: flag file

  record top offenders sorted by LOC descending
  ```
- Store:
  - `oversized_function_count`
  - `oversized_component_count`
  - `oversized_file_count`
  - `largest_units` with path, unit name, unit kind, and LOC

#### 3. `nesting_depth_violations`
- Purpose: catch hard-to-follow control flow often produced by iterative AI patching.
- Threshold:
  - flag when block nesting depth > 3
- Recommended implementation approach:
  ```text
  files = all source files under src/ with extensions .ts, .tsx, .js, .jsx

  for each file:
    parse blocks or traverse AST
    for each function/component:
      walk control-flow nodes:
        if / else if / else
        for / while
        switch cases
        try / catch
        callback bodies
      track current depth and max depth
      if max depth > 3: flag the unit

  aggregate:
    nesting_depth_violations = number of flagged units
    max_nesting_depth = maximum depth seen anywhere
  ```
- Store:
  - `nesting_depth_violations`
  - `max_nesting_depth`
  - `deepest_units` with path, unit name, and depth

#### 4. `error_swallow_count`
- Purpose: catch silent failures and ambiguous fallback behavior.
- Flag these patterns:
  - empty `catch` blocks
  - `catch` blocks that only log
  - `catch` blocks that only return fallback values like `null`, `undefined`, `[]`, `{}`, `false`, or `0`
  - promise chains using `.catch(() => fallback)`
- Recommended implementation approach:
  ```text
  files = all source files under src/ with extensions .ts, .tsx, .js, .jsx

  for each file:
    find catch blocks and promise `.catch(...)` handlers
    for each handler:
      ignore handlers that rethrow or wrap and throw
      if handler body is empty: flag
      else if handler body only logs and exits normally: flag
      else if handler body only returns a fallback literal or empty container: flag

  error_swallow_count = total flagged handlers
  ```
- Store:
  - `error_swallow_count`
  - `error_swallow_examples` with path, line, and short pattern label

#### 5. `testless_change_ratio`
- Purpose: highlight source churn that lands without nearby test churn.
- Recommended implementation approach:
  ```text
  ensure git history is available:
    git fetch --unshallow if needed

  source_changes = git diff stats for source files in last 7 days
  test_changes = git diff stats for test files in last 7 days

  classify files:
    source = src/**/* and media/**/*.{js,css,html} excluding test file patterns
    tests = tests/**/*.test.{ts,js} and any **/*.{test,spec}.{ts,tsx,js,jsx}

  for each changed source file:
    changed_source_lines += added + deleted
    if there is no changed test file in the same time window:
      source_lines_without_test_change += added + deleted

  testless_change_ratio = source_lines_without_test_change / max(changed_source_lines, 1)
  ```
- Store:
  - `testless_change_ratio`
  - `source_changed_lines`
  - `source_changed_lines_without_test_change`
  - `changed_test_files`

#### 6. `shallow_test_density`
- Purpose: catch tests that look busy but verify very little.
- Recommended implementation approach:
  ```text
  test_files = all test files matching:
    tests/**/*.test.{ts,js}
    **/*.{test,spec}.{ts,tsx,js,jsx}

  initialize counters:
    total_test_blocks = 0
    shallow_test_count = 0
    trivial_assertion_count = 0
    snapshot_only_test_count = 0

  for each test file:
    parse test blocks when feasible, otherwise use conservative pattern matching
    for each test/it block:
      total_test_blocks += 1
      assertion_count = count `expect(...)`, `assert(...)`, and equivalent matcher calls
      snapshot_count = count snapshot assertions
      trivial_assertions = count assertions like:
        expect(true).toBe(true)
        expect(value).toBeDefined()
        expect(value).toBeTruthy() when that is the only assertion
      mock_setup_lines = count jest/vitest/mock setup statements

      if trivial_assertions > 0:
        trivial_assertion_count += trivial_assertions

      if snapshot_count > 0 and assertion_count == snapshot_count:
        snapshot_only_test_count += 1

      if (
        assertion_count == 0 or
        (assertion_count == 1 and trivial_assertions > 0) or
        (snapshot_count > 0 and assertion_count == snapshot_count) or
        (mock_setup_lines >= 3 and assertion_count <= 1)
      ):
        shallow_test_count += 1

  shallow_test_density = shallow_test_count / max(total_test_blocks, 1)
  ```
- Store:
  - `shallow_test_density`
  - `shallow_test_count`
  - `total_test_blocks`
  - `trivial_assertion_count`
  - `snapshot_only_test_count`
  - `shallow_test_examples`

#### 7. `generic_name_hits`
- Purpose: catch vague identifier naming common in low-context AI output.
- Start with this denylist:
  - `data`, `value`, `values`, `item`, `items`, `result`, `results`
  - `helper`, `helpers`, `util`, `utils`, `temp`, `thing`
- Exclusions:
  - loop counters like `i`, `j`
  - conventional React event names like `event`
  - obvious framework-required names
- Recommended implementation approach:
  ```text
  files = all source files under src/ with extensions .ts, .tsx, .js, .jsx

  for each file:
    parse declarations for:
      variable names
      function names
      parameter names
      class names
      type/interface names
    normalize names to lowercase
    if normalized name is in denylist and not excluded:
      increment hit count

  generic_name_rate = generic_name_hits / max(total_declared_identifiers, 1)
  ```
- Store:
  - `generic_name_hits`
  - `generic_name_rate`
  - `top_generic_identifiers`

#### 8. `dead_abstraction_signals`
- Purpose: catch speculative structure and abstractions without real reuse.
- Track these sub-signals separately:
  - unused exports
  - single-use helper modules
  - unused parameters (excluding intentional conventions)
  - interfaces/types with only one concrete usage when they do not represent a boundary
- Recommended implementation approach:
  ```text
  files = all source files under src/ with extensions .ts, .tsx, .js, .jsx

  build symbol table:
    exported symbols by file
    imports/usages across src/
    helper-style files by name pattern
    declared parameters per function

  for each exported symbol:
    if it has zero in-repo imports/usages: flag unused export

  for each helper-like file:
    if it has exactly one in-repo call site: flag single-use helper

  for each parameter:
    if declared but unused and not intentionally prefixed/excluded: flag unused parameter

  for each interface/type:
    if it has only one implementation/consumer and is not an API, persistence, or provider boundary: flag low-value abstraction
  ```
- Store:
  - `dead_abstraction_signals.unused_exports`
  - `dead_abstraction_signals.single_use_helpers`
  - `dead_abstraction_signals.unused_params`
  - `dead_abstraction_signals.low_value_interfaces`

#### 9. `missed_integration_updates`
- Purpose: catch source changes that fail to update companion tests, docs, contracts, or configs.
- Recommended implementation approach:
  ```text
  ensure git history is available:
    git fetch --unshallow if needed

  changed_files = source and supporting files changed in the last 7 days

  classify changed files into buckets:
    source logic
    tests
    contracts (monitoring/scenario-contract.yaml, monitoring/alert-policies.yaml, architecture/data-contract-rules.md)
    docs (product/, architecture/, specs/, docs/, README.md, CHANGELOG.md)
    config/workflows (.github/workflows/, package.json, tsconfig.json, scripts/, tools/)

  define companion expectations:
    source logic change -> usually test change
    contract change -> usually tests, docs, or runtime telemetry change
    monitoring change -> usually contract, alert-policy, or telemetry change
    workflow change -> usually docs/workflows change

  for each changed source file:
    detect file category from path and naming
    inspect same-window changes for companion files in expected categories
    if no companion update is found:
      flag a missed integration update

  aggregate:
    missed_integration_updates = total flagged source files
    files_missing_tests = flagged files missing test updates
    files_missing_docs_or_contract_updates = flagged files missing docs, schema, type, or config updates
  ```
- Store:
  - `missed_integration_updates`
  - `files_missing_tests`
  - `files_missing_docs_or_contract_updates`
  - `missed_integration_examples`

#### 10. `rework_rate_7d`
- Purpose: catch unstable code that gets re-touched repeatedly after landing.
- Recommended implementation approach:
  ```text
  ensure git history is available:
    git fetch --unshallow if needed

  inspect git log for last 7 days with numstat and names
  build per-file touch counts across source files under src/

  changed_files = count of unique changed source files
  repeatedly_touched_files = count of source files touched 2 or more times

  rework_rate_7d = repeatedly_touched_files / max(changed_files, 1)
  ```
- Store:
  - `rework_rate_7d`
  - `changed_source_files_7d`
  - `repeatedly_touched_files_7d`
  - `high_rework_files`

## Data Storage

Store as JSON Lines in `/tmp/gh-aw/repo-memory/default/history.jsonl`:
```json
{
  "date": "2024-01-15", 
  "timestamp": 1705334400, 
  "metrics": {
    "size": {...}, 
    "quality": {...}, 
    "tests": {...}, 
    "duplication": {
      "duplication_rate": 0.058
    },
    "ai_slop": {
      "type_escape_rate": 0.012,
      "type_escape_counts": {
        "any": 3,
        "as_any": 1,
        "ts_ignore": 0,
        "ts_expect_error": 1,
        "non_null_assertions": 4
      },
      "oversized_function_count": 2,
      "oversized_component_count": 1,
      "oversized_file_count": 0,
      "largest_units": [
        {
          "path": "src/webview/viewerState.ts",
          "unit_name": "computeSelectionGeometry",
          "unit_kind": "function",
          "loc": 214
        }
      ],
      "nesting_depth_violations": 3,
      "max_nesting_depth": 5,
      "error_swallow_count": 1,
      "testless_change_ratio": 0.71,
      "shallow_test_density": 0.28,
      "shallow_test_count": 7,
      "total_test_blocks": 25,
      "trivial_assertion_count": 4,
      "snapshot_only_test_count": 2,
      "generic_name_hits": 6,
      "generic_name_rate": 0.08,
      "dead_abstraction_signals": {
        "unused_exports": 2,
        "single_use_helpers": 3,
        "unused_params": 4,
        "low_value_interfaces": 1
      },
      "missed_integration_updates": 3,
      "files_missing_tests": 2,
      "files_missing_docs_or_contract_updates": 1,
      "rework_rate_7d": 0.42
    },
    "churn": {
      "source": {
        "files_modified": 123,
        "commits": 45,
        "lines_added": 1234,
        "lines_deleted": 567,
        "net_change": 667
      },
      "lock_files": {
        "files_modified": 89,
        "lines_added": 5678,
        "lines_deleted": 4321,
        "net_change": 1357
      }
    }, 
    "workflows": {...}, 
    "docs": {...}
  }
}
```

**Note**: Churn metrics are split into `source` (excludes `*.lock.yml`) and `lock_files` (only `*.lock.yml`) for separate tracking.

## AI Slop Signal Integration

Implement the separate AI slop analyzers in the same Python collection script that gathers size, duplication, and churn metrics.

Recommended structure:

```python
def collect_type_escape_metrics(src_root: Path) -> dict: ...
def collect_oversized_unit_metrics(src_root: Path) -> dict: ...
def collect_nesting_metrics(src_root: Path) -> dict: ...
def collect_error_swallow_metrics(src_root: Path) -> dict: ...
def collect_testless_change_metrics(repo_root: Path) -> dict: ...
def collect_shallow_test_density_metrics(repo_root: Path) -> dict: ...
def collect_generic_name_metrics(src_root: Path) -> dict: ...
def collect_dead_abstraction_metrics(src_root: Path) -> dict: ...
def collect_missed_integration_update_metrics(repo_root: Path) -> dict: ...
def collect_rework_metrics(repo_root: Path) -> dict: ...

current_metrics["ai_slop"] = {
    **collect_type_escape_metrics(src_root),
    **collect_oversized_unit_metrics(src_root),
    **collect_nesting_metrics(src_root),
    **collect_error_swallow_metrics(src_root),
    **collect_testless_change_metrics(repo_root),
    **collect_shallow_test_density_metrics(repo_root),
    **collect_generic_name_metrics(src_root),
    **collect_dead_abstraction_metrics(src_root),
    **collect_missed_integration_update_metrics(repo_root),
    **collect_rework_metrics(repo_root),
}
```

Integration requirements:

- Append the `ai_slop` object to each `history.jsonl` entry alongside existing metrics.
- Calculate 7-day and 30-day trends for each numeric AI slop metric.
- In the discussion report, include:
  - current value
  - 7-day trend
  - 30-day trend
  - notable offenders/examples for the metrics that support examples
- Treat these as separate heuristic quality signals. Do **not** combine them into a single weighted score.

## Data Visualization with Python

Generate **6 high-quality charts** to visualize code metrics and trends using Python, matplotlib, and seaborn. All charts must be uploaded as assets and embedded in the discussion report.

### Required Charts

#### 1. LOC by Language (`loc_by_language.png`)
**Type**: Horizontal bar chart
**Content**: Distribution of lines of code by programming language
- Sort by LOC descending
- Include percentage labels on bars
- Use color-coding by language type (e.g., compiled vs interpreted)
- Show total LOC in title
- Save to: `/tmp/gh-aw/python/charts/loc_by_language.png`

#### 2. Top Directories (`top_directories.png`)
**Type**: Horizontal bar chart
**Content**: Top 10 directories by lines of code
- Show full directory paths
- Display LOC count and percentage of total codebase
- Highlight key directories (src, tests, media, monitoring, architecture, product, specs, tools, docs)
- Use distinct colors for different directory types
- Save to: `/tmp/gh-aw/python/charts/top_directories.png`

#### 3. Quality Score Breakdown (`quality_score_breakdown.png`)
**Type**: Stacked bar or pie chart with breakdown
**Content**: Quality score component breakdown
- Test Coverage: 30%
- Code Organization: 25%
- Documentation: 20%
- Churn Stability: 15%
- Comment Density: 10%
- Show current score vs target (100%) for each component
- Use color gradient from red (poor) to green (excellent)
- Save to: `/tmp/gh-aw/python/charts/quality_score_breakdown.png`

#### 4. Test Coverage (`test_coverage.png`)
**Type**: Grouped bar chart or side-by-side comparison
**Content**: Test vs source code comparison
- Test LOC vs Source LOC by language
- Test-to-source ratio visualization
- Include trend indicator if historical data available
- Highlight recommended ratio (e.g., 0.5-1.0)
- Save to: `/tmp/gh-aw/python/charts/test_coverage.png`

#### 5. Code Churn (`code_churn.png`)
**Type**: Diverging bar chart
**Content**: Top 10 most changed source files in last 7 days
- **EXCLUDE** `*.lock.yml` files (generated workflow files)
- Show lines added (positive) and deleted (negative)
- Net change highlighting
- Color-code by file type
- Include file paths truncated if needed
- Save to: `/tmp/gh-aw/python/charts/code_churn.png`

#### 6. Historical Trends (`historical_trends.png`)
**Type**: Multi-line time series chart
**Content**: Track key metrics over 30 days
- Total LOC trend line
- Test coverage percentage trend line
- Quality score trend line
- Use multiple y-axes if scales differ significantly
- Show 7-day moving averages
- Annotate significant changes (>10%)
- Save to: `/tmp/gh-aw/python/charts/historical_trends.png`

### Chart Quality Standards

All charts must meet these quality standards:

- **DPI**: 300 minimum for publication quality
- **Figure Size**: 12x7 inches (consistent with daily-issues-report)
- **Styling**: Use seaborn styling (`sns.set_style("whitegrid")`)
- **Color Palette**: Professional colors (`sns.set_palette("husl")` or custom)
- **Labels**: Clear titles, axis labels, and legends
- **Grid Lines**: Enable for readability (`ax.grid(True, alpha=0.3)`)
- **Save Format**: PNG with `bbox_inches='tight'` for proper cropping

### Python Script Structure

Create a Python script to collect data, analyze metrics, and generate all 6 charts:

```python
#!/usr/bin/env python3
"""
Daily Code Metrics Analysis and Visualization
Generates 6 charts for code metrics tracking
"""
import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
import seaborn as sns
from datetime import datetime, timedelta
import json
from pathlib import Path

# Set style
sns.set_style("whitegrid")
sns.set_palette("husl")

# Load historical data from repo-memory
history_file = Path('/tmp/gh-aw/repo-memory/default/history.jsonl')
historical_data = []
if history_file.exists():
    with open(history_file, 'r') as f:
        for line in f:
            historical_data.append(json.loads(line))

# Load current metrics from data files
# (Collect metrics using bash commands and save to JSON first)
current_metrics = json.load(open('/tmp/gh-aw/python/data/current_metrics.json'))

# Generate each chart
# Chart 1: LOC by Language
# ... implementation ...

# Chart 2: Top Directories  
# ... implementation ...

# Chart 3: Quality Score Breakdown
# ... implementation ...

# Chart 4: Test Coverage
# ... implementation ...

# Chart 5: Code Churn
# ... implementation ...

# Chart 6: Historical Trends
# ... implementation ...

print("All charts generated successfully")
```

### Chart Upload and Embedding

After generating charts:

1. **Upload each chart as an asset**:
   - Use the `upload asset` safe-output tool for each PNG file
   - Collect the returned URLs for embedding

2. **Embed in discussion report**:
   ```markdown
   ## 📊 Visualizations
   
   ### LOC Distribution by Language
   ![LOC by Language](URL_FROM_UPLOAD_ASSET_1)
   
   ### Top Directories by LOC
   ![Top Directories](URL_FROM_UPLOAD_ASSET_2)
   
   ### Quality Score Breakdown
   ![Quality Score](URL_FROM_UPLOAD_ASSET_3)
   
   ### Test Coverage Analysis
   ![Test Coverage](URL_FROM_UPLOAD_ASSET_4)
   
   ### Code Churn (7 Days)
   ![Code Churn](URL_FROM_UPLOAD_ASSET_5)
   
   ### Historical Trends (30 Days)
   ![Historical Trends](URL_FROM_UPLOAD_ASSET_6)
   ```

## Trend Calculation

For each metric: current value, 7-day % change, 30-day % change, trend indicator (⬆️/➡️/⬇️)

## Report Format

Use detailed template with embedded visualization charts:

### Discussion Structure

**Title**: `Daily Code Metrics Report - YYYY-MM-DD`

**Body**:

```markdown
Brief 2-3 paragraph executive summary highlighting key findings, quality score, notable trends, and any concerns requiring attention.

### 📊 Visualizations

#### LOC Distribution by Language
![LOC by Language](URL_FROM_UPLOAD_ASSET)

[Analysis of language distribution and changes]

#### Top Directories by LOC
![Top Directories](URL_FROM_UPLOAD_ASSET)

[Analysis of directory sizes and organization]

#### Quality Score Breakdown
![Quality Score](URL_FROM_UPLOAD_ASSET)

[Current quality score and component analysis]

#### Test Coverage Analysis
![Test Coverage](URL_FROM_UPLOAD_ASSET)

[Test coverage metrics and recommendations]

#### Code Churn (Last 7 Days)
![Code Churn](URL_FROM_UPLOAD_ASSET)

[Most changed source files and activity patterns - excludes generated *.lock.yml files]

#### Historical Trends (30 Days)
![Historical Trends](URL_FROM_UPLOAD_ASSET)

[Trend analysis and significant changes]

<details>
<summary>📈 Detailed Metrics</summary>

### Size Metrics

#### Lines of Code by Language
| Language | LOC | % of Total | Change (7d) |
|----------|-----|------------|-------------|
| TypeScript | X,XXX | XX% | ⬆️ +X% |
| JavaScript | X,XXX | XX% | ➡️ 0% |
| ... | ... | ... | ... |

#### Lines of Code by Directory
| Directory | LOC | % of Total | Files |
|-----------|-----|------------|-------|
| src/ | X,XXX | XX% | XXX |
| tests/ | X,XXX | XX% | XX |
| ... | ... | ... | ... |

### Quality Indicators

- **Average File Size**: XXX lines
- **Large Files (>500 LOC)**: XX files
- **Function Count**: X,XXX functions
- **Comment Lines**: X,XXX lines (XX% ratio)
- **Comment Density**: XX%

### Duplication

- **Duplication Rate**: X.XX%

### AI Slop Signals

#### Type Escapes

- **Type Escape Rate** (`type_escape_rate`): X.XXX
- **`any` Annotations**: XX
- **`as any` Casts**: XX
- **`@ts-ignore` Count**: XX
- **`@ts-expect-error` Count**: XX
- **Non-Null Assertions**: XX

#### Oversized Units

- **Oversized Functions**: XX
- **Oversized Components**: XX
- **Oversized Files**: XX

#### Control Flow Complexity

- **Nesting Depth Violations** (`nesting_depth_violations`): XX
- **Max Nesting Depth** (`max_nesting_depth`): XX

#### Silent Failure Signals

- **Error Swallow Count** (`error_swallow_count`): XX

#### Test Coverage of Change

- **Testless Change Ratio** (`testless_change_ratio`): X.XX

#### Test Quality

- **Shallow Test Density** (`shallow_test_density`): X.XX
- **Shallow Test Count**: XX
- **Total Test Blocks**: XX
- **Trivial Assertion Count**: XX
- **Snapshot-Only Test Count**: XX

#### Naming Quality

- **Generic Name Hits** (`generic_name_hits`): XX
- **Generic Name Rate** (`generic_name_rate`): X.XX

#### Dead Abstraction Signals

- **Unused Exports**: XX
- **Single-Use Helpers**: XX
- **Unused Parameters**: XX
- **Low-Value Interfaces**: XX

#### Integration Drift

- **Missed Integration Updates** (`missed_integration_updates`): XX
- **Files Missing Tests**: XX
- **Files Missing Docs or Contract Updates**: XX

#### Rework

- **Rework Rate (7d)** (`rework_rate_7d`): X.XX
- **Changed Source Files (7d)**: XX
- **Repeatedly Touched Files (7d)**: XX

Include 1-3 top offenders or examples for any metric with actionable examples available.

### Test Coverage

- **Test Files**: XX files
- **Test LOC** (`test_lines_of_code`): X,XXX lines
- **Source LOC**: X,XXX lines  
- **Test-to-Source Ratio** (`test_to_source_ratio`): X.XX
- **Trend (7d)**: ⬆️ +X%
- **Trend (30d)**: ⬆️ +X%

### Code Churn (Last 7 Days)

#### Source Code Churn (Excludes *.lock.yml)

- **Files Modified**: XXX files
- **Commits**: XXX commits
- **Lines Added**: +X,XXX lines
- **Lines Deleted**: -X,XXX lines
- **Net Change**: +/-X,XXX lines

#### Most Active Source Files
1. path/to/file.ts: +XXX/-XXX lines
2. path/to/file.js: +XXX/-XXX lines
...

#### Workflow Lock File Churn (*.lock.yml only)

- **Lock Files Modified**: XXX files
- **Lines Added**: +X,XXX lines
- **Lines Deleted**: -X,XXX lines
- **Net Change**: +/-X,XXX lines

**Note**: Lock file churn is reported separately and excluded from quality score calculations to avoid noise from generated files.

### Workflow Metrics

- **Total Workflow Files (.md)** (`total_workflows`): XXX files
- **Compiled Workflows (.lock.yml)**: XXX files
- **Average Workflow Size**: XXX lines
- **Growth (7d)**: ⬆️ +X%

### Documentation

- **Doc Files (docs/)**: XXX files
- **Doc LOC**: X,XXX lines
- **Code-to-Docs Ratio**: X.XX:1
- **Documentation Coverage**: XX%

### Quality Score: XX/100

#### Component Breakdown
- **Test Coverage (30%)**: XX/30 points
- **Code Organization (25%)**: XX/25 points
- **Documentation (20%)**: XX/20 points
- **Churn Stability (15%)**: XX/15 points
- **Comment Density (10%)**: XX/10 points

**Note**: Duplication rate is an informational signal for `src/` only and is **not yet included** in the weighted quality score.

</details>

### 💡 Insights & Recommendations

1. [Specific actionable recommendation based on metrics]
2. [Another recommendation]
3. [Focus area for improvement]
4. [...]

---
*Report generated by Daily Code Metrics workflow*
*Historical data: 30 days | Last updated: YYYY-MM-DD HH:MM UTC*
```

### Report Guidelines

- **Report Formatting**: Use h3 (###) or lower for all headers in your report to maintain proper document hierarchy. Wrap long sections in `<details><summary>Section Name</summary>` tags to improve readability and reduce scrolling.
- Include all 6 visualization charts as embedded images
- Upload charts using `upload asset` tool for permanent URLs
- Provide brief analysis for each chart
- Use collapsible details section for detailed metrics tables
- Highlight trends with emoji indicators (⬆️/➡️/⬇️)
- Calculate and display quality score prominently
- Always calculate and report duplication metrics using the normalized-line definition above
- Always calculate and report the separate `ai_slop` metrics; do not summarize them as a single score
- Provide 3-5 actionable recommendations
- Include metadata footer with generation info

## Quality Score

Weighted average: Test coverage (30%), Code organization (25%), Documentation (20%), Churn stability (15%), Comment density (10%)

### Churn Stability Component (15% of Quality Score)

**CRITICAL**: Use **source code churn only** (exclude `*.lock.yml` files) when calculating churn stability for the quality score.

**Calculation**:
1. Calculate source code churn: `git log --since="7 days ago" --numstat --pretty=format: -- . ':!*.lock.yml'`
2. Compute churn score based on files modified and net change (lower churn = higher stability)
3. Normalize to 0-15 points scale
4. Track workflow lock file churn separately for informational purposes only

This ensures the quality score reflects actionable source code volatility, not noise from generated files.

## Guidelines

- Comprehensive but efficient (complete in 15min)
- Calculate trends accurately, flag >10% changes
- Use repo memory for persistent history (90-day retention)
- Handle missing data gracefully
- Visual indicators for quick scanning
- Generate all 6 required visualization charts
- Upload charts as assets for permanent URLs
- Embed charts in discussion report with analysis
- Store metrics to repo memory, create discussion report with visualizations

{{#runtime-import shared/noop-reminder.md}}
