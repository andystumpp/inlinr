// Inlinr surfaces + diff renderers.
// Surfaces: popover (over selection), codelens (action strip above block).
// Diff styles: inline-redgreen, strikethrough-ghost, block-card, side-by-side.
// Visual direction: native (matches VS Code chrome) vs branded (subtle Inlinr accent).

/* ──────────────────────────────────────────────────────────────────────
   Inlinr CSS — scoped to .inlinr-* classes
   ─────────────────────────────────────────────────────────────────── */
const INLINR_STYLE = `
  /* Popover (anchored above selection, like the screenshot) */
  .inl-pop {
    position: relative;
    display: inline-flex;
    align-items: center;
    background: #ffffff;
    border: 1px solid #d4d4d8;
    border-radius: 10px;
    box-shadow: 0 8px 28px rgba(0,0,0,0.14), 0 2px 6px rgba(0,0,0,0.08);
    padding: 4px;
    height: 36px;
    gap: 0;
    font-size: 13px;
    color: #1f1f1f;
  }
  .inl-pop[data-tone="branded"] {
    border-color: var(--inlinr-accent-border, #bcd9f1);
    box-shadow: 0 8px 28px rgba(0,0,0,0.14),
                0 0 0 1px var(--inlinr-accent-ring, rgba(0,120,212,0.12));
  }
  .inl-pop .inl-prompt-input {
    flex: 1; min-width: 0; max-width: 360px;
    height: 28px;
    border: 0; outline: 0; background: transparent;
    padding: 0 10px 0 12px;
    font: inherit; color: inherit;
    font-size: 13.5px;
  }
  .inl-pop .inl-prompt-input::placeholder { color: #8a8a8a; }
  .inl-pop .inl-kbd {
    font-family: -apple-system, system-ui, sans-serif;
    font-size: 11px;
    color: #8a8a8a;
    background: #f3f3f3;
    border: 1px solid #e0e0e0;
    border-bottom-width: 1.5px;
    border-radius: 4px;
    padding: 1px 5px;
    margin-right: 6px;
  }
  .inl-pop .inl-sep { width: 1px; height: 18px; background: #e5e5e5; margin: 0 2px; }
  .inl-pop .inl-btn {
    height: 28px;
    padding: 0 9px;
    display: inline-flex; align-items: center; gap: 6px;
    border-radius: 6px;
    color: #424242;
    font-size: 12.5px;
    font-weight: 500;
  }
  .inl-pop .inl-btn:hover { background: rgba(0,0,0,0.05); color: #1f1f1f; }
  .inl-pop .inl-btn[data-primary] {
    background: var(--inlinr-accent, #0078d4);
    color: white;
  }
  .inl-pop .inl-btn[data-primary]:hover { background: var(--inlinr-accent-deep, #006bbe); }
  .inl-pop .inl-btn .inl-arrow { color: #6c6c6c; }

  /* Popover beak */
  .inl-pop::after {
    content: "";
    position: absolute; bottom: -7px; left: var(--beak, 32px);
    width: 12px; height: 12px;
    background: inherit;
    border-right: 1px solid #d4d4d8;
    border-bottom: 1px solid #d4d4d8;
    transform: rotate(45deg);
    background: white;
  }
  .inl-pop[data-tone="branded"]::after {
    border-color: var(--inlinr-accent-border, #bcd9f1);
  }

  /* Inlinr CodeLens (above a block) */
  .inl-lens {
    display: inline-flex;
    align-items: center;
    gap: 0;
    font-size: 12px;
    color: #6c6c6c;
    line-height: 22px;
    height: 22px;
    padding-left: 0;
  }
  .inl-lens .inl-lens-act {
    color: var(--inlinr-accent, #0078d4);
    cursor: default;
    display: inline-flex; align-items: center; gap: 4px;
  }
  .inl-lens .inl-lens-act:hover { text-decoration: underline; }
  .inl-lens .inl-lens-sep { color: #c0c0c0; padding: 0 8px; }
  .inl-lens .inl-lens-sparkle { color: var(--inlinr-accent, #0078d4); }

  /* Active prompting card (full-width below selection) */
  .inl-prompt-card {
    border: 1px solid #d4d4d8;
    border-radius: 10px;
    background: #ffffff;
    box-shadow: 0 6px 20px rgba(0,0,0,0.08), 0 1px 3px rgba(0,0,0,0.04);
    padding: 0;
    margin: 8px 0 4px;
    overflow: hidden;
  }
  .inl-prompt-card[data-tone="branded"] {
    border-color: var(--inlinr-accent-border, #bcd9f1);
    background: linear-gradient(180deg, var(--inlinr-tint, #f0f7ff) 0%, #ffffff 60%);
  }
  .inl-prompt-card .inl-pc-head {
    display: flex; align-items: center; gap: 6px;
    padding: 8px 12px 6px;
    font-size: 11px;
    color: #6c6c6c;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    font-weight: 600;
  }
  .inl-prompt-card .inl-pc-head .inl-sparkle { color: var(--inlinr-accent, #0078d4); }
  .inl-prompt-card .inl-pc-body { padding: 0 12px 10px; }
  .inl-prompt-card textarea.inl-pc-input {
    width: 100%;
    border: 0; outline: 0;
    background: transparent;
    font: inherit;
    font-size: 14px;
    line-height: 20px;
    resize: none;
    color: #1f1f1f;
    padding: 2px 0 6px;
    min-height: 24px;
    font-family: -apple-system, system-ui, sans-serif;
  }
  .inl-prompt-card .inl-pc-actions {
    display: flex; align-items: center; gap: 6px;
    padding: 6px 10px 10px;
    font-size: 12px;
  }
  .inl-prompt-card .inl-pc-actions .inl-spacer { flex: 1; }
  .inl-prompt-card .inl-chip {
    display: inline-flex; align-items: center; gap: 5px;
    padding: 3px 8px;
    border-radius: 6px;
    background: #f3f3f3;
    color: #424242;
    font-size: 11.5px;
    font-weight: 500;
    border: 1px solid #e5e5e5;
  }
  .inl-prompt-card .inl-chip:hover { background: #ebebeb; }
  .inl-prompt-card .inl-cta {
    padding: 5px 12px;
    border-radius: 6px;
    background: var(--inlinr-accent, #0078d4);
    color: white;
    font-size: 12px;
    font-weight: 500;
    display: inline-flex; align-items: center; gap: 6px;
  }
  .inl-prompt-card .inl-cta-ghost {
    padding: 5px 10px;
    border-radius: 6px;
    color: #424242;
    font-size: 12px;
  }
  .inl-prompt-card .inl-cta-ghost:hover { background: rgba(0,0,0,0.05); }

  /* Diff review card */
  .inl-diff {
    border: 1px solid #e0e0e0;
    border-left: 3px solid var(--inlinr-accent, #0078d4);
    border-radius: 8px;
    background: #ffffff;
    margin: 6px 0 4px;
    overflow: hidden;
    box-shadow: 0 1px 4px rgba(0,0,0,0.04);
  }
  .inl-diff[data-tone="branded"] {
    border-color: var(--inlinr-accent-border, #bcd9f1);
    border-left-color: var(--inlinr-accent, #0078d4);
  }
  .inl-diff-head {
    display: flex; align-items: center; gap: 8px;
    padding: 8px 12px;
    font-size: 11.5px;
    color: #424242;
    background: #fafafa;
    border-bottom: 1px solid #f0f0f0;
  }
  .inl-diff[data-tone="branded"] .inl-diff-head {
    background: var(--inlinr-tint, #f0f7ff);
  }
  .inl-diff-head .inl-diff-prompt {
    flex: 1;
    color: #1f1f1f;
    font-weight: 500;
    font-size: 12.5px;
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  }
  .inl-diff-head .inl-diff-meta {
    font-size: 11px;
    color: #6c6c6c;
    font-variant-numeric: tabular-nums;
  }
  .inl-diff-head .inl-sparkle { color: var(--inlinr-accent, #0078d4); flex-shrink: 0; }

  .inl-diff-body { padding: 8px 12px; font-size: 15px; line-height: 24px; }
  .inl-diff-body .inl-diff-label {
    text-transform: uppercase;
    font-size: 10px;
    color: #6c6c6c;
    letter-spacing: 0.05em;
    font-weight: 600;
    margin: 0 0 4px;
  }
  .inl-diff-body .inl-row {
    padding: 6px 10px;
    border-radius: 4px;
    margin: 2px 0;
  }
  .inl-diff-body .inl-row-del { background: rgba(255, 80, 80, 0.06); }
  .inl-diff-body .inl-row-ins { background: rgba(45, 165, 105, 0.07); }
  .inl-diff-body .inl-row-marker {
    display: inline-block; width: 14px;
    font-family: "SF Mono", Menlo, monospace;
    font-size: 13px;
    color: #6c6c6c;
    margin-right: 6px;
  }
  .inl-diff-body .inl-row-del .inl-row-marker { color: #b32424; }
  .inl-diff-body .inl-row-ins .inl-row-marker { color: #156d3d; }

  .inl-diff-foot {
    display: flex; align-items: center; gap: 8px;
    padding: 8px 12px;
    border-top: 1px solid #f0f0f0;
    background: #fafafa;
  }
  .inl-diff[data-tone="branded"] .inl-diff-foot {
    background: linear-gradient(0deg, var(--inlinr-tint, #f0f7ff) 0%, #ffffff 100%);
  }
  .inl-diff-foot .inl-spacer { flex: 1; }
  .inl-diff-foot .inl-btn-accept {
    padding: 5px 12px;
    border-radius: 6px;
    background: #1f8a5b;
    color: white;
    font-size: 12px;
    font-weight: 500;
    display: inline-flex; align-items: center; gap: 5px;
  }
  .inl-diff-foot .inl-btn-accept:hover { background: #176c47; }
  .inl-diff-foot .inl-btn-reject {
    padding: 5px 12px;
    border-radius: 6px;
    color: #424242;
    font-size: 12px;
    font-weight: 500;
  }
  .inl-diff-foot .inl-btn-reject:hover { background: rgba(0,0,0,0.05); }
  .inl-diff-foot .inl-btn-refine {
    padding: 5px 10px;
    border-radius: 6px;
    color: var(--inlinr-accent, #0078d4);
    font-size: 12px;
    font-weight: 500;
    display: inline-flex; align-items: center; gap: 5px;
    border: 1px solid transparent;
  }
  .inl-diff-foot .inl-btn-refine:hover {
    background: var(--inlinr-tint, #f0f7ff);
    border-color: var(--inlinr-accent-border, #bcd9f1);
  }
  .inl-diff-foot .inl-kbd-small {
    font-size: 10.5px; color: #8a8a8a;
    padding: 1px 4px; background: #f3f3f3;
    border: 1px solid #e0e0e0; border-radius: 3px;
    margin-left: 4px;
  }

  /* Side-by-side diff */
  .inl-sxs { display: grid; grid-template-columns: 1fr 1fr; gap: 0; }
  .inl-sxs > div { padding: 10px 12px; font-size: 14px; line-height: 22px; }
  .inl-sxs > div + div { border-left: 1px dashed #e5e5e5; }
  .inl-sxs .inl-diff-label { margin-bottom: 6px; }

  /* Block card */
  .inl-block-card {
    padding: 10px 12px;
    font-size: 14.5px; line-height: 22px;
  }
  .inl-block-card .inl-bc-original {
    color: rgba(0,0,0,0.45);
    text-decoration: line-through;
    text-decoration-color: rgba(0,0,0,0.3);
    margin-bottom: 8px;
    font-size: 13.5px;
  }
  .inl-block-card .inl-bc-arrow {
    color: var(--inlinr-accent, #0078d4);
    margin: 4px 0;
    font-size: 11px; font-weight: 600; letter-spacing: 0.04em;
    text-transform: uppercase;
  }
  .inl-block-card .inl-bc-new { color: #1f1f1f; }

  /* Thinking state */
  .inl-thinking {
    padding: 12px;
    font-size: 14px; line-height: 22px;
  }
  .inl-thinking .inl-think-row {
    display: flex; align-items: center; gap: 8px;
    color: #6c6c6c;
    font-size: 12px;
  }
  .inl-thinking .inl-dots {
    display: inline-flex; gap: 3px;
  }
  .inl-thinking .inl-dots i {
    width: 6px; height: 6px; border-radius: 50%;
    background: var(--inlinr-accent, #0078d4);
    animation: inl-bounce 1s ease-in-out infinite;
  }
  .inl-thinking .inl-dots i:nth-child(2) { animation-delay: 0.18s; }
  .inl-thinking .inl-dots i:nth-child(3) { animation-delay: 0.36s; }
  @keyframes inl-bounce {
    0%,80%,100% { transform: translateY(0); opacity: 0.5; }
    40% { transform: translateY(-4px); opacity: 1; }
  }
  .inl-thinking .inl-skel {
    margin-top: 8px;
    display: flex; flex-direction: column; gap: 6px;
  }
  .inl-thinking .inl-skel i {
    height: 14px; border-radius: 3px;
    background: linear-gradient(90deg, #f0f0f0 25%, #fafafa 50%, #f0f0f0 75%);
    background-size: 200% 100%;
    animation: inl-shimmer 1.4s linear infinite;
  }
  @keyframes inl-shimmer {
    0% { background-position: 100% 0; }
    100% { background-position: -100% 0; }
  }
  .inl-thinking .inl-streamed {
    margin-top: 6px;
    font-size: 14.5px;
    line-height: 22px;
    color: #1f1f1f;
  }
  .inl-thinking .inl-streamed::after {
    content: "▍";
    color: var(--inlinr-accent, #0078d4);
    animation: inl-blink 1s steps(2,end) infinite;
    margin-left: 1px;
  }
  @keyframes inl-blink { 50% { opacity: 0; } }

  /* Gutter prompt chip (idle hint) */
  .inl-hint-chip {
    display: inline-flex; align-items: center; gap: 5px;
    padding: 1px 7px 2px;
    border-radius: 10px;
    background: rgba(0, 120, 212, 0.08);
    color: var(--inlinr-accent, #0078d4);
    font-size: 11px;
    font-weight: 500;
    line-height: 16px;
  }
`;

