// js/render.js — Visual state computation and D3 updates

// These variables are set by main.js after D3 setup
let circles, labels, linkSel, nodeG;

function setRenderTargets(c, l, ls, ng) {
  circles = c; labels = l; linkSel = ls; nodeG = ng;
}

// ─── Per-node visual state ────────────────────────────
function nodeState(d, { effExcl, effectiveSel, hAnc, hDesc, selAnc, selDesc, anyActive }) {
  const id = d.id;
  if (manualExcluded.has(id))  return 'excl-manual';
  if (effExcl.has(id))         return 'excl-implied';
  if (effectiveSel.has(id))    return 'selected';
  if (hoverId === id)          return 'hover';
  if (hoverId && hAnc.has(id)) return 'hpre';
  if (hoverId && hDesc.has(id))return 'hfwd';
  if (selAnc.has(id))          return 'spre';
  if (selDesc.has(id))         return 'sfwd';
  if (anyActive)               return 'dim';
  return 'normal';
}

// ─── Per-edge visual state ────────────────────────────
function edgeState(l, { effExcl, effectiveSel, hAnc, hDesc, selAnc, selDesc, anyActive }) {
  if (l.etype === 'anti') return 'anti';
  const s = l.source.id || l.source;
  const t = l.target.id || l.target;
  if (effExcl.has(s) || effExcl.has(t)) return 'excl';

  const hSet  = hoverId ? new Set([hoverId, ...hAnc])  : new Set();
  const hFSet = hoverId ? new Set([hoverId, ...hDesc]) : new Set();
  if (hoverId && hSet.has(s)  && hSet.has(t))  return 'hpre';
  if (hoverId && hFSet.has(s) && hFSet.has(t)) return 'hfwd';

  const sAll  = new Set([...effectiveSel, ...selAnc]);
  const sFAll = new Set([...effectiveSel, ...selDesc]);
  if (sAll.has(s)  && sAll.has(t))  return 'spre';
  if (sFAll.has(s) && sFAll.has(t)) return 'sfwd';

  if (anyActive) return 'dim';
  return 'normal';
}

// ─── Main render pass ─────────────────────────────────
function render() {
  const effExcl     = computeEffectivelyExcluded(manualExcluded);
  const hAnc        = hoverId ? getAllAncestors(hoverId)  : new Set();
  const hDesc       = hoverId ? getAllDescendants(hoverId): new Set();
  const effectiveSel= new Set([...selected].filter(id => !effExcl.has(id)));
  const selAnc      = effectiveSel.size ? getAncestorsOfSet([...effectiveSel])  : new Set();
  const selDesc     = effectiveSel.size ? getDescendantsOfSet([...effectiveSel]): new Set();
  const anyActive   = hoverId || selected.size || manualExcluded.size;

  const ctx = { effExcl, effectiveSel, hAnc, hDesc, selAnc, selDesc, anyActive };

  // ── Circles ──
  circles
    .attr('fill', d => {
      const st = nodeState(d, ctx);
      if (st === 'excl-manual')  return COLORS.excl;
      if (st === 'excl-implied') return 'rgba(248,113,113,0.12)';
      if (st === 'selected')     return COLORS.sel;
      if (st === 'hover')        return COLORS.lvl[d.level] || '#888';
      if (st === 'hpre' || st === 'spre') return 'rgba(252,211,77,0.15)';
      if (st === 'hfwd' || st === 'sfwd') return 'rgba(96,165,250,0.12)';
      return COLORS.lvl[d.level] || '#888';
    })
    .attr('fill-opacity', d => {
      const st = nodeState(d, ctx);
      if (st === 'dim') return 0.08;
      if (st === 'hover') return 0.25;
      if (st === 'hpre' || st === 'spre' || st === 'hfwd' || st === 'sfwd') return 1;
      if (st === 'selected') return 0.85;
      if (st === 'excl-implied') return 1;
      return 0.18;
    })
    .attr('stroke', d => {
      const st = nodeState(d, ctx);
      if (st === 'excl-manual')  return COLORS.excl;
      if (st === 'excl-implied') return COLORS.excl;
      if (st === 'selected')     return COLORS.sel;
      if (st === 'hover')        return COLORS.lvl[d.level] || '#888';
      if (st === 'hpre' || st === 'spre') return COLORS.pre;
      if (st === 'hfwd' || st === 'sfwd') return COLORS.fwd;
      if (d.level === 'ext')     return COLORS.excl;
      if (st === 'dim')          return COLORS.lvl[d.level] || '#888';
      return COLORS.lvl[d.level] || '#888';
    })
    .attr('stroke-width', d => {
      const st = nodeState(d, ctx);
      if (['excl-manual','selected','hover','hpre','spre','hfwd','sfwd'].includes(st)) return 2;
      if (st === 'excl-implied') return 1.5;
      return 1.2;
    })
    .attr('stroke-dasharray', d => nodeState(d, ctx) === 'excl-implied' ? '3 2' : null)
    .attr('stroke-opacity', d => {
      const st = nodeState(d, ctx);
      if (st === 'dim') return 0.15;
      return 1;
    });

  // ── Labels ──
  labels
    .attr('fill', d => {
      const st = nodeState(d, ctx);
      if (st === 'excl-manual' || st === 'excl-implied') return COLORS.excl;
      if (st === 'selected')     return COLORS.sel;
      if (st === 'hover')        return COLORS.lvl[d.level] || '#888';
      if (st === 'hpre' || st === 'spre') return COLORS.pre;
      if (st === 'hfwd' || st === 'sfwd') return COLORS.fwd;
      if (d.level === 'ext')     return COLORS.excl;
      if (st === 'dim')          return '#475569';
      return COLORS.lvl[d.level] || '#888';
    })
    .attr('opacity', d => {
      const st = nodeState(d, ctx);
      return st === 'dim' ? 0.2 : 1;
    })
    .attr('font-weight', d => {
      const st = nodeState(d, ctx);
      return ['selected','hover','hpre','spre','hfwd','sfwd'].includes(st) ? '500' : '400';
    });

  // ── Edges ──
  linkSel
    .attr('stroke', l => {
      const st = edgeState(l, ctx);
      if (st === 'anti')  return COLORS.anti;
      if (st === 'hpre' || st === 'spre') return COLORS.pre;
      if (st === 'hfwd' || st === 'sfwd') return COLORS.fwd;
      if (st === 'excl')  return COLORS.excl;
      return COLORS.edge;
    })
    .attr('stroke-width', l => {
      const st = edgeState(l, ctx);
      if (['hpre','spre','hfwd','sfwd'].includes(st)) return 2;
      if (st === 'anti' || st === 'excl') return 1.5;
      return 0.8;
    })
    .attr('stroke-opacity', l => {
      const st = edgeState(l, ctx);
      if (st === 'dim')   return 0.03;
      if (['hpre','spre','hfwd','sfwd'].includes(st)) return 0.85;
      if (st === 'anti')  return 0.7;
      if (st === 'excl')  return 0.4;
      return 0.25;
    })
    .attr('stroke-dasharray', l => l.etype === 'anti' ? '5 3' : null)
    .attr('marker-end', l => {
      const st = edgeState(l, ctx);
      if (st === 'anti')  return 'url(#m-anti)';
      if (st === 'hpre' || st === 'spre') return 'url(#m-pre)';
      if (st === 'hfwd' || st === 'sfwd') return 'url(#m-fwd)';
      if (st === 'excl')  return 'url(#m-excl)';
      return 'url(#m-edge)';
    });
}
