import { COLORS } from './constants.js';

export function createRenderer({ nodeGroups, circles, labels, linkSel, manualExcluded, selected, getHoverId, graphState, hiddenLevels, nodes }) {
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

    return 'normal';
  }

  const nodeMap = Object.fromEntries((nodes || []).map((node) => [node.id, node]));

  function render() {
    const hoverId = getHoverId();
    const effExcl = graphState.computeEffectivelyExcluded(manualExcluded);
    const isHiddenLevel = (node) => hiddenLevels.has(String(node.level));
    const isExternal = (node) => node.isExternal || String(node.level) === 'ext' || node.frequency === 'external';
    const levelKey = (node) => (isExternal(node) ? 'ext' : String(node.level));
    const hAnc = hoverId ? graphState.getPrerequisitePathNodes(hoverId) : new Set();
    const hDesc = hoverId ? graphState.getForwardPathNodes(hoverId) : new Set();
    const effectiveSel = new Set([...selected].filter((id) => !effExcl.has(id)));
    const selAnc = effectiveSel.size ? graphState.getAncestorsOfSet([...effectiveSel]) : new Set();
    const selDesc = new Set();
    if (effectiveSel.size) {
      effectiveSel.forEach((id) => {
        graphState.getForwardPathNodes(id).forEach((descendant) => selDesc.add(descendant));
      });
    }

    const ctx = { effExcl, manualExcluded, effectiveSel, hAnc, hDesc, selAnc, selDesc };

    const effectiveReqKind = new Map();
    const prereqLinksByTarget = new Map();
    linkSel.each((link) => {
      if (link.etype === 'prereq') {
        const target = typeof link.target === 'object' ? link.target.id : link.target;
        if (!prereqLinksByTarget.has(target)) prereqLinksByTarget.set(target, []);
        prereqLinksByTarget.get(target).push(link);
      }
    });
    prereqLinksByTarget.forEach((links) => {
      const optionalLinks = links.filter(link => link.requirementKind === 'optional');
      const activeOptional = optionalLinks.filter(link => {
        const source = typeof link.source === 'object' ? link.source.id : link.source;
        return !effExcl.has(source);
      });
      if (activeOptional.length === 1) {
        effectiveReqKind.set(activeOptional[0], 'required');
      }
    });

    if (nodeGroups) {
      nodeGroups.attr('display', (node) => (isHiddenLevel(node) ? 'none' : null));
    }

    circles
      .attr('fill', (node) => {
        const state = nodeState(node, ctx);
        if (state === 'excl-manual') return COLORS.excl;
        if (state === 'excl-implied') return COLORS.excl;
        if (state === 'selected') return COLORS.sel;
        if (state === 'hover') return COLORS.lvl[levelKey(node)] || '#888';
        if (state === 'hpre' || state === 'spre') return 'rgba(252,211,77,0.15)';
        if (state === 'hfwd') return 'rgba(96,165,250,0.12)';
        if (state === 'sfwd') return 'rgba(56,189,248,0.14)';
        return COLORS.lvl[levelKey(node)] || '#888';
      })
      .attr('fill-opacity', (node) => {
        const state = nodeState(node, ctx);
        if (state === 'hover') return 0.25;
        if (state === 'hpre' || state === 'spre' || state === 'hfwd' || state === 'sfwd') return 1;
        if (state === 'selected') return 0.85;
        if (state === 'excl-implied') return 0.08;
        return 0.18;
      })
      .attr('stroke', (node) => {
        const state = nodeState(node, ctx);
        if (state === 'excl-manual') return COLORS.excl;
        if (state === 'excl-implied') return COLORS.excl;
        if (state === 'selected') return COLORS.sel;
        if (state === 'hover') return COLORS.lvl[levelKey(node)] || '#888';
        if (state === 'hpre') return COLORS.hoverPreRequired;
        if (state === 'spre') return COLORS.selPreRequired;
        if (state === 'hfwd') return COLORS.hoverFwd;
        if (state === 'sfwd') return COLORS.selFwd;
        if (isExternal(node)) return COLORS.lvl.ext;
        return COLORS.lvl[levelKey(node)] || '#888';
      })
      .attr('stroke-width', (node) => {
        const state = nodeState(node, ctx);
        if (['excl-manual', 'selected', 'hover', 'hpre', 'spre', 'hfwd', 'sfwd'].includes(state)) return 2;
        if (state === 'excl-implied') return 1.5;
        return 1.2;
      })
      .attr('stroke-dasharray', (node) => (nodeState(node, ctx) === 'excl-implied' ? '3 2' : null))
      .attr('stroke-opacity', (node) => (nodeState(node, ctx) === 'excl-implied' ? 0.6 : 1));

    circles.classed('node-unavailable', (node) => node.availableInSelectedYear === false);

    labels
      .attr('display', (node) => (isHiddenLevel(node) ? 'none' : null))
      .attr('fill', (node) => {
        const state = nodeState(node, ctx);
        if (state === 'excl-manual') return COLORS.excl;
        if (state === 'excl-implied') return COLORS.excl;
        if (state === 'selected') return COLORS.sel;
        if (state === 'hover') return COLORS.lvl[levelKey(node)] || '#888';
        if (state === 'hpre') return COLORS.hoverPreRequired;
        if (state === 'spre') return COLORS.selPreRequired;
        if (state === 'hfwd') return COLORS.hoverFwd;
        if (state === 'sfwd') return COLORS.selFwd;
        if (isExternal(node)) return COLORS.lvl.ext;
        return COLORS.lvl[levelKey(node)] || '#888';
      })
      .attr('opacity', (node) => (nodeState(node, ctx) === 'excl-implied' ? 0.2 : 1))
      .attr('font-weight', (node) => {
        const state = nodeState(node, ctx);
        return ['selected', 'hover', 'hpre', 'spre', 'hfwd', 'sfwd'].includes(state) ? '500' : '400';
      });

    linkSel
      .attr('display', (link) => {
        const sourceNode = typeof link.source === 'object' ? link.source : nodeMap[link.source];
        const targetNode = typeof link.target === 'object' ? link.target : nodeMap[link.target];
        if ((sourceNode && isHiddenLevel(sourceNode)) || (targetNode && isHiddenLevel(targetNode))) {
          return 'none';
        }
        return null;
      })
      .attr('stroke', (link) => {
        const state = edgeState(link, ctx);
        const reqKind = effectiveReqKind.get(link) || link.requirementKind;
        if (state === 'anti') return COLORS.anti;
        if (state === 'hpre') return reqKind === 'optional' ? COLORS.hoverPreOptional : COLORS.hoverPreRequired;
        if (state === 'spre') return reqKind === 'optional' ? COLORS.selPreOptional : COLORS.selPreRequired;
        if (state === 'hfwd') return COLORS.hoverFwd;
        if (state === 'sfwd') return COLORS.selFwd;
        if (state === 'excl') return COLORS.excl;
        return reqKind === 'optional' ? COLORS.edgeOptional : COLORS.edge;
      })
      .attr('stroke-width', (link) => {
        const state = edgeState(link, ctx);
        if (['hpre', 'spre', 'hfwd', 'sfwd'].includes(state)) return 2;
        if (state === 'anti' || state === 'excl') return 1.5;
        return 0.8;
      })
      .attr('stroke-opacity', (link) => {
        const state = edgeState(link, ctx);
        if (['hpre', 'spre', 'hfwd', 'sfwd'].includes(state)) return 0.85;
        if (state === 'anti') return 0.7;
        if (state === 'excl') return 0.4;
        return 0.25;
      })
      .attr('stroke-dasharray', (link) => (link.etype === 'anti' ? '5 3' : null))
      .attr('marker-end', (link) => {
        const state = edgeState(link, ctx);
        const reqKind = effectiveReqKind.get(link) || link.requirementKind;
        if (state === 'anti') return 'url(#m-anti)';
        if (state === 'hpre') return reqKind === 'optional' ? 'url(#m-hover-pre-optional)' : 'url(#m-hover-pre-required)';
        if (state === 'spre') return reqKind === 'optional' ? 'url(#m-sel-pre-optional)' : 'url(#m-sel-pre-required)';
        if (state === 'hfwd') return 'url(#m-hover-fwd)';
        if (state === 'sfwd') return 'url(#m-sel-fwd)';
        if (state === 'excl') return 'url(#m-excl)';
        return 'url(#m-edge)';
      });
  }

  return { render };
}