/* ──────────────────────────────────────────────────────────────────────
   Popover — anchored above a selection (matches the screenshot pattern)
   ─────────────────────────────────────────────────────────────────── */
const InlPopover = ({ tone, draft = "", onChange, onSubmit }) => (
  <div className="inl-pop" data-tone={tone}>
    <span className="inl-kbd">⌘K</span>
    <input
      className="inl-prompt-input"
      placeholder="Ask for changes"
      value={draft}
      autoFocus
      onChange={(e) => onChange?.(e.target.value)}
      onKeyDown={(e) => { if (e.key === "Enter") onSubmit?.(); }}
    />
    <span className="inl-sep" />
    <button className="inl-btn"><b style={{ fontWeight: 700 }}>B</b></button>
    <button className="inl-btn"><i>I</i></button>
    <button className="inl-btn">
      Text <Icon name="chevDown" size={10} stroke={1.4} color="#6c6c6c" />
    </button>
    <span className="inl-sep" />
    <button className="inl-btn" data-primary onClick={onSubmit}>
      <Icon name="sparkle" size={11} stroke={1.8} color="white" /> Ask
    </button>
  </div>
);

/* ──────────────────────────────────────────────────────────────────────
   CodeLens — the lighter action strip above a block
   ─────────────────────────────────────────────────────────────────── */
