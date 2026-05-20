// Editor — renders Markdown blocks with line numbers, gutter indicators,
// and per-block Inlinr surfaces (popover, codelens, prompt card, thinking, diff).
//
// Layout: a single CSS grid with three columns (line-num | indicator | content),
// one row per markdown source line. Each row's cells align naturally so the
// gutters stay attached to the top of wrapping paragraphs (matching VS Code).

const BLOCK_TAG = { h1: "h1", h2: "h2", h3: "h3", p: "p", li: "div" };
const BLOCK_CLS = { h1: "md-h1", h2: "md-h2", h3: "md-h3", p: "md-p", li: "md-li" };

// Render the content of a block. For "reviewing" inline/ghost styles we render
// the diff in place of the text. For "thinking", we mute the original.
const BlockContent = ({ block, diffStyle }) => {
  if (block.state === "reviewing") {
    if (diffStyle === "inline") {
      return block.diff.map((seg, i) =>
        seg.t === "eq"  ? <span key={i}>{seg.text}</span>
      : seg.t === "del" ? <span key={i} className="diff-del">{seg.text}</span>
      :                   <span key={i} className="diff-ins">{seg.text}</span>
      );
    }
    if (diffStyle === "ghost") {
      return block.diff.map((seg, i) =>
        seg.t === "eq"  ? <span key={i}>{seg.text}</span>
      : seg.t === "del" ? <span key={i} className="diff-ghost-del">{seg.text}</span>
      :                   <span key={i} className="diff-ghost-ins">{seg.text}</span>
      );
    }
    const oldText = block.diff.filter(s => s.t !== "ins").map(s => s.text).join("");
    return <span style={{ color: "rgba(0,0,0,0.45)" }}>{oldText}</span>;
  }
  if (block.state === "thinking") {
    return <span style={{ color: "rgba(0,0,0,0.45)" }}>{block.text}</span>;
  }
  return block.text;
};

// Below-block surface (prompt card / thinking / diff review).
const BelowSurface = ({ block, tone, diffStyle, draftMap, streamMap,
                       onChangeDraft, onSubmitPrompt, onCancel, onAccept, onReject, onRefine }) => {
  if (block.state === "prompting") {
    return (
      <InlPromptCard
        tone={tone}
        draft={draftMap[block.id] ?? (block.promptDraft || "")}
        onChange={(v) => onChangeDraft(block.id, v)}
        onSubmit={() => onSubmitPrompt(block.id)}
        onCancel={() => onCancel(block.id)}
      />
    );
  }
  if (block.state === "thinking") {
    return <InlThinking tone={tone} prompt={block.prompt} streamed={streamMap[block.id] || ""} />;
  }
  if (block.state === "reviewing") {
    if (diffStyle === "inline" || diffStyle === "ghost") {
      // The diff is rendered in-text; show just header + accept/reject footer.
      return (
        <div className="inl-diff" data-tone={tone}>
          <div className="inl-diff-head">
            <span className="inl-sparkle"><Icon name="sparkle" size={12} stroke={1.8} /></span>
            <span className="inl-diff-prompt">{block.prompt}</span>
            <span className="inl-diff-meta">claude-haiku · 1.2s</span>
          </div>
          <div className="inl-diff-foot">
            <button className="inl-btn-refine" onClick={() => onRefine(block.id)}>
              <Icon name="refresh" size={11} stroke={1.6} /> Refine
            </button>
            <span className="inl-spacer" />
            <button className="inl-btn-reject" onClick={() => onReject(block.id)}>
              Reject <span className="inl-kbd-small">⌘⌫</span>
            </button>
            <button className="inl-btn-accept" onClick={() => onAccept(block.id)}>
              <Icon name="check" size={11} stroke={2} color="white" />
              Accept <span className="inl-kbd-small"
                           style={{ background: "rgba(255,255,255,0.2)", color: "rgba(255,255,255,0.9)", borderColor: "rgba(255,255,255,0.3)" }}>⌘⏎</span>
            </button>
          </div>
        </div>
      );
    }
    return (
      <InlDiffReview
        tone={tone} diffStyle={diffStyle}
        prompt={block.prompt} diff={block.diff}
        onAccept={() => onAccept(block.id)}
        onReject={() => onReject(block.id)}
        onRefine={() => onRefine(block.id)}
      />
    );
  }
  return null;
};

const ROW_GRID_STYLE = {
  display: "grid",
  gridTemplateColumns: "56px 26px 1fr",
  rowGap: 0,
  alignItems: "start",
  paddingTop: 12,
  paddingBottom: 220,
  maxWidth: 980,
};

