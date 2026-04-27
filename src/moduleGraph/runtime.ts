import * as d3 from 'd3';
import { createGraphState } from '../graph';
import { createRenderer } from '../render';
import { createUiState } from '../state';
import { createTooltip } from '../components/TooltipPanel';
import { COLORS } from '../constants';
import type { GraphEdge, GraphNode } from '../types/graph.types';
import type { AppState, GraphBuildArgs, GraphRuntime } from '../types/runtime.types';
import type { SavedStateSlice } from '../types/saved-state.types';

type BuildGraphRuntimeOptions = GraphBuildArgs & {
  area: HTMLElement;
  svgElement: SVGSVGElement;
  tipElement: HTMLElement;
  appState: AppState;
  clearSharedSettingId: () => void;
  onStatusMarkupChange: (markup: string) => void;
};

export function buildGraphRuntime({ catalog, nodes, prereqRules, edges, restoredState, hiddenLevels, area, svgElement, tipElement, appState, clearSharedSettingId, onStatusMarkupChange }: BuildGraphRuntimeOptions): GraphRuntime {
  const width = area.clientWidth || 900;
  const height = area.clientHeight || 620;
  const getNodeRadius = (node: GraphNode) => {
    const baseRadius = node.level === 'ext' ? 18 : node.level === 1000 ? 19 : 18;
    return Math.max(baseRadius, Math.ceil(node.id.length * 3.25));
  };

  const uiState = createUiState(nodes);
  if (restoredState) {
    uiState.replaceState(restoredState);
  }

  const graphState = createGraphState(nodes, edges, prereqRules);
  let previewState: { manualExcluded: Set<string>; selected: Set<string>; passed: Set<string> } | null = null;
  let searchQuery = '';

  const isNodeInHiddenLevel = (node: GraphNode) => appState.hiddenLevels.has(String(node.level));
  const computeLevelExcludedIds = (selectedSet = uiState.selected, passedSet = uiState.passed) => new Set<string>(nodes
    .filter((node) => isNodeInHiddenLevel(node) && !selectedSet.has(node.id) && !passedSet.has(node.id))
    .map((node) => node.id));

  const closePanel = () => {
    uiState.setActiveNodeId(null);
    uiState.setHoverId(null);
    tooltip.hideTip();
    renderer.render();
  };

  const toggleSelected = (node: GraphNode) => {
    clearSharedSettingId();
    if (uiState.selected.has(node.id)) {
      uiState.selected.delete(node.id);
    } else {
      uiState.selected.add(node.id);
      uiState.passed.delete(node.id);
      uiState.manualExcluded.delete(node.id);
    }
    syncUi();
    tooltip.showTip(node);
  };

  const togglePassed = (node: GraphNode) => {
    clearSharedSettingId();
    if (uiState.passed.has(node.id)) {
      uiState.passed.delete(node.id);
    } else {
      uiState.passed.add(node.id);
      uiState.selected.delete(node.id);
      uiState.manualExcluded.delete(node.id);
    }
    syncUi();
    tooltip.showTip(node);
  };

  const toggleExcluded = (node: GraphNode) => {
    clearSharedSettingId();
    if (uiState.manualExcluded.has(node.id)) {
      uiState.manualExcluded.delete(node.id);
    } else {
      uiState.manualExcluded.add(node.id);
      uiState.selected.delete(node.id);
      uiState.passed.delete(node.id);
      graphState.computeEffectivelyExcluded(uiState.manualExcluded, computeLevelExcludedIds()).forEach((id) => {
        uiState.selected.delete(id);
        uiState.passed.delete(id);
      });
    }
    syncUi();
    tooltip.showTip(node);
  };

  const tooltip = createTooltip(tipElement, {
    prereqRules,
    manualExcluded: uiState.manualExcluded,
    selected: uiState.selected,
    passed: uiState.passed,
    graphState,
    onSelectToggle: toggleSelected,
    onPassedToggle: togglePassed,
    onExcludeToggle: toggleExcluded,
    onClose: closePanel,
  });

  const svg = d3.select<SVGSVGElement, unknown>(svgElement);
  const root = svg.append('g');
  const antiLayer = root.append('g').attr('class', 'links links--anti');
  const excludedLayer = root.append('g').attr('class', 'graph-excluded-layer');
  const linkLayer = root.append('g').attr('class', 'links');
  const nodeLayer = root.append('g').attr('class', 'nodes');

  svg.call(
    d3.zoom()
      .scaleExtent([0.15, 5])
      .on('zoom', (event) => root.attr('transform', String(event.transform)))
  );

  const defs = svg.append('defs');
  const filt = defs.append('filter').attr('id', 'glow').attr('x', '-40%').attr('y', '-40%').attr('width', '180%').attr('height', '180%');
  filt.append('feGaussianBlur').attr('stdDeviation', '3').attr('result', 'blur');
  const feMerge = filt.append('feMerge');
  feMerge.append('feMergeNode').attr('in', 'blur');
  feMerge.append('feMergeNode').attr('in', 'SourceGraphic');

  [
    ['edge', COLORS.edge],
    ['hover-pre-required', COLORS.hoverPreRequired],
    ['hover-pre-optional', COLORS.hoverPreOptional],
    ['hover-coreq-required', COLORS.hoverCoreqRequired],
    ['hover-coreq-optional', COLORS.hoverCoreqOptional],
    ['hover-fwd', COLORS.hoverFwd],
    ['sel-pre-required', COLORS.selPreRequired],
    ['sel-pre-optional', COLORS.selPreOptional],
    ['sel-coreq-required', COLORS.selCoreqRequired],
    ['sel-coreq-optional', COLORS.selCoreqOptional],
    ['sel-fwd', COLORS.selFwd],
    ['coreq-required', COLORS.edgeCoreq],
    ['coreq-optional', COLORS.edgeCoreqOptional],
    ['anti', COLORS.anti],
    ['excl', COLORS.excl],
  ].forEach(([id, color]) => {
    defs.append('marker')
      .attr('id', `m-${id}`)
      .attr('viewBox', '0 0 10 10')
      .attr('refX', 18)
      .attr('refY', 5)
      .attr('markerWidth', 5)
      .attr('markerHeight', 5)
      .attr('orient', 'auto-start-reverse')
      .append('path')
      .attr('d', 'M2 1L8 5L2 9')
      .attr('fill', 'none')
      .attr('stroke', color)
      .attr('stroke-width', '1.5')
      .attr('stroke-linecap', 'round')
      .attr('stroke-linejoin', 'round');
  });

  const linkForce = d3.forceLink<GraphNode, GraphEdge>(edges).id((node) => node.id)
    .distance((edge) => (edge.etype === 'anti' ? 130 : 88))
    .strength((edge) => (edge.etype === 'anti' ? 0.04 : 0.5));

  const sim = d3.forceSimulation<GraphNode>(nodes)
    .force('link', linkForce)
    .force('charge', d3.forceManyBody<GraphNode>().strength((node) => (node.level === 'ext' ? -60 : -195)))
    .force('x', d3.forceX<GraphNode>((node) => {
      if (node.level === 'ext') return width * 0.93;
      return { 1000: width * 0.08, 2000: width * 0.24, 3000: width * 0.42, 4000: width * 0.62, 5000: width * 0.8 }[node.level] || width / 2;
    }).strength((node) => (node.level === 'ext' ? 0.7 : 0.45)))
    .force('y', d3.forceY<GraphNode>(height / 2).strength(0.04))
    .force('collision', d3.forceCollide<GraphNode>((node) => getNodeRadius(node) + 10));

  sim.alpha(1).restart();

  const refreshSimulation = () => {
    sim.nodes(nodes);
    linkForce.links(edges);
    sim.alpha(1).restart();
  };

  const linkSel = linkLayer
    .selectAll<SVGLineElement, GraphEdge>('line').data(edges).join('line').attr('fill', 'none');

  const nodeG = nodeLayer
    .selectAll<SVGGElement, GraphNode>('g').data(nodes).join('g').attr('cursor', 'pointer');

  nodeG.append('circle')
    .attr('r', (node) => getNodeRadius(node) + 6)
    .attr('fill', 'transparent')
    .attr('stroke', 'none');

  const circles = nodeG.append('circle')
    .attr('r', (node) => getNodeRadius(node));

  const labels = nodeG.append('text')
    .attr('text-anchor', 'middle')
    .attr('dy', '0.35em')
    .attr('font-family', 'var(--font-mono)')
    .attr('pointer-events', 'none')
    .attr('font-size', '9px')
    .text((node) => node.id);

  const renderer = createRenderer({
    nodeGroups: nodeG,
    circles,
    labels,
    linkSel,
    antiLayer: antiLayer.node()!,
    excludedLayer: excludedLayer.node()!,
    linkLayer: linkLayer.node()!,
    nodeLayer: nodeLayer.node()!,
    manualExcluded: uiState.manualExcluded,
    selected: uiState.selected,
    passed: uiState.passed,
    getHoverId: () => uiState.getActiveNodeId() || uiState.getHoverId(),
    getPreviewState: () => previewState,
    graphState,
    hiddenLevels,
    nodes,
  });

  const applySearchHighlight = () => {
    const query = searchQuery.toLowerCase().trim();
    if (!query) {
      renderer.render();
      return;
    }

    circles.attr('stroke-opacity', (node: GraphNode) => (
      node.id.toLowerCase().includes(query) || node.name.toLowerCase().includes(query) ? 1 : 0.06
    )).attr('fill-opacity', (node: GraphNode) => (
      node.id.toLowerCase().includes(query) || node.name.toLowerCase().includes(query) ? 0.25 : 0.04
    ));

    labels.attr('opacity', (node: GraphNode) => (
      node.id.toLowerCase().includes(query) || node.name.toLowerCase().includes(query) ? 1 : 0.06
    ));

    linkSel.attr('stroke-opacity', 0.03);
  };

  const syncUi = () => {
    renderer.render();
    applySearchHighlight();
    onStatusMarkupChange(uiState.getStatusMarkup(graphState, computeLevelExcludedIds()));
  };

  const drag = d3.drag<SVGGElement, GraphNode>()
    .on('start', (event, node) => {
      if (!event.active) sim.alphaTarget(0.3).restart();
      node.fx = node.x;
      node.fy = node.y;
    })
    .on('drag', (event, node) => {
      node.fx = event.x;
      node.fy = event.y;
    })
    .on('end', (event) => {
      if (!event.active) sim.alphaTarget(0);
    });

  nodeG.call(drag);
  nodeG.on('dblclick', (event, node) => {
    event.stopPropagation();
    node.fx = null;
    node.fy = null;
    sim.alphaTarget(0.1).restart();
  });

  nodeG
    .on('mouseover', (_event, node) => {
      if (uiState.getActiveNodeId()) return;
      uiState.setHoverId(node.id);
      renderer.render();
    })
    .on('mouseout', () => {
      if (uiState.getActiveNodeId()) return;
      uiState.setHoverId(null);
      renderer.render();
    })
    .on('click', (event, node) => {
      event.stopPropagation();

      uiState.setActiveNodeId(node.id);
      uiState.setHoverId(node.id);
      syncUi();
      tooltip.showTip(node);
    });

  sim.on('tick', () => {
    const getClampedPoint = (node: GraphNode) => {
      const radius = getNodeRadius(node);
      return {
        x: Math.max(radius + 8, Math.min(width - radius - 8, node.x ?? width / 2)),
        y: Math.max(radius + 8, Math.min(height - radius - 8, node.y ?? height / 2)),
      };
    };

    const resolveNode = (node: string | GraphNode) => (typeof node === 'string' ? nodes.find((candidate) => candidate.id === node) : node) as GraphNode;

    linkSel
      .attr('x1', (edge) => {
        const sourceNode = resolveNode(edge.source);
        const targetNode = resolveNode(edge.target);
        const source = getClampedPoint(sourceNode);
        const target = getClampedPoint(targetNode);
        const dx = target.x - source.x;
        const dy = target.y - source.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        const radius = getNodeRadius(sourceNode);
        return source.x + (dx / dist) * radius;
      })
      .attr('y1', (edge) => {
        const sourceNode = resolveNode(edge.source);
        const targetNode = resolveNode(edge.target);
        const source = getClampedPoint(sourceNode);
        const target = getClampedPoint(targetNode);
        const dx = target.x - source.x;
        const dy = target.y - source.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        const radius = getNodeRadius(sourceNode);
        return source.y + (dy / dist) * radius;
      })
      .attr('x2', (edge) => {
        const sourceNode = resolveNode(edge.source);
        const targetNode = resolveNode(edge.target);
        const source = getClampedPoint(sourceNode);
        const target = getClampedPoint(targetNode);
        const dx = target.x - source.x;
        const dy = target.y - source.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        const radius = getNodeRadius(targetNode);
        return target.x - (dx / dist) * radius;
      })
      .attr('y2', (edge) => {
        const sourceNode = resolveNode(edge.source);
        const targetNode = resolveNode(edge.target);
        const source = getClampedPoint(sourceNode);
        const target = getClampedPoint(targetNode);
        const dx = target.x - source.x;
        const dy = target.y - source.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        const radius = getNodeRadius(targetNode);
        return target.y - (dy / dist) * radius;
      });

    nodeG.attr('transform', (node) => {
      const clamped = getClampedPoint(node);
      node.x = clamped.x;
      node.y = clamped.y;
      return `translate(${clamped.x},${clamped.y})`;
    });
  });

  onStatusMarkupChange(`Showing ${catalog.name}. Hover to explore, or click a node to pin its details.`);

  return {
    catalog,
    uiState,
    graphState,
    syncUi,
    setPreviewState: (snapshot: SavedStateSlice | null = null) => {
      previewState = snapshot ? {
        manualExcluded: new Set(snapshot.excluded || []),
        selected: new Set(snapshot.selected || []),
        passed: new Set(snapshot.passed || []),
      } : null;
      renderer.render();
      applySearchHighlight();
    },
    setSearchQuery: (query: string) => {
      searchQuery = query;
      applySearchHighlight();
    },
    setHiddenLevels: (levels: Set<string>) => {
      appState.hiddenLevels = new Set(levels);
      refreshSimulation();
      syncUi();
    },
    clearAll: () => {
      clearSharedSettingId();
      uiState.clearAll();
      uiState.setHoverId(null);
      uiState.setActiveNodeId(null);
      tooltip.hideTip();
      syncUi();
    },
    snapshot: () => ({
      catalogId: catalog.id,
      year: appState.currentYear,
      selected: [...uiState.selected],
      passed: [...uiState.passed],
      excluded: [...uiState.manualExcluded],
      blocked: [...graphState.computeEffectivelyExcluded(uiState.manualExcluded, computeLevelExcludedIds())]
        .filter((id) => !uiState.manualExcluded.has(id)),
      hiddenLevels: [...appState.hiddenLevels],
    }),
  };
}
