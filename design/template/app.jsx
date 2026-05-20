// Main app. Owns doc state, selection, tweaks. Coordinates the editor
// and Inlinr surfaces.

const { useState, useEffect, useRef, useMemo, useCallback } = React;

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "surface": "popover",
  "diffStyle": "inline",
  "tone": "branded",
  "accent": "#0078d4",
  "showSidePanel": true,
  "showStatusBar": true
}/*EDITMODE-END*/;

// Surfaces and diff styles available in the prototype.
const SURFACES   = [
  { value: "popover",  label: "Popover" },
  { value: "codelens", label: "CodeLens" },
];
const DIFF_STYLES = [
  { value: "inline", label: "Inline" },
  { value: "ghost",  label: "Ghost" },
  { value: "block",  label: "Block" },
  { value: "sxs",    label: "Side" },
];
const TONES = [
  { value: "native",  label: "Native" },
  { value: "branded", label: "Branded" },
];
const ACCENTS = [
  "#0078d4",  // VS Code blue
  "#6f42c1",  // Purple
  "#0a8754",  // Emerald
  "#d97706",  // Amber
];

// ── Color helpers — derive deep/border/ring/tint from a single accent hex ────
function hexToRgb(hex) {
  const h = hex.replace("#", "");
  const n = h.length === 3 ? h.replace(/./g, c => c + c) : h;
  return { r: parseInt(n.slice(0, 2), 16), g: parseInt(n.slice(2, 4), 16), b: parseInt(n.slice(4, 6), 16) };
}
function rgbToHex({ r, g, b }) {
  const h = (v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0");
  return "#" + h(r) + h(g) + h(b);
}
function mix(hex, withHex, t) {
  const a = hexToRgb(hex), b = hexToRgb(withHex);
  return rgbToHex({ r: a.r + (b.r - a.r) * t, g: a.g + (b.g - a.g) * t, b: a.b + (b.b - a.b) * t });
}
function rgba(hex, a) {
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${r},${g},${b},${a})`;
}

function applyAccent(hex) {
  const r = document.documentElement.style;
  r.setProperty("--inlinr-accent", hex);
  r.setProperty("--inlinr-accent-deep",   mix(hex, "#000000", 0.15));
  r.setProperty("--inlinr-accent-border", mix(hex, "#ffffff", 0.65));
  r.setProperty("--inlinr-accent-ring",   rgba(hex, 0.18));
  r.setProperty("--inlinr-tint",          mix(hex, "#ffffff", 0.92));
}

// ── App ─────────────────────────────────────────────────────────────────────
function App() {
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);
  const [doc, setDoc] = useState(() => JSON.parse(JSON.stringify(window.INLINR_DOC)));
  const [selectedId, setSelectedId] = useState(null);
  const [draftMap, setDraftMap] = useState({ "li-3": "split this into two bullets" });
  const [streamMap, setStreamMap] = useState({});

  // Apply accent CSS vars whenever it changes.
  useEffect(() => { applyAccent(t.accent); }, [t.accent]);

  // Simulate streaming for the initial "thinking" block.
  useEffect(() => {
    const target = doc.find(b => b.state === "thinking" && b.id === "p-vision");
    if (!target) return;
    // Stream in slowly and STOP mid-stream so the demo persistently shows
    // an active "thinking" state rather than collapsing into a finished diff.
    const finalText = "Markdown editing in VS Code that feels like asking the document itself for changes — fast, precise, reviewable, and never a";
    let i = 0;
    const streamTimerRef = { current: null };
    const step = () => {
      i = Math.min(finalText.length, i + 2);
      setStreamMap(prev => ({ ...prev, "p-vision": finalText.slice(0, i) }));
      if (i < finalText.length) {
        streamTimerRef.current = setTimeout(step, 38 + Math.random() * 28);
      }
    };
    streamTimerRef.current = setTimeout(step, 700);
    return () => clearTimeout(streamTimerRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Compute Inlinr queue for sidebar.
  const queue = useMemo(() => {
    return doc.filter(b => b.state && b.state !== "idle").map(b => ({
      blockId: b.id,
      label: b.prompt || b.promptDraft || "(no prompt)",
      state: b.state,
      line: b.line || 0,
    }));
  }, [doc]);

  const pendingCount = queue.length;

  // Update one block by id.
  const updateBlock = useCallback((id, patch) => {
    setDoc(prev => prev.map(b => b.id === id ? { ...b, ...patch } : b));
  }, []);

  // Handlers
  const onSelect = (id) => setSelectedId(id);

  const onAsk = (id) => {
    // CodeLens "Ask for changes" — same as selecting; user types in popover/codelens
    setSelectedId(id);
  };

  const onChangeDraft = (id, v) => setDraftMap(prev => ({ ...prev, [id]: v }));

  const onSubmitPrompt = (id) => {
    const prompt = (draftMap[id] || "").trim();
    if (!prompt) return;
    // Move to thinking
    updateBlock(id, { state: "thinking", prompt });
    setStreamMap(prev => ({ ...prev, [id]: "" }));
    // Simulate stream then resolve to reviewing
    simulateThinking(id, prompt);
  };

  function simulateThinking(id, prompt) {
    const block = doc.find(b => b.id === id);
    if (!block) return;
    // Build a synthetic diff if we don't already have one
    const synth = block.diff || synthesizeDiff(block.text || "", prompt);
    const newText = synth.filter(s => s.t !== "del").map(s => s.text).join("");
    let i = 0;
    const total = newText.length;
    const tick = () => {
      i = Math.min(total, i + 3);
      setStreamMap(prev => ({ ...prev, [id]: newText.slice(0, i) }));
      if (i < total) setTimeout(tick, 22 + Math.random() * 20);
      else {
        setTimeout(() => {
          updateBlock(id, { state: "reviewing", diff: synth });
          setStreamMap(prev => { const n = { ...prev }; delete n[id]; return n; });
        }, 300);
      }
    };
    setTimeout(tick, 400);
  }

  const onAccept = (id) => {
    const block = doc.find(b => b.id === id);
    if (!block) return;
    const newText = block.diff
      ? block.diff.filter(s => s.t !== "del").map(s => s.text).join("")
      : block.text;
    updateBlock(id, { state: "idle", text: newText, diff: undefined, prompt: undefined });
  };

  const onReject = (id) => {
    const block = doc.find(b => b.id === id);
    if (!block) return;
    const oldText = block.diff
      ? block.diff.filter(s => s.t !== "ins").map(s => s.text).join("")
      : block.text;
    updateBlock(id, { state: "idle", text: oldText, diff: undefined, prompt: undefined });
  };

  const onRefine = (id) => {
    const block = doc.find(b => b.id === id);
    if (!block) return;
    const oldText = block.diff
      ? block.diff.filter(s => s.t !== "ins").map(s => s.text).join("")
      : block.text;
    setDraftMap(prev => ({ ...prev, [id]: block.prompt || "" }));
    updateBlock(id, { state: "prompting", text: oldText, diff: undefined });
  };

  const onCancel = (id) => {
    updateBlock(id, { state: "idle", prompt: undefined });
    setDraftMap(prev => { const n = { ...prev }; delete n[id]; return n; });
  };

  const resetDemo = () => {
    setDoc(JSON.parse(JSON.stringify(window.INLINR_DOC)));
    setDraftMap({ "li-3": "split this into two bullets" });
    setStreamMap({});
    setSelectedId(null);
  };

  // Background click clears selection.
  const onBackdrop = (e) => {
    if (e.target === e.currentTarget) setSelectedId(null);
  };

  return (
    <>
      <style>{INLINR_STYLE}</style>
      <div id="viewport-bg" />
      <ScaledStage>
        <div id="vscode-shell" data-tone={t.tone}>
          <TitleBar />
          <div className="body-row">
            <ActivityBar pendingCount={pendingCount} />
            <Sidebar queue={queue} activeId={selectedId} onPick={onSelect} />
            <div className="main-col">
              <TabBar />
              <Breadcrumbs pendingCount={pendingCount} />
              <div className="editor-row">
                <div onClick={onBackdrop} style={{ minHeight: 0, minWidth: 0, height: "100%", overflow: "hidden", display: "flex", flexDirection: "column" }}>
                  <Editor
                    doc={doc}
                    selectedId={selectedId}
                    surface={t.surface}
                    diffStyle={t.diffStyle}
                    tone={t.tone}
                    draftMap={draftMap}
                    streamMap={streamMap}
                    onSelect={onSelect}
                    onAsk={onAsk}
                    onSubmitPrompt={onSubmitPrompt}
                    onChangeDraft={onChangeDraft}
                    onAccept={onAccept}
                    onReject={onReject}
                    onRefine={onRefine}
                    onCancel={onCancel}
                  />
                </div>
                <Minimap />
              </div>
              <StatusBar branded={t.tone === "branded"} />
            </div>
          </div>
        </div>
      </ScaledStage>

      <TweaksPanel title="Inlinr — Tweaks">
        <TweakSection label="Inlinr surface">
          <TweakRadio label="Trigger surface" value={t.surface}
                      options={SURFACES}
                      onChange={(v) => setTweak("surface", v)} />
          <TweakRadio label="Visual direction" value={t.tone}
                      options={TONES}
                      onChange={(v) => setTweak("tone", v)} />
          <TweakColor label="Accent" value={t.accent}
                      options={ACCENTS}
                      onChange={(v) => setTweak("accent", v)} />
        </TweakSection>

        <TweakSection label="Diff style">
          <TweakRadio label="Diff treatment" value={t.diffStyle}
                      options={DIFF_STYLES}
                      onChange={(v) => setTweak("diffStyle", v)} />
        </TweakSection>

        <TweakSection label="Demo">
          <TweakButton label="Reset demo" onClick={resetDemo} secondary />
          <div style={{ fontSize: 10.5, color: "rgba(41,38,27,0.55)", lineHeight: 1.5, marginTop: 4 }}>
            Click any paragraph to start a new edit · ⌘K opens the prompt
          </div>
        </TweakSection>
      </TweaksPanel>
    </>
  );
}

// ── Minimap (right of editor, decorative) ───────────────────────────────────
function Minimap() {
  return (
    <div className="minimap" style={{ position: "relative" }}>
      <svg width="14" height="100%" viewBox="0 0 14 800" preserveAspectRatio="none">
        {/* fake mini-lines */}
        {[...Array(80)].map((_, i) => {
          const w = 6 + Math.random() * 7;
          const color = i % 9 === 0 ? "#bbb" : "#dcdcdc";
          return <rect key={i} x={2} y={10 + i * 9} width={w} height={2} fill={color} />;
        })}
        {/* highlights for blocks with suggestions */}
        <rect x={1} y={92} width={12} height={9} fill="rgba(240,160,32,0.22)" />
        <rect x={1} y={170} width={12} height={9} fill="rgba(91,141,239,0.22)" />
        <rect x={1} y={230} width={12} height={9} fill="rgba(0,120,212,0.18)" />
        <rect x={1} y={310} width={12} height={9} fill="rgba(240,160,32,0.22)" />
        {/* viewport */}
        <rect x={0} y={0} width={14} height={250} fill="rgba(0,0,0,0.05)" />
      </svg>
    </div>
  );
}

// ── ScaledStage — keeps the 1440×900 shell fitting any viewport ─────────────
function ScaledStage({ children }) {
  const wrapRef = useRef(null);
  useEffect(() => {
    const fit = () => {
      const w = window.innerWidth, h = window.innerHeight;
      const s = Math.min(w / 1440, h / 900, 1);
      if (wrapRef.current) {
        wrapRef.current.style.transform = `scale(${s})`;
        wrapRef.current.style.left = `${(w - 1440 * s) / 2}px`;
        wrapRef.current.style.top  = `${(h - 900 * s) / 2}px`;
      }
    };
    fit();
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, []);
  return (
    <div ref={wrapRef} style={{
      position: "fixed", left: 0, top: 0,
      transformOrigin: "top left",
    }}>{children}</div>
  );
}

// ── Synth diff fallback for user-initiated prompts on idle blocks ───────────
function synthesizeDiff(text, prompt) {
  // Light heuristic — keep the first ~third, replace the rest with a fake
  // rewrite that nods to the prompt. Only used when there's no precomputed
  // diff for the block.
  const cut = Math.max(20, Math.floor(text.length / 3));
  const breakAt = text.indexOf(". ", cut) === -1 ? cut : text.indexOf(". ", cut) + 2;
  const kept = text.slice(0, breakAt);
  const rest = text.slice(breakAt);
  return [
    { t: "eq",  text: kept },
    { t: "del", text: rest },
    { t: "ins", text: phrasePrompt(prompt) + " — and the rest of the paragraph is tightened around that idea." },
  ];
}
function phrasePrompt(p) {
  const s = p.trim().replace(/[.?!]+$/, "");
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// ── Mount ───────────────────────────────────────────────────────────────────
ReactDOM.createRoot(document.getElementById("root")).render(<App />);