const InlCodeLens = ({ onAsk }) => (
  <div className="inl-lens">
    <span className="inl-lens-sparkle"><Icon name="sparkle" size={11} stroke={1.8} /></span>
    <span style={{ marginLeft: 4 }} />
    <a className="inl-lens-act" onClick={onAsk}>Ask for changes</a>
    <span className="inl-lens-sep">|</span>
    <a className="inl-lens-act">Make clearer</a>
    <span className="inl-lens-sep">|</span>
    <a className="inl-lens-act">Tighten</a>
    <span className="inl-lens-sep">|</span>
    <a className="inl-lens-act">Comment…</a>
  </div>
);

/* ──────────────────────────────────────────────────────────────────────
   Prompt card — expanded prompt input + suggestion chips
   ─────────────────────────────────────────────────────────────────── */
const InlPromptCard = ({ tone, draft, onChange, onSubmit, onCancel }) => (
  <div className="inl-prompt-card" data-tone={tone}>
    <div className="inl-pc-head">
      <span className="inl-sparkle"><Icon name="sparkle" size={11} stroke={1.8} /></span>
      Inlinr · ask for changes
      <span style={{ flex: 1 }} />
      <span style={{ fontSize: 10.5, color: "#8a8a8a", letterSpacing: 0.04 }}>⏎ to send · esc to cancel</span>
    </div>
    <div className="inl-pc-body">
      <textarea
        className="inl-pc-input"
        autoFocus
        rows={1}
        placeholder="What should change?"
        value={draft}
        onChange={(e) => onChange?.(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); onSubmit?.(); }
          if (e.key === "Escape") onCancel?.();
        }}
      />
    </div>
    <div className="inl-pc-actions">
      <span className="inl-chip">Make clearer</span>
      <span className="inl-chip">Tighten</span>
      <span className="inl-chip">Add example</span>
      <span className="inl-spacer" />
      <button className="inl-cta-ghost" onClick={onCancel}>Cancel</button>
      <button className="inl-cta" onClick={onSubmit}>
        <Icon name="sparkle" size={11} stroke={1.8} color="white" /> Ask
      </button>
    </div>
  </div>
);

