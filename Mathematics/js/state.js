// js/state.js — Application interaction state and status bar

// ─── Interaction state ────────────────────────────────
let mode     = 'explore';   // 'explore' | 'select' | 'exclude'
let hoverId  = null;
const manualExcluded = new Set();
const selected       = new Set();

// ─── Mode switching ───────────────────────────────────
function setMode(m) {
  mode = m;
  ['explore', 'select', 'exclude'].forEach(k => {
    document.getElementById('btn-' + k).classList.toggle('active', k === m);
  });
  const svg = document.getElementById('graph-svg');
  svg.className = 'mode-' + m;
}

// ─── Clear all selections & exclusions ───────────────
function clearAll() {
  manualExcluded.clear();
  selected.clear();
  render();
  updateStatus();
}

// ─── Status bar ───────────────────────────────────────
function updateStatus() {
  const effExcl = computeEffectivelyExcluded(manualExcluded);
  const parts = [];

  if (selected.size) {
    const names = [...selected].map(id => {
      const n = NODES.find(n => n.id === id);
      return `${id} <em>${n ? n.name : ''}</em>`;
    }).join(', ');
    parts.push(`<span class="status-sel">▸ ${names}</span>`);
  }

  if (manualExcluded.size) {
    const names = [...manualExcluded].map(id => {
      const n = NODES.find(n => n.id === id);
      return `${id} <em>${n ? n.name : ''}</em>`;
    }).join(', ');
    parts.push(`<span class="status-excl">✕ ${names}</span>`);
  }

  const implied = [...effExcl].filter(id => !manualExcluded.has(id));
  if (implied.length) {
    parts.push(`<span class="status-block">Blocked: ${implied.join(', ')}</span>`);
  }

  const el = document.getElementById('status-text');
  if (!parts.length) {
    el.innerHTML = 'Hover a node to explore its prerequisite chain, or switch modes to select and exclude.';
  } else {
    el.innerHTML = parts.join(' <span class="status-sep">·</span> ');
  }
}
