// VS Code chrome — title bar, activity bar, sidebar, tabs, status bar.
// Mostly static visuals; the interactive parts live in editor.jsx / app.jsx.

const Icon = ({ name, size = 16, stroke = 1.5, color = "currentColor" }) => {
  const paths = {
    files: <><path d="M3.5 3.5h5l2 2h6v9.5a1 1 0 0 1-1 1H3.5z" /><path d="M3.5 3.5v11" /></>,
    search: <><circle cx="7.5" cy="7.5" r="4.5" /><path d="m11 11 4 4" /></>,
    git: <><circle cx="5" cy="4" r="1.5" /><circle cx="5" cy="14" r="1.5" /><circle cx="13" cy="9" r="1.5" /><path d="M5 5.5v7M6.5 14h2a3 3 0 0 0 3-3V10.5" /></>,
    debug: <><path d="M5 4.5v9l8-4.5z" fill="currentColor" stroke="none" /></>,
    extensions: <><path d="M3 3h5v5H3zM10 3h5v5h-5zM3 10h5v5H3zM12.5 10.5v4M10.5 12.5h4" /></>,
    inlinr: <><path d="M3 4.5h12M3 9h9M3 13.5h12" /><circle cx="14.5" cy="9" r="1.6" fill="currentColor" stroke="none" /></>,
    account: <><circle cx="9" cy="6.5" r="3" /><path d="M3.5 15c1-3 3-4.5 5.5-4.5S13.5 12 14.5 15" /></>,
    settings: <><circle cx="9" cy="9" r="2.5" /><path d="M9 1.5v2M9 14.5v2M16.5 9h-2M3.5 9h-2M14.3 3.7l-1.4 1.4M5.1 12.9l-1.4 1.4M14.3 14.3l-1.4-1.4M5.1 5.1 3.7 3.7" /></>,
    md: <><rect x="2" y="3" width="14" height="12" rx="1" /><path d="M5 12V7l1.7 2.4L8.4 7v5" /><path d="M11.4 7v5M11.4 12l-1.4-1.6M11.4 12l1.4-1.6" /></>,
    folder: <><path d="M2 4.5h4.5l1.5 1.5h6v7a1 1 0 0 1-1 1H2z" fill="#dcb670" stroke="#bb924c" /></>,
    folderOpen: <><path d="M2 4.5h4.5l1.5 1.5h6v1H2zM2 7h12.5l-1.2 6a1 1 0 0 1-1 .8H3a1 1 0 0 1-1-.8z" fill="#dcb670" stroke="#bb924c" /></>,
    mdFile: <><path d="M3 2h7l4 4v9.5a.5.5 0 0 1-.5.5h-10a.5.5 0 0 1-.5-.5z" fill="#4080d0" stroke="none" /><path d="M5 13V8l1.5 2L8 8v5M11 8v5M11 13l-1.2-1.5M11 13l1.2-1.5" stroke="white" fill="none" strokeWidth="1.2" /></>,
    chevDown: <path d="M4 6.5 8 10.5 12 6.5" />,
    chevRight: <path d="M6.5 4 10.5 8 6.5 12" />,
    sparkle: <><path d="M9 2.5v3M9 12.5v3M2.5 9h3M12.5 9h3M14 4l-2 2M6 12l-2 2M14 14l-2-2M6 6 4 4" /></>,
    check: <path d="M3.5 9 7 12.5 14 5" />,
    x: <path d="m4 4 10 10M14 4 4 14" />,
    refresh: <path d="M14.5 5.5A6 6 0 1 0 15 11M14.5 3v3h-3" />,
    undo: <path d="M5.5 5.5 2.5 8.5 5.5 11.5M2.5 8.5h7a4 4 0 0 1 4 4v.5" />,
    split: <path d="M2.5 3.5h11v11h-11zM8 3.5v11" />,
    more: <><circle cx="4" cy="9" r="1" fill="currentColor" stroke="none" /><circle cx="9" cy="9" r="1" fill="currentColor" stroke="none" /><circle cx="14" cy="9" r="1" fill="currentColor" stroke="none" /></>,
    plus: <><path d="M9 3v12M3 9h12" /></>,
    panel: <><rect x="2.5" y="3.5" width="13" height="11" rx="1" /><path d="M11 3.5v11" /></>,
    bell: <><path d="M9 2.5v1M5 7a4 4 0 0 1 8 0v4l1 1.5H4L5 11z" /><path d="M7 14a2 2 0 0 0 4 0" /></>,
    error: <><circle cx="9" cy="9" r="6.5" /><path d="m6.5 6.5 5 5M11.5 6.5l-5 5" /></>,
    warn: <><path d="M1.5 14.5 9 2.5l7.5 12z" /><path d="M9 7v4M9 12.5v.5" /></>,
  };
  const fill = ["folder", "folderOpen", "mdFile"].includes(name) ? undefined : "none";
  return (
    <svg width={size} height={size} viewBox="0 0 18 18" fill={fill}
         stroke={color} strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round">
      {paths[name]}
    </svg>
  );
};