/* ──────────────────────────────────────────────────────────────────────
   Thinking — streaming placeholder
   ─────────────────────────────────────────────────────────────────── */
const InlThinking = ({ tone, prompt, streamed = "" }) => (
  <div className="inl-diff" data-tone={tone}>
    <div className="inl-diff-head">
      <span className="inl-sparkle"><Icon name="sparkle" size={12} stroke={1.8} /></span>
      <span className="inl-diff-prompt">{prompt}</span>
      <span className="inl-diff-meta">
        <span className="inl-dots" style={{ display: "inline-flex", gap: 3, verticalAlign: "middle" }}>
          <i style={{ width: 5, height: 5, borderRadius: "50%", background: "var(--inlinr-accent,#0078d4)", display: "inline-block", animation: "inl-bounce 1s ease-in-out infinite" }} />
          <i style={{ width: 5, height: 5, borderRadius: "50%", background: "var(--inlinr-accent,#0078d4)", display: "inline-block", animation: "inl-bounce 1s ease-in-out 0.18s infinite" }} />
          <i style={{ width: 5, height: 5, borderRadius: "50%", background: "var(--inlinr-accent,#0078d4)", display: "inline-block", animation: "inl-bounce 1s ease-in-out 0.36s infinite" }} />
        </span>
      </span>
    </div>
    <div className="inl-thinking">
      {streamed ? (
        <div className="inl-streamed">{streamed}</div>
      ) : (
        <>
          <div className="inl-think-row">
            <Icon name="sparkle" size={11} stroke={1.8} color="var(--inlinr-accent,#0078d4)" />
            Generating suggestion…
          </div>
          <div className="inl-skel">
            <i style={{ width: "92%" }} />
            <i style={{ width: "78%" }} />
            <i style={{ width: "60%" }} />
          </div>
        </>
      )}
    </div>
  </div>
);

