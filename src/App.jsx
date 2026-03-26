import { useState, useRef, useCallback, useEffect } from "react";

// ─── Transform logic ──────────────────────────────────────────────────────────

function parseTSV(text) {
  if (!text.trim()) return [];
  const lines = text.trimEnd().split("\n");
  const hasTabs = lines.some(l => l.includes("\t"));
  return lines.map(line => {
    if (hasTabs) return line.split("\t").map(c => c.trim());
    return line.trim().split(/\s{2,}/).map(c => c.trim());
  }).filter(row => row.some(c => c !== ""));
}

function toTSV(grid) {
  return grid.map(row => row.join("\t")).join("\n");
}

function transpose(grid) {
  if (!grid.length) return [];
  const cols = Math.max(...grid.map(r => r.length));
  return Array.from({ length: cols }, (_, ci) =>
    Array.from({ length: grid.length }, (_, ri) => grid[ri][ci] ?? "")
  );
}

function normalize(grid) {
  const cols = Math.max(...grid.map(r => r.length));
  return grid.map(row => {
    const padded = [...row];
    while (padded.length < cols) padded.push("");
    return padded;
  });
}

const TRANSFORMS = {
  rotateCW:  g => transpose(normalize(g)).map(row => [...row].reverse()),
  rotateCCW: g => transpose(normalize(g).map(row => [...row].reverse())),
  flipH:     g => normalize(g).map(row => [...row].reverse()),
  flipV:     g => [...normalize(g)].reverse(),
  transpose: g => transpose(normalize(g)),
};

const OPS = [
  { id:"rotateCW",  label:"Rotate CW",        key:"↻", desc:"90° clockwise",        diagram:[[" A"," B"],["C","D"]], diagramResult:[["C"," A"],["D"," B"]] },
  { id:"rotateCCW", label:"Rotate CCW",       key:"↺", desc:"90° counter-clockwise", diagram:[["A","B"],["C","D"]], diagramResult:[["B","D"],["A","C"]] },
  { id:"flipH",     label:"Flip Horizontal",  key:"⇔", desc:"Mirror left ↔ right",  diagram:[["A","B","C"],["D","E","F"]], diagramResult:[["C","B","A"],["F","E","D"]] },
  { id:"flipV",     label:"Flip Vertical",    key:"⇕", desc:"Mirror top ↕ bottom",  diagram:[["A","B","C"],["D","E","F"]], diagramResult:[["D","E","F"],["A","B","C"]] },
  { id:"transpose", label:"Transpose",        key:"⤡", desc:"Swap rows & columns",  diagram:[["A","B","C"],["D","E","F"]], diagramResult:[["A","D"],["B","E"],["C","F"]] },
];

// Column letter label (A, B, … Z, AA, AB, …)
function colLabel(i) {
  let s = "";
  i++;
  while (i > 0) { s = String.fromCharCode(64 + (i % 26 || 26)) + s; i = Math.floor((i - 1) / 26); }
  return s;
}

// ─── Mini diagram ─────────────────────────────────────────────────────────────

const CELL_COLORS = { A:"#fde68a",B:"#bbf7d0",C:"#bfdbfe",D:"#fca5a5",E:"#ddd6fe",F:"#fed7aa" };

function MiniGrid({ grid }) {
  return (
    <div style={{ display:"inline-flex", flexDirection:"column", gap:2 }}>
      {grid.map((row, ri) => (
        <div key={ri} style={{ display:"flex", gap:2 }}>
          {row.map((cell, ci) => (
            <div key={ci} style={{
              width:14, height:14, background: CELL_COLORS[cell.trim()] ?? "#e5e7eb",
              borderRadius:2, display:"flex", alignItems:"center", justifyContent:"center",
              fontSize:7, fontWeight:700, color:"#1a1a2e",
            }}>{cell.trim()}</div>
          ))}
        </div>
      ))}
    </div>
  );
}

// ─── Spreadsheet table ────────────────────────────────────────────────────────

