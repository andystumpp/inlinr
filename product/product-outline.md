 # Product Outline

## Product summary

Inlinr is a VS Code extension for Markdown-first editing in AI-driven development workflows. It gives users a strong rendered view of Markdown artifacts plus inline, selection-based AI editing and lightweight authoring actions for docs, specs, prompts, and plans without bouncing into a separate chat workflow.

 ## Problem statement

Markdown has become a working format for prompting, planning, specs, and agent collaboration, but it is still awkward to edit precisely while also seeing how the document reads when rendered. Users often bounce between raw Markdown, preview, and chat just to make a small change or request a targeted revision.

That breaks flow, weakens context, and makes revisions less precise than they should be. Inlinr should make Markdown authoring and AI editing feel attached to the document itself, especially the exact text and structure the user is working on.

 ## Target users

- Prompt writers and spec authors working in Markdown
- Engineers, product builders, and operators iterating on prompts, specs, plans, and other Markdown artifacts with AI
- Anyone using Markdown as a control surface for AI agents or structured thinking

 ## Vision

Create the best Markdown editing experience in VS Code for AI-driven development: rendered, readable, precise, reviewable, and faster than bouncing between editor, preview, and chat.

## Core product experience

- The user works in a Markdown document with a rendered view that makes structure and meaning easy to scan
- The user can make lightweight Markdown authoring changes, such as formatting or structure adjustments, without leaving document context
- The user selects text in a Markdown document and invokes an inline action for a specific AI-assisted change
- Inlinr sends only the needed context to an AI layer
- Inlinr returns a scoped suggestion that preserves Markdown structure and rendered intent where possible
- The user reviews and applies, rejects, or refines the suggested change

 ## Initial scope

- Start with Markdown only
- Start with VS Code only
- Focus on prompts, specs, plans, and working docs used in AI-driven development
- Support a polished rendered view alongside trustworthy Markdown editing
- Include lightweight Markdown authoring actions alongside selection-based AI editing
- Keep edits targeted and reviewable rather than broad and autonomous
- Support rapid iteration on prompts, specs, and working docs

 ## Key challenges and risks

- Keeping selections anchored as documents change
- Preserving Markdown structure, formatting, and author intent
- Keeping rendered output aligned with source edits and scoped AI suggestions
- Showing edits clearly enough that users trust what changed
- Sending enough context for good suggestions without over-sharing document content

 ## Product direction assumptions

- The default flow should be document-first and selection-enhanced, not chat-first
- The rendered view should stay aligned with source editing so users can trust what they are reading and changing
- Users should stay in control of when edits are applied
- The product should optimize for precision and iteration rather than maximum automation
- Product behavior should stay understandable even when AI output quality varies

 ## Development workflow

 Use `product/development-workflow.md` as the default path from user scenario to architecture check, spec, planning, implementation, testing, and verification.