const TitleBar = ({ filename = "product-outline.md" }) => (
  <div className="titlebar">
    <div className="title-traffic">
      <div className="dot close" />
      <div className="dot min" />
      <div className="dot max" />
    </div>
    <div className="title-search">
      <span className="icon">⌕</span>
      <span className="crumb">inlinr</span>
      <span className="sep">›</span>
      <span className="crumb">product</span>
      <span className="sep">›</span>
      <span className="crumb">{filename}</span>
    </div>
    <div className="title-actions">
      <div className="ti-btn"><Icon name="panel" size={14} stroke={1.3} /></div>
      <div className="ti-btn"><Icon name="split" size={14} stroke={1.3} /></div>
      <div className="ti-btn"><Icon name="more" size={14} stroke={1.3} /></div>
    </div>
  </div>
);

const ActivityBar = ({ pendingCount = 4 }) => (
  <div className="activity-bar">
    <div className="ab-item"><Icon name="files" size={24} stroke={1.3} /></div>
    <div className="ab-item"><Icon name="search" size={24} stroke={1.3} /></div>
    <div className="ab-item"><Icon name="git" size={24} stroke={1.3} /></div>
    <div className="ab-item"><Icon name="debug" size={24} stroke={1.3} /></div>
    <div className="ab-item"><Icon name="extensions" size={24} stroke={1.3} /></div>
    <div className="ab-item active" title="Inlinr">
      <Icon name="inlinr" size={24} stroke={1.5} />
      {pendingCount > 0 && <span className="ab-badge">{pendingCount}</span>}
    </div>
    <div className="ab-spacer" />
    <div className="ab-item"><Icon name="account" size={22} stroke={1.3} /></div>
    <div className="ab-item"><Icon name="settings" size={22} stroke={1.3} /></div>
  </div>
);

const FileTree = () => {
  const rows = [
    { depth: 0, icon: "folderOpen", name: "INLINR", caret: "down", bold: true },
    { depth: 1, icon: "folder", name: ".github", caret: "right" },
    { depth: 1, icon: "folder", name: "architecture", caret: "right" },
    { depth: 1, icon: "folderOpen", name: "product", caret: "down" },
    { depth: 2, icon: "mdFile", name: "development-workflow.md" },
    { depth: 2, icon: "mdFile", name: "glossary.md" },
    { depth: 2, icon: "mdFile", name: "non-goals.md" },
    { depth: 2, icon: "mdFile", name: "product-outline.md", selected: true, badge: 4 },
    { depth: 2, icon: "mdFile", name: "user-scenarios.md", mod: true },
    { depth: 2, icon: "mdFile", name: "ux-principles.md" },
    { depth: 1, icon: "folder", name: "specs", caret: "right" },
    { depth: 1, icon: "mdFile", name: "README.md" },
  ];
  return (
    <div className="file-tree">
      {rows.map((r, i) => (
        <div key={i} className={"ft-row" + (r.selected ? " selected" : "")}
             data-depth={r.depth} style={{ paddingLeft: 8 + r.depth * 16 }}>
          <div className="ft-chev">
            {r.caret === "down" ? <Icon name="chevDown" size={10} stroke={1.4} />
             : r.caret === "right" ? <Icon name="chevRight" size={10} stroke={1.4} />
             : null}
          </div>
          <div className="ft-icon"><Icon name={r.icon} size={16} stroke={1.2} /></div>
          <div className="ft-name" style={{ fontWeight: r.bold ? 600 : 400 }}>{r.name}</div>
          {r.mod && <div className="ft-mod" title="Modified" />}
          {r.badge && <div className="ft-badge" title={`${r.badge} Inlinr suggestions`}>{r.badge}</div>}
        </div>
      ))}
    </div>
  );
};

