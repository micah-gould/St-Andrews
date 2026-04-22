import { COLORS } from './constants.js';

export function createRenderer({ circles, labels, linkSel, manualExcluded, selected, getHoverId, graphState }) {
  function nodeState(node, ctx) {
    const id = node.id;
    const hoverId = getHoverId();
    if (manualExcluded.has(id)) return 'excl-manual';
    if (ctx.effExcl.has(id)) return 'excl-implied';
    if (ctx.effectiveSel.has(id)) return 'selected';
    if (hoverId === id) return 'hover';
    if (hoverId && ctx.hAnc.has(id)) return 'hpre';
    if (hoverId && ctx.hDesc.has(id)) return 'hfwd';
    if (ctx.selAnc.has(id)) return 'spre';
    if (ctx.selDesc.has(id)) return 'sfwd';
    if (ctx.anyActive) return 'dim';
    return 'normal';
  }

  function edgeState(link, ctx) {
    const hoverId = getHoverId();
    if (link.etype === 'anti') return 'anti';
    const source = link.source.id || link.source;
    const target = link.target.id || link.target;
    if (ctx.effExcl.has(source) || ctx.effExcl.has(target)) return 'excl';

    const hoverPre = hoverId ? new Set([hoverId, ...ctx.hAnc]) : new Set();
    const hoverFwd = hoverId ? new Set([hoverId, ...ctx.hDesc]) : new Set();
    if (hoverId && hoverPre.has(source) && hoverPre.has(target)) return 'hpre';
    if (hoverId && hoverFwd.has(source) && hoverFwd.has(target)) return 'hfwd';

    const selectedPre = new Set([...ctx.effectiveSel, ...ctx.selAnc]);
    const selectedFwd = new Set([...ctx.effectiveSel, ...ctx.selDesc]);
    if (selectedPre.has(source) && selectedPre.has(target)) return 'spre';
    if (selectedFwd.has(source) && selectedFwd.has(target)) return 'sfwd';

    if (ctx.anyActive) return 'dim';
    return 'normal';
  }

  function render() {
    const hoverId = getHoverId();
    const effExcl = graphState.computeEffectivelyExcluded(manualExcluded);
    const hAnc = hoverId ? graphState.getAllAncestors(hoverId) : new Set();
    const hDesc = hoverId ? graphState.getAllDescendants(hoverId) : new Set();
    const effectiveSel = new Set([...selected].filter((id) => !effExcl.has(id)));
    const selAnc = effectiveSel.size ? graphState.getAncestorsOfSet([...effectiveSel]) : new Set();
    const selDesc = effectiveSel.size ? graphState.getDescendantsOfSet([...effectiveSel]) : new Set();
    const anyActive = Boolean(hoverId || selected.size || manualExcluded.size);

    const ctx = { effExcl, effectiveSel, hAnc, hDesc, selAnc, selDesc, anyActive };

    circles
      .attr('fill', (node) => {
        const state = nodeState(node, ctx);
        if (state === 'excl-manual') return COLORS.excl;
        if (state === 'excl-implied') return 'rgba(248,113,113,0.12)';
        if (state === 'selected') return COLORS.sel;
        if (state === 'hover') return COLORS.lvl[node.level] || '#888';
        if (state === 'hpre' || state === 'spre') return 'rgba(252,211,77,0.15)';
        if (state === 'hfwd' || state === 'sfwd') return 'rgba(96,165,250,0.12)';
        return COLORS.lvl[node.level] || '#888';
      })
      .attr('fill-opacity', (node) => {
        const state = nodeState(node, ctx);
        if (state === 'dim') return 0.08;
        if (state === 'hover') return 0.25;
        if (state === 'hpre' || state === 'spre' || state === 'hfwd' || state === 'sfwd') return 1;
        if (state === 'selected') return 0.85;
        if (state === 'excl-implied') return 1;
        return 0.18;
      })
      .attr('stroke', (node) => {
        const state = nodeState(node, ctx);
        if (state === 'excl-manual' || state === 'excl-implied') return COLORS.excl;
        if (state === 'selected') return COLORS.sel;
        if (state === 'hover') return COLORS.lvl[node.level] || '#888';
        if (state === 'hpre' || state === 'spre') return COLORS.pre;
        if (state === 'hfwd' || state === 'sfwd') return COLORS.fwd;
        if (node.level === 'ext') return COLORS.excl;
        return COLORS.lvl[node.level] || '#888';
      })
      .attr('stroke-width', (node) => {
        const state = nodeState(node, ctx);
        if (['excl-manual', 'selected', 'hover', 'hpre', 'spre', 'hfwd', 'sfwd'].includes(state)) return 2;
        if (state === 'excl-implied') return 1.5;
        return 1.2;
      })
      .attr('stroke-dasharray', (node) => (nodeState(node, ctx) === 'excl-implied' ? '3 2' : null))
      .attr('stroke-opacity', (node) => (nodeState(node, ctx) === 'dim' ? 0.15 : 1));

    labels
      .attr('fill', (node) => {
        const state = nodeState(node, ctx);
        if (state === 'excl-manual' || state === 'excl-implied') return COLORS.excl;
        if (state === 'selected') return COLORS.sel;
        if (state === 'hover') return COLORS.lvl[node.level] || '#888';
        if (state === 'hpre' || state === 'spre') return COLORS.pre;
        if (state === 'hfwd' || state === 'sfwd') return COLORS.fwd;
        if (node.level === 'ext') return COLORS.excl;
        if (state === 'dim') return '#475569';
        return COLORS.lvl[node.level] || '#888';
      })
      .attr('opacity', (node) => (nodeState(node, ctx) === 'dim' ? 0.2 : 1))
      .attr('font-weight', (node) => {
        const state = nodeState(node, ctx);
        return ['selected', 'hover', 'hpre', 'spre', 'hfwd', 'sfwd'].includes(state) ? '500' : '400';
      });

    linkSel
      .attr('stroke', (link) => {
        const state = edgeState(link, ctx);
        if (state === 'anti') return COLORS.anti;
        if (state === 'hpre' || state === 'spre') return COLORS.pre;
        if (state === 'hfwd' || state === 'sfwd') return COLORS.fwd;
        if (state === 'excl') return COLORS.excl;
        return COLORS.edge;
      })
      .attr('stroke-width', (link) => {
        const state = edgeState(link, ctx);
        if (['hpre', 'spre', 'hfwd', 'sfwd'].includes(state)) return 2;
        if (state === 'anti' || state === 'excl') return 1.5;
        return 0.8;
      })
      .attr('stroke-opacity', (link) => {
        const state = edgeState(link, ctx);
        if (state === 'dim') return 0.03;
        if (['hpre', 'spre', 'hfwd', 'sfwd'].includes(state)) return 0.85;
        if (state === 'anti') return 0.7;
        if (state === 'excl') return 0.4;
        return 0.25;
      })
      .attr('stroke-dasharray', (link) => (link.etype === 'anti' ? '5 3' : null))
      .attr('marker-end', (link) => {
        const state = edgeState(link, ctx);
        if (state === 'anti') return 'url(#m-anti)';
        if (state === 'hpre' || state === 'spre') return 'url(#m-pre)';
        if (state === 'hfwd' || state === 'sfwd') return 'url(#m-fwd)';
        if (state === 'excl') return 'url(#m-excl)';
        return 'url(#m-edge)';
      });
  }

  return { render };
}
