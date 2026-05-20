// Markdown document content for the demo, plus initial Inlinr state per block.
// Block "states" describe what Inlinr surface is attached to that block in the
// initial demo: idle | prompting | thinking | reviewing.
window.INLINR_DOC = [
  { id: "h-title",   kind: "h1", text: "Product Outline", line: 1 },
  { id: "blank-1",   kind: "blank" },

  { id: "h-summary", kind: "h2", text: "Product summary", line: 3 },
  { id: "blank-2",   kind: "blank" },
  {
    id: "p-summary", kind: "p", line: 5,
    text: "Inlinr is a VS Code extension for inline, selection-based AI editing of Markdown. It lets users highlight text in docs, specs, and prompts, leave targeted change requests, and apply AI-assisted revisions directly in the editor — without copy-pasting into chat.",
    state: "idle"
  },
  { id: "blank-3",   kind: "blank" },

  { id: "h-problem", kind: "h2", text: "Problem statement", line: 7 },
  { id: "blank-4",   kind: "blank" },
  {
    id: "p-problem-1", kind: "p", line: 9,
    // This paragraph is in "reviewing" state — a diff is on screen
    state: "reviewing",
    prompt: "Make this punchier and cut the hedging",
    diff: [
      { t: "eq",  text: "Markdown has " },
      { t: "del", text: "become a working format" },
      { t: "ins", text: "quietly become the lingua franca" },
      { t: "eq",  text: " for prompting, planning, specs, and agent collaboration" },
      { t: "del", text: ", but it is still awkward to iterate on precisely" },
      { t: "ins", text: " — yet iterating on it is still clumsy" },
      { t: "eq",  text: "." },
    ],
  },
  { id: "blank-5",   kind: "blank" },
  {
    id: "p-problem-2", kind: "p", line: 11,
    text: "Users often have to describe \"the sixth sentence\" or copy and paste snippets into chat just to request a change. That breaks flow, weakens context, and makes revisions less precise than they should be.",
    state: "idle"
  },
  { id: "blank-6",   kind: "blank" },

  { id: "h-vision",  kind: "h2", text: "Vision", line: 13 },
  { id: "blank-7",   kind: "blank" },
  {
    id: "p-vision",  kind: "p", line: 15,
    // Thinking state — AI is generating
    state: "thinking",
    prompt: "Tighten this to a single sentence",
    text: "Create a Markdown editing experience in VS Code that feels like \"ask for changes\" applied directly to selected text: fast, precise, reviewable, and easier than bouncing between editor and chat.",
  },
  { id: "blank-8",   kind: "blank" },

  { id: "h-scope",   kind: "h2", text: "Initial scope", line: 17 },
  { id: "blank-9",   kind: "blank" },
  { id: "li-1", kind: "li", line: 19, text: "Start with Markdown only", state: "idle" },
  { id: "li-2", kind: "li", line: 20, text: "Start with VS Code only", state: "idle" },
  {
    id: "li-3", kind: "li", line: 21,
    // Prompting state — input is open with a draft
    state: "prompting",
    text: "Focus on selection-based editing, comments, and revision requests",
    promptDraft: "split this into two bullets",
  },
  { id: "li-4", kind: "li", line: 22, text: "Keep edits targeted and reviewable rather than broad and autonomous", state: "idle" },
  { id: "li-5", kind: "li", line: 23, text: "Support rapid iteration on prompts, specs, and working docs", state: "idle" },
  { id: "blank-10",  kind: "blank" },

  { id: "h-risks",   kind: "h2", text: "Key challenges and risks", line: 25 },
  { id: "blank-11",  kind: "blank" },
  {
    id: "p-risks", kind: "p", line: 27,
    state: "reviewing",
    prompt: "Rewrite as three concrete risks",
    diff: [
      { t: "del", text: "Keeping selections anchored as documents change. Preserving Markdown structure, formatting, and author intent. Showing edits clearly enough that users trust what changed. Sending enough context for good suggestions without over-sharing document content." },
      { t: "ins", text: "Selections may drift as the surrounding document is edited. Suggestions may break Markdown structure or shift author intent. Diffs may not be clear enough for users to trust what is about to change." },
    ],
  },
  { id: "blank-12",  kind: "blank" },

  { id: "h-assump",  kind: "h2", text: "Direction assumptions", line: 29 },
  { id: "blank-13",  kind: "blank" },
  { id: "li-a1", kind: "li", line: 31, text: "The default flow should be inline and selection-first, not chat-first.", state: "idle" },
  { id: "li-a2", kind: "li", line: 32, text: "Users should stay in control of when edits are applied.", state: "idle" },
  { id: "li-a3", kind: "li", line: 33, text: "Optimize for precision and iteration rather than maximum automation.", state: "idle" },
];

// Tokens for the gutter sidebar panel — listed in document order.
window.INLINR_QUEUE = [
  { blockId: "p-problem-1", label: "Make this punchier and cut hedging",  state: "reviewing", line: 9 },
  { blockId: "p-vision",    label: "Tighten this to a single sentence",   state: "thinking",  line: 15 },
  { blockId: "li-3",        label: "split this into two bullets",         state: "prompting", line: 21 },
  { blockId: "p-risks",     label: "Rewrite as three concrete risks",     state: "reviewing", line: 27 },
];
