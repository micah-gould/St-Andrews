import * as d3 from "d3";
import { createGraphState } from "../graph";
import { createRenderer } from "../render";
import { createUiState } from "../state";
import { createTooltip } from "../components/TooltipPanel";
import { COLORS } from "../constants";
import type { GraphEdge, GraphNode } from "../types/graph.types";
import type {
  AppState,
  GraphBuildArgs,
  GraphRuntime,
} from "../types/runtime.types";
import type { SavedStateSlice } from "../types/saved-state.types";

const LEVEL_X: Record<string, number> = {
  "1000": 0.1,
  "2000": 0.28,
  "3000": 0.46,
  "4000": 0.64,
  "5000": 0.82,
  ext: 0.94,
};

type BuildGraphRuntimeOptions = GraphBuildArgs & {
  area: HTMLElement;
  svgElement: SVGSVGElement;
  tipElement: HTMLElement;
  appState: AppState;
  clearSharedSettingId: () => void;
  onStatusMarkupChange: (markup: string) => void;
};

export function buildGraphRuntime({
  catalog,
  nodes,
  prereqRules,
  edges,
  restoredState,
  hiddenLevels: _hiddenLevels,
  area,
  svgElement,
  tipElement,
  appState,
  clearSharedSettingId,
  onStatusMarkupChange,
}: BuildGraphRuntimeOptions): GraphRuntime {
  const width = area.clientWidth || 900;
  const height = area.clientHeight || 620;
  const nodeById = new Map(nodes.map((node) => [node.id, node]));
  const getNodeRadius = (node: GraphNode) => {
    const baseRadius =
      node.level === "ext" ? 18 : node.level === 1000 ? 19 : 18;
    return Math.max(baseRadius, Math.ceil(node.id.length * 3.25));
  };

  const uiState = createUiState(nodes);
  if (restoredState) {
    uiState.replaceState(restoredState);
  }

  const graphState = createGraphState(nodes, edges, prereqRules);
  let previewState: {
    manualExcluded: Set<string>;
    selected: Set<string>;
    passed: Set<string>;
  } | null = null;
  let searchQuery = "";
  let searchHoverNodeId: string | null = null;
  const pinnedNodeIds = new Set<string>();
  const collapsedPinnedNodeIds = new Set<string>();
  let floatingNodeId: string | null = null;

  const isNodeInHiddenLevel = (node: GraphNode) =>
    appState.hiddenLevels.has(String(node.level));
  const computeLevelExcludedIds = (
    selectedSet = uiState.selected,
    passedSet = uiState.passed,
  ) =>
    new Set<string>(
      nodes
        .filter(
          (node) =>
            isNodeInHiddenLevel(node) &&
            !selectedSet.has(node.id) &&
            !passedSet.has(node.id),
        )
        .map((node) => node.id),
    );

  const syncTooltipPanels = () => {
    const panels = [] as Array<{
      node: GraphNode;
      isPinned: boolean;
      isCollapsed: boolean;
      onTogglePin: () => void;
      onToggleCollapsed: () => void;
      onClose: () => void;
    }>;

    pinnedNodeIds.forEach((nodeId) => {
      const node = nodeById.get(nodeId);
      if (!node) return;
      panels.push({
        node,
        isPinned: true,
        isCollapsed: collapsedPinnedNodeIds.has(nodeId),
        onTogglePin: () => {
          pinnedNodeIds.delete(nodeId);
          collapsedPinnedNodeIds.delete(nodeId);
          floatingNodeId = nodeId;
          if (uiState.getActiveNodeId() === nodeId) {
            uiState.setActiveNodeId(null);
          }
          if (uiState.getHoverId() === nodeId) {
            uiState.setHoverId(null);
          }
          syncTooltipPanels();
          renderer.render();
        },
        onToggleCollapsed: () => {
          if (collapsedPinnedNodeIds.has(nodeId)) {
            collapsedPinnedNodeIds.delete(nodeId);
          } else {
            collapsedPinnedNodeIds.add(nodeId);
          }
          syncTooltipPanels();
        },
        onClose: () => {
          pinnedNodeIds.delete(nodeId);
          collapsedPinnedNodeIds.delete(nodeId);
          if (uiState.getActiveNodeId() === nodeId) {
            uiState.setActiveNodeId(null);
          }
          if (uiState.getHoverId() === nodeId) {
            uiState.setHoverId(null);
          }
          syncTooltipPanels();
          renderer.render();
        },
      });
    });

    if (floatingNodeId && !pinnedNodeIds.has(floatingNodeId)) {
      const node = nodeById.get(floatingNodeId);
      if (node) {
        const floatingId = floatingNodeId;
        panels.push({
          node,
          isPinned: false,
          isCollapsed: false,
          onTogglePin: () => {
            pinnedNodeIds.add(floatingId);
            floatingNodeId = null;
            syncTooltipPanels();
          },
          onToggleCollapsed: () => {},
          onClose: () => {
            if (floatingNodeId === floatingId) {
              floatingNodeId = null;
            }
            if (uiState.getActiveNodeId() === floatingId) {
              uiState.setActiveNodeId(null);
            }
            if (uiState.getHoverId() === floatingId) {
              uiState.setHoverId(null);
            }
            syncTooltipPanels();
            renderer.render();
          },
        });
      }
    }

    tooltip.showTips(panels);
  };

  const closePanel = () => {
    floatingNodeId = null;
    uiState.setActiveNodeId(null);
    uiState.setHoverId(null);
    syncTooltipPanels();
    renderer.render();
  };

  const closeAllPanels = () => {
    pinnedNodeIds.clear();
    collapsedPinnedNodeIds.clear();
    floatingNodeId = null;
    uiState.setActiveNodeId(null);
    uiState.setHoverId(null);
    tooltip.hideTip();
    renderer.render();
  };

  const showTooltipFor = (node: GraphNode) => {
    floatingNodeId = node.id;
    syncTooltipPanels();
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
    showTooltipFor(node);
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
    showTooltipFor(node);
  };

  const toggleExcluded = (node: GraphNode) => {
    clearSharedSettingId();
    if (uiState.manualExcluded.has(node.id)) {
      uiState.manualExcluded.delete(node.id);
    } else {
      uiState.manualExcluded.add(node.id);
      uiState.selected.delete(node.id);
      uiState.passed.delete(node.id);
      graphState
        .computeEffectivelyExcluded(
          uiState.manualExcluded,
          computeLevelExcludedIds(),
        )
        .forEach((id) => {
          uiState.selected.delete(id);
          uiState.passed.delete(id);
        });
    }
    syncUi();
    showTooltipFor(node);
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
    onClose: () => {
      closePanel();
    },
  });

  const svg = d3.select<SVGSVGElement, unknown>(svgElement);
  const root = svg.append("g");
  const antiLayer = root.append("g").attr("class", "links links--anti");
  const excludedLayer = root.append("g").attr("class", "graph-excluded-layer");
  const linkLayer = root.append("g").attr("class", "links");
  const nodeLayer = root.append("g").attr("class", "nodes");

  const zoomBehavior = d3
    .zoom<SVGSVGElement, unknown>()
    .scaleExtent([0.15, 5])
    .on("zoom", (event) => root.attr("transform", String(event.transform)));

  svg.call(zoomBehavior);

  const defs = svg.append("defs");
  const filt = defs
    .append("filter")
    .attr("id", "glow")
    .attr("x", "-40%")
    .attr("y", "-40%")
    .attr("width", "180%")
    .attr("height", "180%");
  filt
    .append("feGaussianBlur")
    .attr("stdDeviation", "3")
    .attr("result", "blur");
  const feMerge = filt.append("feMerge");
  feMerge.append("feMergeNode").attr("in", "blur");
  feMerge.append("feMergeNode").attr("in", "SourceGraphic");

  [
    ["edge", COLORS.edge],
    ["hover-pre-required", COLORS.hoverPreRequired],
    ["hover-pre-optional", COLORS.hoverPreOptional],
    ["hover-coreq-required", COLORS.hoverCoreqRequired],
    ["hover-coreq-optional", COLORS.hoverCoreqOptional],
    ["hover-fwd", COLORS.hoverFwd],
    ["sel-pre-required", COLORS.selPreRequired],
    ["sel-pre-optional", COLORS.selPreOptional],
    ["sel-coreq-required", COLORS.selCoreqRequired],
    ["sel-coreq-optional", COLORS.selCoreqOptional],
    ["sel-fwd", COLORS.selFwd],
    ["coreq-required", COLORS.edgeCoreq],
    ["coreq-optional", COLORS.edgeCoreqOptional],
    ["anti", COLORS.anti],
    ["excl", COLORS.excl],
  ].forEach(([id, color]) => {
    defs
      .append("marker")
      .attr("id", `m-${id}`)
      .attr("viewBox", "0 0 10 10")
      .attr("refX", 18)
      .attr("refY", 5)
      .attr("markerWidth", 5)
      .attr("markerHeight", 5)
      .attr("orient", "auto-start-reverse")
      .append("path")
      .attr("d", "M2 1L8 5L2 9")
      .attr("fill", "none")
      .attr("stroke", color)
      .attr("stroke-width", "1.5")
      .attr("stroke-linecap", "round")
      .attr("stroke-linejoin", "round");
  });

  const nodeDegree = new Map<string, number>();
  edges.forEach((edge) => {
    const source =
      typeof edge.source === "object" ? edge.source.id : edge.source;
    const target =
      typeof edge.target === "object" ? edge.target.id : edge.target;
    nodeDegree.set(source, (nodeDegree.get(source) || 0) + 1);
    nodeDegree.set(target, (nodeDegree.get(target) || 0) + 1);
  });

  const seedLayout = () => {
    const buckets = new Map<string, GraphNode[]>();

    nodes.forEach((node) => {
      const key = String(node.level);
      const bucket = buckets.get(key);
      if (bucket) {
        bucket.push(node);
      } else {
        buckets.set(key, [node]);
      }
    });

    buckets.forEach((bucket, key) => {
      bucket.sort((left, right) => {
        const leftLinks = nodeDegree.get(left.id) || 0;
        const rightLinks = nodeDegree.get(right.id) || 0;
        if (leftLinks !== rightLinks) return rightLinks - leftLinks;
        return left.id.localeCompare(right.id);
      });

      const columnX = width * (LEVEL_X[key] ?? 0.5);
      const gap = Math.max(
        64,
        Math.min(104, height / Math.max(bucket.length + 1, 2)),
      );
      const totalHeight = gap * Math.max(bucket.length - 1, 0);
      const startY = Math.max(56, (height - totalHeight) / 2);

      bucket.forEach((node, index) => {
        const jitter = ((index % 3) - 1) * 18;
        node.x = columnX + jitter;
        node.y = Math.min(height - 40, startY + index * gap);
      });
    });
  };

  seedLayout();

  const linkForce = d3
    .forceLink<GraphNode, GraphEdge>(edges)
    .id((node) => node.id)
    .distance((edge) =>
      edge.etype === "anti" ? 150 : edge.etype === "coreq" ? 92 : 78,
    )
    .strength((edge) =>
      edge.etype === "anti" ? 0.02 : edge.etype === "coreq" ? 0.12 : 0.16,
    );

  const sim = d3
    .forceSimulation<GraphNode>(nodes)
    .force("link", linkForce)
    .force(
      "charge",
      d3
        .forceManyBody<GraphNode>()
        .strength((node) => (node.level === "ext" ? -55 : -135)),
    )
    .force(
      "x",
      d3
        .forceX<GraphNode>(
          (node) => width * (LEVEL_X[String(node.level)] ?? 0.5),
        )
        .strength((node) => (node.level === "ext" ? 0.22 : 0.12)),
    )
    .force("y", d3.forceY<GraphNode>(height / 2).strength(0.045))
    .force(
      "collision",
      d3.forceCollide<GraphNode>((node) => getNodeRadius(node) + 12),
    )
    .stop();

  const settleTicks = Math.max(100, Math.min(180, nodes.length * 2));
  for (let index = 0; index < settleTicks; index += 1) {
    sim.tick();
  }

  nodes.forEach((node) => {
    node.fx = node.x ?? null;
    node.fy = node.y ?? null;
  });

  const linkSel = linkLayer
    .selectAll<SVGLineElement, GraphEdge>("line")
    .data(edges)
    .join("line")
    .attr("fill", "none");

  const edgesByNodeId = new Map<string, GraphEdge[]>();
  edges.forEach((edge) => {
    const source =
      typeof edge.source === "object" ? edge.source.id : edge.source;
    const target =
      typeof edge.target === "object" ? edge.target.id : edge.target;
    edgesByNodeId.set(source, [...(edgesByNodeId.get(source) || []), edge]);
    edgesByNodeId.set(target, [...(edgesByNodeId.get(target) || []), edge]);
  });

  const nodeG = nodeLayer
    .selectAll<SVGGElement, GraphNode>("g")
    .data(nodes)
    .join("g")
    .attr("cursor", "pointer");

  nodeG
    .append("circle")
    .attr("r", (node) => getNodeRadius(node) + 6)
    .attr("fill", "transparent")
    .attr("stroke", "none");

  const circles = nodeG
    .append("circle")
    .attr("r", (node) => getNodeRadius(node));

  const labels = nodeG
    .append("text")
    .attr("text-anchor", "middle")
    .attr("dy", "0.35em")
    .attr("font-family", "var(--font-mono)")
    .attr("pointer-events", "none")
    .attr("font-size", "9px")
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
    getHoverId: () =>
      searchHoverNodeId || uiState.getActiveNodeId() || uiState.getHoverId(),
    getPinnedNodeIds: () => pinnedNodeIds,
    getSearchQuery: () => searchQuery,
    getPreviewState: () => previewState,
    getHiddenLevels: () => appState.hiddenLevels,
    graphState,
    nodes,
  });

  const syncUi = () => {
    renderer.render();
    onStatusMarkupChange(
      uiState.getStatusMarkup(graphState, computeLevelExcludedIds()),
    );
  };

  const activateNode = (node: GraphNode) => {
    if (collapsedPinnedNodeIds.has(node.id)) {
      collapsedPinnedNodeIds.delete(node.id);
    }
    uiState.setActiveNodeId(node.id);
    uiState.setHoverId(node.id);
    syncUi();
    showTooltipFor(node);
  };

  const dragGrabOffset = new WeakMap<GraphNode, { x: number; y: number }>();
  const dragStartPoint = new WeakMap<GraphNode, { x: number; y: number }>();

  const pointerToGraph = (
    sourceEvent: Event | null | undefined,
    fallbackNode: GraphNode,
  ) => {
    if (!sourceEvent) {
      return {
        x: fallbackNode.x ?? width / 2,
        y: fallbackNode.y ?? height / 2,
      };
    }

    const touch = sourceEvent as TouchEvent;
    const pointSource =
      touch.touches?.[0] ||
      touch.changedTouches?.[0] ||
      (sourceEvent as MouseEvent);
    const rect = svgElement.getBoundingClientRect();
    const localX = pointSource.clientX - rect.left;
    const localY = pointSource.clientY - rect.top;
    const zoom = d3.zoomTransform(svgElement);

    return {
      x: zoom.invertX(localX),
      y: zoom.invertY(localY),
    };
  };

  const drag = d3
    .drag<SVGGElement, GraphNode>()
    .container(() => root.node() as SVGGElement)
    .subject((_event, node) => node)
    .clickDistance(6)
    .on("start", function (event, node) {
      const currentX = node.x ?? width / 2;
      const currentY = node.y ?? height / 2;
      dragStartPoint.set(node, { x: currentX, y: currentY });
      const pointer = pointerToGraph(
        event.sourceEvent as Event | null | undefined,
        node,
      );
      dragGrabOffset.set(node, {
        x: pointer.x - currentX,
        y: pointer.y - currentY,
      });
      node.fx = currentX;
      node.fy = currentY;
      node.x = currentX;
      node.y = currentY;
      d3.select<SVGGElement, GraphNode>(this).attr(
        "transform",
        `translate(${node.x ?? width / 2},${node.y ?? height / 2})`,
      );
    })
    .on("drag", function (event, node) {
      const pointer = pointerToGraph(
        event.sourceEvent as Event | null | undefined,
        node,
      );
      const offset = dragGrabOffset.get(node) || { x: 0, y: 0 };
      const nextX = pointer.x - offset.x;
      const nextY = pointer.y - offset.y;
      node.fx = nextX;
      node.fy = nextY;
      node.x = nextX;
      node.y = nextY;
      const connectedEdges = new Set(edgesByNodeId.get(node.id) || []);
      linkSel
        .filter((edge) => connectedEdges.has(edge))
        .attr("x1", (edge) => {
          const sourceNode = (
            typeof edge.source === "string"
              ? nodeById.get(edge.source)
              : edge.source
          ) as GraphNode;
          const targetNode = (
            typeof edge.target === "string"
              ? nodeById.get(edge.target)
              : edge.target
          ) as GraphNode;
          const dx = (targetNode.x ?? width / 2) - (sourceNode.x ?? width / 2);
          const dy =
            (targetNode.y ?? height / 2) - (sourceNode.y ?? height / 2);
          const dist = Math.sqrt(dx * dx + dy * dy) || 1;
          return (
            (sourceNode.x ?? width / 2) +
            (dx / dist) * getNodeRadius(sourceNode)
          );
        })
        .attr("y1", (edge) => {
          const sourceNode = (
            typeof edge.source === "string"
              ? nodeById.get(edge.source)
              : edge.source
          ) as GraphNode;
          const targetNode = (
            typeof edge.target === "string"
              ? nodeById.get(edge.target)
              : edge.target
          ) as GraphNode;
          const dx = (targetNode.x ?? width / 2) - (sourceNode.x ?? width / 2);
          const dy =
            (targetNode.y ?? height / 2) - (sourceNode.y ?? height / 2);
          const dist = Math.sqrt(dx * dx + dy * dy) || 1;
          return (
            (sourceNode.y ?? height / 2) +
            (dy / dist) * getNodeRadius(sourceNode)
          );
        })
        .attr("x2", (edge) => {
          const sourceNode = (
            typeof edge.source === "string"
              ? nodeById.get(edge.source)
              : edge.source
          ) as GraphNode;
          const targetNode = (
            typeof edge.target === "string"
              ? nodeById.get(edge.target)
              : edge.target
          ) as GraphNode;
          const dx = (targetNode.x ?? width / 2) - (sourceNode.x ?? width / 2);
          const dy =
            (targetNode.y ?? height / 2) - (sourceNode.y ?? height / 2);
          const dist = Math.sqrt(dx * dx + dy * dy) || 1;
          return (
            (targetNode.x ?? width / 2) -
            (dx / dist) * getNodeRadius(targetNode)
          );
        })
        .attr("y2", (edge) => {
          const sourceNode = (
            typeof edge.source === "string"
              ? nodeById.get(edge.source)
              : edge.source
          ) as GraphNode;
          const targetNode = (
            typeof edge.target === "string"
              ? nodeById.get(edge.target)
              : edge.target
          ) as GraphNode;
          const dx = (targetNode.x ?? width / 2) - (sourceNode.x ?? width / 2);
          const dy =
            (targetNode.y ?? height / 2) - (sourceNode.y ?? height / 2);
          const dist = Math.sqrt(dx * dx + dy * dy) || 1;
          return (
            (targetNode.y ?? height / 2) -
            (dy / dist) * getNodeRadius(targetNode)
          );
        });

      d3.select<SVGGElement, GraphNode>(this).attr(
        "transform",
        `translate(${node.x ?? width / 2},${node.y ?? height / 2})`,
      );
    })
    .on("end", (event, node) => {
      dragGrabOffset.delete(node);
      const startPoint = dragStartPoint.get(node);
      dragStartPoint.delete(node);
      node.fx = node.x;
      node.fy = node.y;
      const moved = startPoint
        ? Math.hypot((node.x ?? 0) - startPoint.x, (node.y ?? 0) - startPoint.y)
        : Math.hypot(event.dx || 0, event.dy || 0);
      if (moved < 6) {
        activateNode(node);
      }
    });

  nodeG.call(drag);
  nodeG.on("dblclick", (event, node) => {
    event.stopPropagation();
    node.fx = node.x;
    node.fy = node.y;
    sim.alpha(0.08);
    for (let index = 0; index < 8; index += 1) {
      sim.tick();
    }
    node.fx = node.x;
    node.fy = node.y;
    positionGraph();
  });

  nodeG
    .on("mouseover", (_event, node) => {
      if (uiState.getActiveNodeId()) return;
      uiState.setHoverId(node.id);
      renderer.render();
    })
    .on("mouseout", () => {
      if (uiState.getHoverId() === null) return;
      uiState.setHoverId(null);
      renderer.render();
      if (pinnedNodeIds.size > 0) return;
      if (uiState.getActiveNodeId()) return;
      closePanel();
    })
    .on("click", (event, node) => {
      event.stopPropagation();
      activateNode(node);
    });

  const handleEscape = (event: KeyboardEvent) => {
    if (event.key !== "Escape") return;
    closeAllPanels();
  };

  const handlePointerDownOutside = (event: PointerEvent) => {
    const target = event.target as Node | null;
    if (!target) return;
    if (tipElement.contains(target)) return;
    closePanel();
  };

  document.addEventListener("keydown", handleEscape);
  document.addEventListener("pointerdown", handlePointerDownOutside, true);

  const positionGraph = () => {
    const getClampedPoint = (node: GraphNode) => {
      const radius = getNodeRadius(node);
      return {
        x: Math.max(
          radius + 8,
          Math.min(width - radius - 8, node.fx ?? node.x ?? width / 2),
        ),
        y: Math.max(
          radius + 8,
          Math.min(height - radius - 8, node.fy ?? node.y ?? height / 2),
        ),
      };
    };

    const resolveNode = (node: string | GraphNode) =>
      (typeof node === "string" ? nodeById.get(node) : node) as GraphNode;

    linkSel
      .attr("x1", (edge) => {
        const sourceNode = resolveNode(edge.source);
        const targetNode = resolveNode(edge.target);
        const source = getClampedPoint(sourceNode);
        const target = getClampedPoint(targetNode);
        const dx = target.x - source.x;
        const dy = target.y - source.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        return source.x + (dx / dist) * getNodeRadius(sourceNode);
      })
      .attr("y1", (edge) => {
        const sourceNode = resolveNode(edge.source);
        const targetNode = resolveNode(edge.target);
        const source = getClampedPoint(sourceNode);
        const target = getClampedPoint(targetNode);
        const dx = target.x - source.x;
        const dy = target.y - source.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        return source.y + (dy / dist) * getNodeRadius(sourceNode);
      })
      .attr("x2", (edge) => {
        const sourceNode = resolveNode(edge.source);
        const targetNode = resolveNode(edge.target);
        const source = getClampedPoint(sourceNode);
        const target = getClampedPoint(targetNode);
        const dx = target.x - source.x;
        const dy = target.y - source.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        return target.x - (dx / dist) * getNodeRadius(targetNode);
      })
      .attr("y2", (edge) => {
        const sourceNode = resolveNode(edge.source);
        const targetNode = resolveNode(edge.target);
        const source = getClampedPoint(sourceNode);
        const target = getClampedPoint(targetNode);
        const dx = target.x - source.x;
        const dy = target.y - source.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        return target.y - (dy / dist) * getNodeRadius(targetNode);
      });

    nodeG.attr("transform", (node) => {
      const clamped = getClampedPoint(node);
      node.x = clamped.x;
      node.y = clamped.y;
      return `translate(${clamped.x},${clamped.y})`;
    });
  };

  positionGraph();

  onStatusMarkupChange(
    `Showing ${catalog.name}. Hover to explore, or click a node to pin its details.`,
  );

  return {
    catalog,
    uiState,
    graphState,
    syncUi,
    setPreviewState: (snapshot: SavedStateSlice | null = null) => {
      previewState = snapshot
        ? {
            manualExcluded: new Set(snapshot.excluded || []),
            selected: new Set(snapshot.selected || []),
            passed: new Set(snapshot.passed || []),
          }
        : null;
      renderer.render();
      renderer.render();
    },
    setSearchQuery: (query: string) => {
      searchQuery = query;
      renderer.render();
    },
    setSearchHover: (nodeId: string | null) => {
      if (nodeId && !nodeById.has(nodeId)) return;
      searchHoverNodeId = nodeId;
      renderer.render();
    },
    activateNodeById: (nodeId: string) => {
      const node = nodeById.get(nodeId);
      if (!node) return false;
      activateNode(node);
      return true;
    },
    setHiddenLevels: (levels: Set<string>) => {
      appState.hiddenLevels = new Set(levels);
      syncUi();
    },
    clearAll: () => {
      clearSharedSettingId();
      uiState.clearAll();
      uiState.setHoverId(null);
      uiState.setActiveNodeId(null);
      pinnedNodeIds.clear();
      collapsedPinnedNodeIds.clear();
      floatingNodeId = null;
      tooltip.hideTip();
      syncUi();
    },
    destroy: () => {
      document.removeEventListener("keydown", handleEscape);
      document.removeEventListener(
        "pointerdown",
        handlePointerDownOutside,
        true,
      );
      sim.stop();
      tooltip.destroy();
      svg.on(".zoom", null);
      svg.selectAll("*").remove();
      tipElement.style.display = "none";
    },
    snapshot: () => ({
      catalogId: catalog.id,
      year: appState.currentYear,
      selected: [...uiState.selected],
      passed: [...uiState.passed],
      excluded: [...uiState.manualExcluded],
      blocked: [
        ...graphState.computeEffectivelyExcluded(
          uiState.manualExcluded,
          computeLevelExcludedIds(),
        ),
      ].filter((id) => !uiState.manualExcluded.has(id)),
      hiddenLevels: [...appState.hiddenLevels],
    }),
  };
}