function Spreadsheet({ grid, flash, maxRows = 50, maxCols = 20 }) {
  if (!grid.length) return null;
  const rows = grid.slice(0, maxRows);
  const colCount = Math.min(Math.max(...grid.map(r => r.length)), maxCols);
  const truncRows = grid.length > maxRows;
  const truncCols = Math.max(...grid.map(r => r.length)) > maxCols;

  return (
    <div style={{ overflowX:"auto", overflowY:"auto", maxHeight:420 }}>
      <table style={{ borderCollapse:"collapse", fontSize:13, fontFamily:"'Google Sans', Arial, sans-serif", tableLayout:"fixed" }}>
        <thead>
          <tr>
            {/* row-number gutter header */}
            <th style={{
              width:40, minWidth:40, background:"#f8f9fa", border:"1px solid #e0e0e0",
              borderBottom:"2px solid #c0c0c0", padding:"4px 0", textAlign:"center",
              color:"#888", fontSize:11, fontWeight:400, position:"sticky", top:0, zIndex:2,
            }} />
            {Array.from({ length: colCount }, (_, ci) => (
              <th key={ci} style={{
                minWidth:80, background:"#f8f9fa", border:"1px solid #e0e0e0",
                borderBottom:"2px solid #c0c0c0",
                padding:"4px 8px", textAlign:"center",
                color:"#444", fontSize:11, fontWeight:500,
                position:"sticky", top:0, zIndex:1,
                letterSpacing:".05em",
              }}>{colLabel(ci)}</th>
            ))}
            {truncCols && <th style={{ background:"#f8f9fa", border:"1px solid #e0e0e0", padding:"4px 8px", color:"#aaa", fontSize:11 }}>…</th>}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, ri) => (
            <tr key={ri} style={{ animation: flash ? `cellFlash .5s ease-out` : "none" }}>
              {/* row number */}
              <td style={{
                background:"#f8f9fa", border:"1px solid #e0e0e0",
                padding:"3px 6px", textAlign:"center",
                color:"#999", fontSize:11, userSelect:"none",
                minWidth:40, width:40,
              }}>{ri + 1}</td>
              {Array.from({ length: colCount }, (_, ci) => {
                const val = row[ci] ?? "";
                return (
                  <td key={ci} style={{
                    border:"1px solid #e0e0e0",
                    padding:"3px 8px",
                    whiteSpace:"nowrap",
                    maxWidth:200, overflow:"hidden", textOverflow:"ellipsis",
                    background:"#fff",
                    color:"#1f1f1f",
                    fontSize:13,
                  }}>
                    {val !== "" ? val : ""}
                  </td>
                );
              })}
              {truncCols && <td style={{ border:"1px solid #e0e0e0", background:"#fafafa", color:"#ccc", textAlign:"center" }}>…</td>}
            </tr>
          ))}
          {truncRows && (
            <tr>
              <td colSpan={colCount + 1 + (truncCols ? 1 : 0)}
                style={{ border:"1px solid #e0e0e0", padding:"6px", color:"#aaa", textAlign:"center", background:"#fafafa", fontSize:12 }}>
                … {grid.length - maxRows} more rows
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

// ─── App ──────────────────────────────────────────────────────────────────────

export default function App() {
  const [input, setInput]       = useState("");
  const [grid, setGrid]         = useState(null);   // null = no data yet
  const [opLabel, setOpLabel]   = useState(null);   // last applied op name
  const [toast, setToast]       = useState(null);   // { msg, type }
  const [flash, setFlash]       = useState(false);
  const [flashOp, setFlashOp]   = useState(null);
  const [autoCopy, setAutoCopy] = useState(true);
  const taRef = useRef();
  const toastTimer = useRef();

  const inputGrid = parseTSV(input);
  const hasInput  = inputGrid.length > 0 && (inputGrid[0]?.length ?? 0) > 1;

  // Show the input grid as soon as paste is valid
  useEffect(() => {
    if (hasInput && !grid) setGrid(inputGrid);
    if (!hasInput && !input.trim()) { setGrid(null); setOpLabel(null); }
  }, [input]);

  function showToast(msg, type = "ok") {
    clearTimeout(toastTimer.current);
    setToast({ msg, type });
    toastTimer.current = setTimeout(() => setToast(null), 2200);
  }

  function copyGrid(g) {
    const text = toTSV(g);
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.cssText = "position:fixed;top:0;left:0;opacity:0;pointer-events:none;";
    document.body.appendChild(ta);
    ta.focus(); ta.select();
    try {
      document.execCommand("copy");
    } catch {
      navigator.clipboard?.writeText(text);
    } finally {
      document.body.removeChild(ta);
    }
  }

  const apply = useCallback((op) => {
    const base = grid ?? inputGrid;
    if (!base.length) return;
    setFlashOp(op.id);
    setTimeout(() => setFlashOp(null), 500);

    const newGrid = TRANSFORMS[op.id](base);
    setGrid(newGrid);
    setOpLabel(op.label);
    setFlash(true);
    setTimeout(() => setFlash(false), 500);

    // Auto-copy (if enabled)
    if (autoCopy) {
      copyGrid(newGrid);
      showToast(`${op.label} applied — copied to clipboard ✓`);
    } else {
      showToast(`${op.label} applied`);
    }
  }, [grid, inputGrid, autoCopy]);

  const manualCopy = useCallback(() => {
    if (!grid) return;
    copyGrid(grid);
    showToast("Copied to clipboard ✓");
  }, [grid]);

  const reset = () => { setInput(""); setGrid(null); setOpLabel(null); };

  const dims = grid ? `${grid.length} × ${(grid[0]?.length ?? 0)}` : null;

  return (
    <div style={{ minHeight:"100vh", background:"#f5f5f5", color:"#1f1f1f", fontFamily:"'Courier Prime','Courier New',monospace", colorScheme:"light" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Courier+Prime:wght@400;700&family=Bebas+Neue&display=swap');
        * { box-sizing:border-box; margin:0; padding:0; }
        ::-webkit-scrollbar { width:6px; height:6px; }
        ::-webkit-scrollbar-track { background:#f1f1f1; }
        ::-webkit-scrollbar-thumb { background:#c0c0c0; border-radius:3px; }

        .op-card {
          background:#fff; border:1px solid #e0e0e0; border-radius:10px;
          padding:14px; cursor:pointer; transition:all .15s;
          display:flex; flex-direction:column; gap:8px;
        }
        .op-card:hover { background:#f8f9fa; border-color:#aaa; transform:translateY(-2px); box-shadow:0 6px 20px rgba(0,0,0,.5); }
        .op-card:active { transform:translateY(0); }
        .op-card.disabled { opacity:.25; cursor:not-allowed; transform:none !important; }
        .op-card.flash { animation:cardFlash .45s ease-out; }
        @keyframes cardFlash {
          0%  { background:#e8eafd; border-color:#6366f1; }
          100%{ background:#fff; border-color:#e0e0e0; }
        }
        @keyframes cellFlash {
          0%  { background:#e8f0fe; }
          100%{ background:#fff; }
        }
        @keyframes fadeSlide { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:none} }
        @keyframes toastIn  { from{opacity:0;transform:translateY(16px) scale(.96)} to{opacity:1;transform:none} }
        @keyframes toastOut { from{opacity:1} to{opacity:0;transform:translateY(8px)} }

        .paste-area {
          width:100%; height:72px;
          background:#fff; border:1px solid #dadce0; border-radius:8px;
          color:#1f1f1f; font-family:inherit; font-size:13px;
          padding:12px 14px; resize:none; outline:none;
          transition:border-color .2s; line-height:1.6;
        }
        .paste-area:focus { border-color:#1a73e8; }
        .paste-area::placeholder { color:#aaa; }

        .sheet-wrap {
          background:#fff; border-radius:8px;
          border:1px solid #dadce0;
          box-shadow:0 2px 8px rgba(0,0,0,.12);
          overflow:hidden;
          animation:fadeSlide .2s ease-out;
        }
        .sheet-toolbar {
          background:#f8f9fa; border-bottom:1px solid #e0e0e0;
          padding:7px 14px; display:flex; align-items:center; gap:10px;
        }
        .copy-again-btn {
          padding:5px 14px; background:#1a73e8; border:none; border-radius:4px;
          color:#fff; font-size:12px; cursor:pointer; font-family:inherit;
          transition:background .15s;
        }
        .copy-again-btn:hover { background:#1558b0; }
        .dim-badge {
          display:inline-block; padding:2px 8px;
          background:#e8f0fe; border-radius:4px;
          font-size:11px; color:#1a73e8; font-family:inherit;
        }
        .section-head {
          font-family:'Bebas Neue',sans-serif;
          font-size:12px; letter-spacing:.2em; color:#888;
          margin-bottom:12px;
        }
        .op-key { font-family:'Bebas Neue',sans-serif; font-size:22px; color:#ccc; line-height:1; }
        .toast {
          position:fixed; bottom:28px; left:50%; transform:translateX(-50%);
          background:#202124; color:#fff; border-radius:8px;
          padding:10px 20px; font-size:13px;
          box-shadow:0 4px 16px rgba(0,0,0,.4);
          animation:toastIn .25s ease-out;
          white-space:nowrap; z-index:100;
        }
      `}</style>

      {/* Header */}
      <div style={{ borderBottom:"1px solid #e0e0e0", padding:"18px 32px", display:"flex", alignItems:"baseline", gap:16, background:"#fff" }}>
        <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:32, letterSpacing:".06em", color:"#1f1f1f" }}>
          Table<span style={{color:"#6366f1"}}>Flipper</span>
        </div>
        <div style={{ fontSize:12, color:"#888" }}>
          (╯°□°)╯︵ ┻━┻
        </div>
      </div>

      <div style={{ maxWidth:1000, margin:"0 auto", padding:"28px 24px", display:"flex", flexDirection:"column", gap:24, background:"#f5f5f5" }}>

        {/* Paste area */}
        <div>
          <div className="section-head" style={{ display:"flex", alignItems:"center", gap:10 }}>
            <span>01 — Paste your table</span>
            <button
              onClick={() => { setInput("A1\tA2\tA3\tA4\nB1\tB2\tB3\tB4\nC1\tC2\tC3\tC4💥"); setGrid(null); setOpLabel(null); }}
              style={{ background:"none", border:"none", color:"#1a73e8", fontSize:11, cursor:"pointer", fontFamily:"inherit", padding:0, textDecoration:"underline" }}
            >Example</button>
          </div>
          <textarea
            className="paste-area"
            ref={taRef}
            value={input}
            onChange={e => { setInput(e.target.value); setGrid(null); setOpLabel(null); }}
            placeholder="Copy cells from Excel / Google Sheets → Ctrl+C → paste here"
            spellCheck={false}
          />
          {input.trim() !== "" && !hasInput && (
            <div style={{ marginTop:6, fontSize:11, color:"#c62828" }}>
              ⚠ Could not detect multiple columns. Copy directly from a spreadsheet.
            </div>
          )}
        </div>

        {/* Spreadsheet view — shown once we have data */}
        {grid && (
          <div>
            <div className="section-head" style={{marginBottom:10}}>
              {opLabel ? `02 — After: ${opLabel}` : "02 — Your table"}
            </div>
            <div className="sheet-wrap">
              {/* Toolbar mimicking Google Sheets */}
              <div className="sheet-toolbar">
                <span style={{ fontSize:11, color:"#5f6368", fontFamily:"Arial,sans-serif" }}>
                  {opLabel
                    ? <span style={{color:"#1a73e8", fontWeight:500}}>{opLabel} applied</span>
                    : <span style={{color:"#5f6368"}}>No transform yet</span>
                  }
                </span>
                <span className="dim-badge">{dims}</span>
                <div style={{ marginLeft:"auto", display:"flex", gap:8, alignItems:"center" }}>
                  <label style={{ display:"flex", alignItems:"center", gap:4, fontSize:11, color:"#5f6368", fontFamily:"Arial,sans-serif", cursor:"pointer", userSelect:"none" }}>
                    <input
                      type="checkbox"
                      checked={autoCopy}
                      onChange={e => setAutoCopy(e.target.checked)}
                      style={{ cursor:"pointer" }}
                    />
                    Auto-copy
                  </label>
                  {opLabel && autoCopy && (
                    <span style={{ fontSize:11, color:"#5f6368", fontFamily:"Arial,sans-serif" }}>
                      ✓ Copied
                    </span>
                  )}
                  <button className="copy-again-btn" onClick={manualCopy}>
                    Copy
                  </button>
                  <button onClick={reset} style={{
                    padding:"5px 10px", background:"none", border:"1px solid #dadce0",
                    borderRadius:4, color:"#5f6368", fontSize:12, cursor:"pointer", fontFamily:"inherit",
                  }}>Reset</button>
                </div>
              </div>
              <Spreadsheet grid={grid} flash={flash} />
            </div>
          </div>
        )}

        {/* Transform buttons */}
        <div>
          <div className="section-head">
            {grid ? "03 — Apply another transform" : "02 — Choose a transformation"}
          </div>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill, minmax(160px, 1fr))", gap:8 }}>
            {OPS.map(op => (
              <button
                key={op.id}
                className={`op-card ${!hasInput ? "disabled" : ""} ${flashOp === op.id ? "flash" : ""}`}
                onClick={() => apply(op)}
                disabled={!hasInput}
                title={op.desc}
              >
                <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                  <MiniGrid grid={op.diagram} />
                  <span style={{ fontSize:16, color:"#bbb" }}>{op.arrow}</span>
                  <MiniGrid grid={op.diagramResult} />
                </div>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-end" }}>
                  <div>
                    <div style={{ fontSize:12, fontWeight:700, color:"#1f1f1f", lineHeight:1.2 }}>{op.label}</div>
                    <div style={{ fontSize:10, color:"#888", marginTop:2 }}>{op.desc}</div>
                  </div>
                  <div className="op-key" style={{color:"#bbb"}}>{op.key}</div>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Empty state */}
        {!hasInput && (
          <div style={{ textAlign:"center", padding:"32px 0", color:"#ccc", fontSize:13, lineHeight:2.4 }}>
            <div style={{ fontSize:32, marginBottom:6 }}>⊞</div>
            Copy cells from your spreadsheet →&nbsp;
            <span style={{color:"#888"}}>Ctrl+C</span> → paste above → pick a transform
          </div>
        )}

      </div>

      {/* Toast */}
      {toast && (
        <div className="toast">{toast.msg}</div>
      )}
    </div>
  );
}