/* ──────────────────────────────────────────────────────────────────────
   Diff renderers — four flavors
   ─────────────────────────────────────────────────────────────────── */

// Inline word-level red/green (default)
const DiffInline = ({ diff }) => (
  <div className="inl-diff-body" style={{ fontSize: 15, lineHeight: "24px" }}>
    {diff.map((seg, i) =>
      seg.t === "eq"  ? <span key={i} className="diff-eq">{seg.text}</span>
    : seg.t === "del" ? <span key={i} className="diff-del">{seg.text}</span>
    :                   <span key={i} className="diff-ins">{seg.text}</span>
    )}
  </div>
);

// Strikethrough ghost — original muted/struck, new in accent color
const DiffGhost = ({ diff }) => (
  <div className="inl-diff-body" style={{ fontSize: 15, lineHeight: "24px" }}>
    {diff.map((seg, i) =>
      seg.t === "eq"  ? <span key={i} className="diff-eq">{seg.text}</span>
    : seg.t === "del" ? <span key={i} className="diff-ghost-del">{seg.text}</span>
    :                   <span key={i} className="diff-ghost-ins">{seg.text}</span>
    )}
  </div>
);

// Two-row block: "─ original" + "＋ new"
const DiffBlock = ({ diff }) => {
  const oldText = diff.filter(s => s.t !== "ins").map(s => s.text).join("");
  const newText = diff.filter(s => s.t !== "del").map(s => s.text).join("");
  return (
    <div className="inl-block-card">
      <div className="inl-bc-original">{oldText}</div>
      <div className="inl-bc-arrow">↓ Replace with</div>
      <div className="inl-bc-new">{newText}</div>
    </div>
  );
};

