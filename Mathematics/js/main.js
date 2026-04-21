// js/main.js — D3 initialisation, simulation, event wiring, search

(function () {
  const svg  = d3.select('#graph-svg');
  const area = document.getElementById('graph-area');
  const W    = area.clientWidth  || 900;
  const H    = area.clientHeight || 620;

  // ── Zoom / pan layer ─────────────────────────────────
  const g = svg.append('g');
  svg.call(
    d3.zoom()
      .scaleExtent([0.15, 5])
      .on('zoom', e => g.attr('transform', e.transform))
  );

  // ── Arrow markers ────────────────────────────────────
  const defs = svg.append('defs');

  // Glow filter for hover highlight
  const filt = defs.append('filter').attr('id', 'glow').attr('x', '-40%').attr('y', '-40%').attr('width', '180%').attr('height', '180%');
  filt.append('feGaussianBlur').attr('stdDeviation', '3').attr('result', 'blur');
  const feMerge = filt.append('feMerge');
  feMerge.append('feMergeNode').attr('in', 'blur');
  feMerge.append('feMergeNode').attr('in', 'SourceGraphic');

  [
    ['edge', COLORS.edge],
    ['pre',  COLORS.pre],
    ['fwd',  COLORS.fwd],
    ['anti', COLORS.anti],
    ['excl', COLORS.excl],
  ].forEach(([id, col]) => {
    defs.append('marker')
      .attr('id', 'm-' + id)
      .attr('viewBox', '0 0 10 10')
      .attr('refX', 18).attr('refY', 5)
      .attr('markerWidth', 5).attr('markerHeight', 5)
      .attr('orient', 'auto-start-reverse')
      .append('path')
        .attr('d', 'M2 1L8 5L2 9')
        .attr('fill', 'none')
        .attr('stroke', col)
        .attr('stroke-width', '1.5')
        .attr('stroke-linecap', 'round')
        .attr('stroke-linejoin', 'round');
  });

  // ── Force simulation ─────────────────────────────────
  const sim = d3.forceSimulation(NODES)
    .force('link',
      d3.forceLink(EDGES).id(d => d.id)
        .distance(d => d.etype === 'anti' ? 130 : 88)
        .strength(d => d.etype === 'anti' ? 0.04 : 0.5)
    )
    .force('charge', d3.forceManyBody().strength(d => d.level === 'ext' ? -60 : -195))
    .force('x', d3.forceX(d => {
      if (d.level === 'ext') return W * 0.93;
      return { 1000: W * 0.08, 2000: W * 0.27, 3000: W * 0.53, 4000: W * 0.77 }[d.level] || W / 2;
    }).strength(d => d.level === 'ext' ? 0.7 : 0.45))
    .force('y', d3.forceY(H / 2).strength(0.04))
    .force('collision', d3.forceCollide(27));

  // ── Build D3 elements ─────────────────────────────────
  const linkSel = g.append('g').attr('class', 'links')
    .selectAll('line').data(EDGES).join('line').attr('fill', 'none');

  const nodeG = g.append('g').attr('class', 'nodes')
    .selectAll('g').data(NODES).join('g').attr('cursor', 'pointer');

  // Invisible wider hit target
  nodeG.append('circle')
    .attr('r', d => (d.level === 'ext' ? 11 : 15) + 6)
    .attr('fill', 'transparent')
    .attr('stroke', 'none');

  const circles = nodeG.append('circle')
    .attr('r', d => d.level === 'ext' ? 11 : d.level === 1000 ? 15 : 14);

  const labels = nodeG.append('text')
    .attr('text-anchor', 'middle')
    .attr('dy', '0.35em')
    .attr('font-family', 'var(--font-mono)')
    .attr('pointer-events', 'none')
    .attr('font-size', d => d.level === 'ext' ? '9px' : '10px')
    .text(d => d.level === 'ext' ? d.id : d.id.replace('MT', ''));

  // Pass render targets to render.js
  setRenderTargets(circles, labels, linkSel, nodeG);

  // ── Drag behaviour ────────────────────────────────────
  const drag = d3.drag()
    .on('start', (event, d) => {
      if (!event.active) sim.alphaTarget(0.3).restart();
      d.fx = d.x;
      d.fy = d.y;
      hideTip();
    })
    .on('drag', (event, d) => {
      d.fx = event.x;
      d.fy = event.y;
    })
    .on('end', (event, d) => {
      if (!event.active) sim.alphaTarget(0);
      // Keep node pinned where it was dropped
      // (un-pin by double-clicking)
    });

  nodeG.call(drag);

  // Double-click to un-pin a dragged node
  nodeG.on('dblclick', (event, d) => {
    event.stopPropagation();
    d.fx = null;
    d.fy = null;
    sim.alphaTarget(0.1).restart();
  });

  // ── Mouse interactions ────────────────────────────────
  nodeG
    .on('mouseover', (event, d) => {
      hoverId = d.id;
      render();
      showTip(event, d);
    })
    .on('mousemove', event => moveTip(event))
    .on('mouseout', () => {
      hoverId = null;
      render();
      hideTip();
    })
    .on('click', (event, d) => {
      event.stopPropagation();
      if (d.level === 'ext') return;
      if (mode === 'explore') return; // explore mode: no selection changes

      if (mode === 'select') {
        if (selected.has(d.id)) selected.delete(d.id);
        else { selected.add(d.id); manualExcluded.delete(d.id); }
      } else {
        // exclude mode
        if (manualExcluded.has(d.id)) {
          manualExcluded.delete(d.id);
        } else {
          manualExcluded.add(d.id);
          selected.delete(d.id);
          computeEffectivelyExcluded(manualExcluded).forEach(id => selected.delete(id));
        }
      }

      render();
      updateStatus();
      // Refresh tooltip in place
      showTip(event, d);
    });

  // ── Simulation tick ───────────────────────────────────
  sim.on('tick', () => {
    linkSel
      .attr('x1', d => d.source.x)
      .attr('y1', d => d.source.y)
      .attr('x2', d => {
        const dx = d.target.x - d.source.x, dy = d.target.y - d.source.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        const r = d.target.level === 'ext' ? 11 : 14;
        return d.target.x - dx / dist * r;
      })
      .attr('y2', d => {
        const dx = d.target.x - d.source.x, dy = d.target.y - d.source.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        const r = d.target.level === 'ext' ? 11 : 14;
        return d.target.y - dy / dist * r;
      });

    nodeG.attr('transform', d =>
      `translate(${Math.max(16, Math.min(W - 16, d.x))},${Math.max(16, Math.min(H - 16, d.y))})`
    );
  });

  render();

  // ── Search / filter ───────────────────────────────────
  window.filterSearch = function (q) {
    const lq = q.toLowerCase().trim();
    if (!lq) { render(); return; }
    circles.attr('stroke-opacity', d =>
      d.id.toLowerCase().includes(lq) || d.name.toLowerCase().includes(lq) ? 1 : 0.06
    ).attr('fill-opacity', d =>
      d.id.toLowerCase().includes(lq) || d.name.toLowerCase().includes(lq) ? 0.25 : 0.04
    );
    labels.attr('opacity', d =>
      d.id.toLowerCase().includes(lq) || d.name.toLowerCase().includes(lq) ? 1 : 0.06
    );
    linkSel.attr('stroke-opacity', 0.03);
  };

})();
