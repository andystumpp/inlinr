# Markdown Presentation Roadmap

## Purpose

Define how Inlinr should evolve its rendered Markdown presentation so long prompts, specs, plans, and agent artifacts are easier to read without turning the product into a WYSIWYG editor.

## Product stance

- Inlinr should make Markdown look polished, readable, and structured inside VS Code.
- Inlinr should not assume one layout or styling system works for every user or every Markdown artifact.
- Inlinr should offer a small set of curated presentation presets rather than arbitrary document theming.
- Presets should change presentation, not source Markdown semantics.
- The rendered view should stay selection-friendly and preserve trust between source and preview.

## Why this matters now

AI-driven development workflows produce long Markdown files with dense headings, lists, checklists, tables, and callouts. The current Markdown ecosystem is strong on syntax portability but inconsistent on presentation quality, especially for long-form spec reading. Inlinr can differentiate by making Markdown documents feel intentionally designed for reading and editing, not merely parsed into HTML.

## What good looks like

1. A long Markdown spec is easy to scan because hierarchy, spacing, tables, and section breaks are visually clear.
2. A user can switch between a few presentation presets based on the task without changing the file itself.
3. The rendered surface remains theme-aware and native to VS Code rather than imposing a fixed brand style.
4. Selection, inline review, and source alignment remain more important than decorative layout.

## Preset strategy

### Principles

- Start with a small preset set and make each preset meaningfully different.
- Keep color driven by VS Code theme tokens wherever possible.
- Use presets mainly to vary typography, density, spacing, reading width, and heading treatment.
- Avoid per-user arbitrary CSS injection in early versions.
- Apply presets at the viewer level so the same Markdown file can be read differently by different users.

### Recommended initial presets

| Preset | Best for | Characteristics |
|---|---|---|
| **Balanced** | Default everyday reading | Clean GitHub/VS Code-like hierarchy, moderate spacing, medium reading width |
| **Dense Spec** | Long agent specs, plans, and technical docs | Tighter spacing, stronger section separation, compact tables, higher information density |
| **Comfortable Reading** | Narrative docs, prompts, review passes | Wider spacing, slightly larger type, calmer rhythm, reduced density |
| **Review Focus** | Comparing and approving changes | Stronger selection contrast, clearer block boundaries, slightly simplified typography |

These presets should share the same semantic rendering model so users are changing presentation, not behavior.

## Presentation building blocks

### Foundation typography

- Strong h1-h6 scale
- Better paragraph and list spacing
- Styled horizontal rules
- Improved inline code and fenced code treatment
- Table styling suitable for requirements and comparison sections

### Long-document readability

- Constrained reading width for prose
- Better section spacing
- Optional heading anchors
- Optional compact top-of-document table of contents for very long files

### Spec-native patterns

- Task list rendering
- Callouts and admonition-like styling
- Better blockquote treatment
- Distinct styling for metadata blocks, status blocks, or summary sections when represented in standard Markdown patterns

### Preset-specific controls

- Density
- Reading width
- Heading scale and divider emphasis
- Table compactness
- Inline code prominence
- Selection highlight intensity

## Roadmap

### Phase 1: Reading quality foundation

Goal: make the default rendered Markdown view feel clearly more polished before adding user choice.

- Add a full Markdown typography layer for headings, paragraphs, lists, tables, rules, and code.
- Adopt a consistent hierarchy style closer to GitHub and VS Code than to Word.
- Keep colors theme-aware through VS Code tokens.
- Protect selection and inline review affordances while styling headings and blocks.

Success signal: long Markdown documents feel intentionally designed instead of browser-default.

### Phase 2: Presentation presets

Goal: support different reading preferences without fragmenting the product.

- Introduce preset selection in the rendered viewer with one primary in-view control.
- Ship the first curated preset set: Balanced, Dense Spec, Comfortable Reading, and Review Focus.
- Store preset preference per user, not in the Markdown file.
- Make preset switching immediate so users can compare layouts in context.

Recommended Phase 2 delivery scope:

- Add a single preset model shared by the extension host and webview so preset changes only affect presentation tokens, spacing, width, and emphasis settings.
- Implement presets as layered CSS variables on top of one semantic HTML structure rather than separate rendering templates.
- Default new users to **Balanced** and persist the last selected preset as a user-level VS Code preference.
- Rehydrate the saved preset whenever a Markdown document opens in the Inlinr viewer.
- Apply preset changes without disrupting selection state, request popup state, inline review state, or source alignment.
- Keep preset labels task-oriented and plain language so the choice feels like a reading mode, not a theme system.

Recommended switch location:

- Put the primary switch in the **viewer header**, next to **Open Raw Markdown**, as a compact dropdown or segmented button labeled with the active preset, such as **View: Balanced**.
- Keep the switch visible at the document level because presets are a viewer concern and users should be able to compare modes while reading the current file.
- Add a secondary command-palette and editor-title action such as **Inlinr: Switch Presentation Preset** for keyboard-first access, but treat the in-view header control as the main affordance.
- Do not bury the first implementation only in extension settings; settings can provide a default, but the actual switch should live on the rendered surface.

Implementation notes:

- Add the active preset to viewer state so the webview can render the correct mode immediately on load.
- Attach the preset to the viewer root as a stable attribute or class, then let CSS preset tokens control density, width, heading treatment, table compactness, and selection emphasis.
- Keep switching local and instant; Phase 2 should not require provider calls, document edits, or file metadata changes.

Success signal: users can choose a reading mode that fits dense specs, review work, or more relaxed reading without losing orientation.

### Phase 3: Spec-friendly semantics

Goal: make AI-generated and spec-heavy Markdown patterns render better out of the box.

- Improve task list rendering.
- Add callout styling for common patterns such as GitHub Alerts.
- Add heading anchors.
- Improve metadata, summary, and divider patterns that are common in AI-agent specs.

Success signal: common spec constructs look deliberate without requiring users to learn a new authoring format.

### Phase 4: Long-document navigation

Goal: help users move through very long Markdown documents while keeping the document surface central.

- Evaluate a lightweight table of contents or section jump menu.
- Explore collapsible sections for appendices or generated context blocks.
- Keep navigation secondary to document reading and selection-based editing.

Success signal: users can move through long documents faster without the rendered view feeling overloaded.

### Phase 5: Adaptive refinement

Goal: improve presets and presentation based on real usage rather than inventing a full design system upfront.

- Learn which presets users keep, switch to, or ignore.
- Refine preset definitions instead of expanding the preset count too quickly.
- Add only a small number of additional presets if distinct needs emerge.

Success signal: Inlinr supports clear reading modes without becoming a theme marketplace.

## Guardrails

- Do not turn Inlinr into a full WYSIWYG document editor.
- Do not require custom Markdown dialects just to get attractive rendering.
- Do not let decorative styling interfere with text selection, anchoring, inline review, or source trust.
- Do not ship too many presets early; curated clarity is better than endless customization.
- Do not encode user-specific presentation choices into shared Markdown files.

## Near-term product decisions

1. Use theme-aware presets, not arbitrary freeform theming, for the first implementation.
2. Make the default visual language feel closer to GitHub and VS Code than to Word or Notion.
3. Optimize especially for long AI-agent specs, plans, prompts, and working documents.
4. Treat selection clarity and reviewability as constraints on every presentation change.