// Side-by-side columns
const DiffSideBySide = ({ diff }) => {
  return (
    <div className="inl-sxs">
      <div>
        <div className="inl-diff-label">Original</div>
        {diff.map((seg, i) =>
          seg.t === "ins" ? null
        : seg.t === "del" ? <span key={i} className="diff-del">{seg.text}</span>
        :                   <span key={i}>{seg.text}</span>
        )}
      </div>
      <div>
        <div className="inl-diff-label">Suggested</div>
        {diff.map((seg, i) =>
          seg.t === "del" ? null
        : seg.t === "ins" ? <span key={i} className="diff-ins">{seg.text}</span>
        :                   <span key={i}>{seg.text}</span>
        )}
      </div>
    </div>
  );
};

const DIFF_RENDERERS = {
  inline: DiffInline,
  ghost: DiffGhost,
  block: DiffBlock,
  sxs: DiffSideBySide,
};

/* ──────────────────────────────────────────────────────────────────────
   Review card — wraps a diff renderer with header + accept/reject
   ─────────────────────────────────────────────────────────────────── */
const InlDiffReview = ({ tone, diffStyle, prompt, diff, onAccept, onReject, onRefine }) => {
  const Renderer = DIFF_RENDERERS[diffStyle] || DiffInline;
  return (
    <div className="inl-diff" data-tone={tone}>
      <div className="inl-diff-head">
        <span className="inl-sparkle"><Icon name="sparkle" size={12} stroke={1.8} /></span>
        <span className="inl-diff-prompt">{prompt}</span>
        <span className="inl-diff-meta">claude-haiku · 1.2s</span>
      </div>
      <Renderer diff={diff} />
      <div className="inl-diff-foot">
        <button className="inl-btn-refine" onClick={onRefine}>
          <Icon name="refresh" size={11} stroke={1.6} /> Refine
        </button>
        <span className="inl-spacer" />
        <button className="inl-btn-reject" onClick={onReject}>
          Reject <span className="inl-kbd-small">⌘⌫</span>
        </button>
        <button className="inl-btn-accept" onClick={onAccept}>
          <Icon name="check" size={11} stroke={2} color="white" />
          Accept <span className="inl-kbd-small" style={{ background: "rgba(255,255,255,0.2)", color: "rgba(255,255,255,0.9)", borderColor: "rgba(255,255,255,0.3)" }}>⌘⏎</span>
        </button>
      </div>
    </div>
  );
};

Object.assign(window, {
  INLINR_STYLE,
  InlPopover, InlCodeLens, InlPromptCard, InlThinking, InlDiffReview,
  DiffInline, DiffGhost, DiffBlock, DiffSideBySide,
});
