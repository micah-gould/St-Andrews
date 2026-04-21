// js/tooltip.js — Tooltip rendering and positioning

const tipEl = () => document.getElementById('tip');

function showTip(event, d) {
  const tip = tipEl();
  const effExcl  = computeEffectivelyExcluded(manualExcluded);
  const rules    = PREREQ_RULES[d.id] || [];
  const isEffExcl  = effExcl.has(d.id);
  const isManual   = manualExcluded.has(d.id);
  const isSelected = selected.has(d.id);

  // ── Prereq rows ──
  let prereqHtml = '';
  if (rules.length) {
    prereqHtml = rules.map(r => {
      const badgeCls = r.type === 'all' ? 'tip-badge--all' : 'tip-badge--one';
      const label    = r.type === 'all' ? 'need all' : 'need one';
      const srcLabels = r.sources.map(s => {
        const excl = effExcl.has(s);
        return excl
          ? `<span class="tip-src-excl">${s}</span>`
          : `<span>${s}</span>`;
      }).join(' ');
      return `<span class="tip-badge ${badgeCls}">${label}</span>${srcLabels}`;
    }).join('<br>');
  } else {
    prereqHtml = '<span style="color:var(--text-dim)">None</span>';
  }

  // ── Full ancestor chain ──
  const ancs = [...getAllAncestors(d.id)];
  const chainLine = ancs.length
    ? `<div class="tip-chain">Full chain: ${ancs.join(' → ')}</div>`
    : '';

  // ── Anti-req note ──
  const antiLine = d.id === 'MT4512'
    ? `<div class="tip-anti-note">Anti-req: CS3052</div>`
    : '';

  // ── Exclusion note ──
  const exclNote = isEffExcl && !isManual
    ? `<div class="tip-excl-note">Blocked — prerequisites unavailable</div>`
    : isManual
    ? `<div class="tip-excl-note">Manually excluded</div>`
    : '';

  // ── Click hint ──
  let hintText = '';
  if (d.level !== 'ext') {
    if (mode === 'explore') hintText = 'Switch to Select or Exclude mode to modify';
    else if (mode === 'select') hintText = isSelected ? 'Click to deselect' : 'Click to select';
    else hintText = isManual ? 'Click to un-exclude' : 'Click to exclude';
  }

  tip.innerHTML = `
    <div class="tip-id">${d.id}</div>
    <div class="tip-name">${d.name}</div>
    ${exclNote}
    <div class="tip-section">
      <div class="tip-label">Prerequisites</div>
      ${prereqHtml}
      ${chainLine}
    </div>
    ${antiLine}
    ${hintText ? `<div class="tip-hint">${hintText}</div>` : ''}
  `;
  tip.style.display = 'block';
  moveTip(event);
}

function hideTip() {
  tipEl().style.display = 'none';
}

function moveTip(event) {
  const area = document.getElementById('graph-area');
  const rect  = area.getBoundingClientRect();
  const W = area.clientWidth;
  const H = area.clientHeight;
  const tx = event.clientX - rect.left;
  const ty = event.clientY - rect.top;
  const tip = tipEl();
  tip.style.left = (tx > W - 300 ? tx - 286 : tx + 14) + 'px';
  tip.style.top  = (ty > H - 220 ? ty - 200 : ty + 14) + 'px';
}