const InlinrSidePanel = ({ queue, activeId, onPick }) => {
  const stateLabel = {
    reviewing: "Awaiting review",
    thinking: "Generating…",
    prompting: "Editing prompt",
    accepted: "Applied",
    idle: "—",
  };
  return (
    <div className="inlinr-panel">
      <div className="sb-toolbar">
        <b>Inlinr — Pending</b>
        <div className="sb-actions">
          <Icon name="refresh" size={14} stroke={1.3} color="#6c6c6c" />
          <Icon name="more" size={14} stroke={1.3} color="#6c6c6c" />
        </div>
      </div>
      <div className="ip-list">
        {queue.map((q) => (
          <div key={q.blockId}
               className={"ip-item" + (q.blockId === activeId ? " active" : "")}
               onClick={() => onPick?.(q.blockId)}>
            <div className="ip-dot" data-state={q.state} />
            <div className="ip-text">
              <div className="ip-prompt">{q.label}</div>
              <div className="ip-meta">Line {q.line} · {stateLabel[q.state]}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

const Sidebar = ({ queue, activeId, onPick }) => (
  <div className="sidebar">
    <div className="sb-toolbar"><b>Explorer</b>
      <div className="sb-actions">
        <Icon name="plus" size={14} stroke={1.3} color="#6c6c6c" />
        <Icon name="more" size={14} stroke={1.3} color="#6c6c6c" />
      </div>
    </div>
    <FileTree />
    <InlinrSidePanel queue={queue} activeId={activeId} onPick={onPick} />
  </div>
);

const TabBar = () => (
  <div className="tab-bar">
    <div className="tab">
      <div className="tab-icon"><Icon name="mdFile" size={16} /></div>
      <div className="tab-name">user-scenarios.md</div>
      <div className="tab-dot" title="Unsaved" />
    </div>
    <div className="tab active">
      <div className="tab-icon"><Icon name="mdFile" size={16} /></div>
      <div className="tab-name">product-outline.md</div>
      <div className="tab-close"><Icon name="x" size={10} stroke={1.6} /></div>
    </div>
    <div className="tab">
      <div className="tab-icon"><Icon name="mdFile" size={16} /></div>
      <div className="tab-name">README.md</div>
      <div className="tab-close"><Icon name="x" size={10} stroke={1.6} /></div>
    </div>
    <div className="tab tab-spacer" />
  </div>
);

const Breadcrumbs = ({ pendingCount }) => (
  <div className="breadcrumbs">
    <div className="crumb"><Icon name="folder" size={14} /> inlinr</div>
    <div className="sep">›</div>
    <div className="crumb"><Icon name="folder" size={14} /> product</div>
    <div className="sep">›</div>
    <div className="crumb"><Icon name="mdFile" size={14} /> product-outline.md</div>
    <div className="sep">›</div>
    <div className="crumb"># Product Outline</div>
    <div className="inlinr-context">
      <Icon name="sparkle" size={11} stroke={1.6} /> Inlinr · {pendingCount} pending
    </div>
  </div>
);

const StatusBar = ({ branded }) => (
  <div className={"status-bar" + (branded ? " branded" : "")}>
    <div className="sb-cell"><span className="icon">⎇</span> main*</div>
    <div className="sb-cell"><span className="icon">⤓</span> 0  <span className="icon" style={{marginLeft:6}}>⤒</span> 2</div>
    <div className="sb-cell"><Icon name="warn" size={12} stroke={1.4} /> 0  <Icon name="error" size={12} stroke={1.4} /> 0</div>
    <div className="sb-spacer" />
    <div className="sb-cell">Ln 11, Col 38</div>
    <div className="sb-cell">Spaces: 2</div>
    <div className="sb-cell">UTF-8</div>
    <div className="sb-cell">LF</div>
    <div className="sb-cell">Markdown</div>
    <div className="sb-cell brand">
      <Icon name="sparkle" size={12} stroke={1.6} /> Inlinr
    </div>
    <div className="sb-cell"><Icon name="bell" size={12} stroke={1.4} /></div>
  </div>
);

Object.assign(window, {
  Icon, TitleBar, ActivityBar, Sidebar, FileTree, InlinrSidePanel,
  TabBar, Breadcrumbs, StatusBar,
});