// One row in the editor grid — three cells aligned by start.
const Row = ({ lineNum, kind, state, indicator, children, content }) => {
  return (
    <>
      <div style={{
        gridColumn: "1",
        textAlign: "right",
        paddingRight: 18,
        color: "#9aa0a6",
        fontFamily: "'SF Mono', Menlo, monospace",
        fontSize: 13,
        lineHeight: "22px",
        userSelect: "none",
        paddingTop: kind === "h1" ? 14 : kind === "h2" ? 14 : kind === "h3" ? 4 : 2,
        fontVariantNumeric: "tabular-nums",
      }}>{lineNum}</div>
      <div style={{
        gridColumn: "2",
        position: "relative",
        paddingTop: kind === "h1" ? 14 : kind === "h2" ? 14 : kind === "h3" ? 4 : 2,
        minHeight: 22,
      }}>
        {indicator}
      </div>
      <div style={{ gridColumn: "3", minWidth: 0, paddingRight: 24 }}>
        {children}
        {content}
      </div>
    </>
  );
};

// Indicator chip — sparkle icon for blocks that have an Inlinr state,
// faint sparkle on hover for idle blocks.
const Indicator = ({ state, isSelected, kind }) => {
  if (kind === "blank" || kind === "h1") return null;
  let color = "transparent", anim = "";
  let opacity = 0;
  if (state === "reviewing") { color = "#f0a020"; opacity = 1; }
  else if (state === "thinking") { color = "#5b8def"; opacity = 1; anim = "pulse 1.3s ease-in-out infinite"; }
  else if (state === "prompting") { color = "var(--inlinr-accent, #0078d4)"; opacity = 1; }
  else { color = "var(--inlinr-accent, #0078d4)"; opacity = isSelected ? 0.85 : 0; }

  return (
    <span className="row-indicator"
          style={{
            position: "absolute",
            left: -2, top: 4,
            color, opacity,
            animation: anim,
            display: "inline-flex", alignItems: "center", justifyContent: "center",
            width: 18, height: 18,
            transition: "opacity 0.12s",
          }}>
      <Icon name="sparkle" size={12} stroke={1.8} />
    </span>
  );
};

const Editor = ({
  doc, selectedId, surface, diffStyle, tone,
  draftMap, streamMap,
  onSelect, onAsk, onSubmitPrompt, onChangeDraft, onAccept, onReject, onRefine, onCancel,
}) => {
  // Walk doc, assigning sequential line numbers (skipping nothing — blanks count too).
  const rows = [];
  let line = 1;
  doc.forEach((b) => {
    rows.push({ block: b, lineNum: line });
    line += 1;
  });

  return (
    <div className="editor" id="editor-scroll">
      <div className="editor-canvas" style={ROW_GRID_STYLE}>
        {rows.map(({ block, lineNum }, idx) => {
          if (block.kind === "blank") {
            return (
              <Row key={`row-${idx}`} lineNum={lineNum} kind="blank"
                   indicator={null}>
                <div style={{ height: 22 }} />
              </Row>
            );
          }

          const isSelected = selectedId === block.id;
          const Tag = BLOCK_TAG[block.kind] || "p";
          const cls = BLOCK_CLS[block.kind] || "md-p";
          const showInline = isSelected && (block.state === "idle" || !block.state);

          const cls2 = [
            "md-block", cls,
            isSelected ? "selected" : "",
            block.state === "reviewing" ? "has-suggestion" : "",
            block.state === "thinking" ? "thinking" : "",
          ].filter(Boolean).join(" ");

          return (
            <Row key={`row-${idx}`} lineNum={lineNum} kind={block.kind} state={block.state}
                 indicator={<Indicator state={block.state} isSelected={isSelected} kind={block.kind} />}>
              <div style={{ position: "relative" }}>
                {/* CodeLens — appears above the block, in-flow */}
                {showInline && surface === "codelens" && (
                  <div style={{ padding: "0 8px 2px" }}>
                    <InlCodeLens onAsk={() => onAsk(block.id)} />
                  </div>
                )}

                {/* The block content */}
                <Tag id={`block-${block.id}`} className={cls2}
                     onClick={(e) => { e.stopPropagation(); onSelect(block.id); }}
                     style={{ position: "relative", margin: 0 }}>
                  {/* Popover — absolutely positioned above the block */}
                  {showInline && surface === "popover" && (
                    <div style={{
                      position: "absolute",
                      bottom: "calc(100% + 10px)",
                      left: 12,
                      zIndex: 50,
                    }}>
                      <InlPopover
                        tone={tone}
                        draft={draftMap[block.id] || ""}
                        onChange={(v) => onChangeDraft(block.id, v)}
                        onSubmit={() => onSubmitPrompt(block.id)}
                      />
                    </div>
                  )}
                  <BlockContent block={block} diffStyle={diffStyle} />
                </Tag>

                {/* Below-block surfaces (prompt / thinking / diff review) */}
                <BelowSurface
                  block={block} tone={tone} diffStyle={diffStyle}
                  draftMap={draftMap} streamMap={streamMap}
                  onChangeDraft={onChangeDraft} onSubmitPrompt={onSubmitPrompt}
                  onCancel={onCancel} onAccept={onAccept} onReject={onReject} onRefine={onRefine}
                />
              </div>
            </Row>
          );
        })}
      </div>
    </div>
  );
};

Object.assign(window, { Editor });
