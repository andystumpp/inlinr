 # Product Outline

 ## Product summary

 Inlinr is a VS Code extension for inline, selection-based AI editing of Markdown. It lets users highlight text in docs, specs, and prompts, leave targeted change requests or comments, and apply AI-assisted revisions directly in the editor without copy-pasting into chat.

 ## Problem statement

 Markdown has become a working format for prompting, planning, specs, and agent collaboration, but it is still awkward to iterate on precisely. Users often have to describe "the sixth sentence" or copy and paste snippets into chat just to request a change.

 That breaks flow, weakens context, and makes revisions less precise than they should be. Inlinr should make AI editing feel attached to the exact text the user selected.

 ## Target users

 - Prompt writers and spec authors working in Markdown
 - Engineers, product builders, and operators iterating on docs with AI
 - Anyone using Markdown as a control surface for AI agents or structured thinking

 ## Vision

 Create a Markdown editing experience in VS Code that feels like "ask for changes" applied directly to selected text: fast, precise, reviewable, and easier than bouncing between editor and chat.

 ## Core product experience

 - The user selects text in a Markdown document
 - The user invokes an inline action and asks for a specific change
 - Inlinr sends only the needed context to an AI layer
 - Inlinr returns a scoped suggestion that preserves Markdown structure where possible
 - The user reviews and applies, rejects, or refines the suggested change

 ## Initial scope

 - Start with Markdown only
 - Start with VS Code only
 - Focus on selection-based editing, comments, and revision requests
 - Keep edits targeted and reviewable rather than broad and autonomous
 - Support rapid iteration on prompts, specs, and working docs

 ## Key challenges and risks

 - Keeping selections anchored as documents change
 - Preserving Markdown structure, formatting, and author intent
 - Showing edits clearly enough that users trust what changed
 - Sending enough context for good suggestions without over-sharing document content

 ## Product direction assumptions

 - The default flow should be inline and selection-first, not chat-first
 - Users should stay in control of when edits are applied
 - The product should optimize for precision and iteration rather than maximum automation
 - Product behavior should stay understandable even when AI output quality varies

 ## Development workflow

 Use `product/development-workflow.md` as the default path from user scenario to architecture check, spec, planning, implementation, testing, and verification.