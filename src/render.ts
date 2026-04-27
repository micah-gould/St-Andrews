import { COLORS } from "./constants";
import type { GraphEdge, GraphNode } from "./types/graph.types";
import type { RendererContext, RendererOptions } from "./types/runtime.types";

export function createRenderer({
  nodeGroups,
  circles,
  labels,
  linkSel,
  antiLayer,
  excludedLayer,
  linkLayer,
  nodeLayer,
  manualExcluded,
  selected,
  passed,
  getHoverId,
  getPreviewState,
  getHiddenLevels,
  graphState,
  nodes,
}: RendererOptions) {
  function nodeState(node: GraphNode, ctx: RendererContext) {
    const id = node.id;
    const hoverId = getHoverId();
    const hoveredExcluded = Boolean(hoverId && ctx.effExcl.has(hoverId));
    if (ctx.manualExcluded.has(id)) return "excl-manual";
    if (ctx.effExcl.has(id)) return "excl-implied";
    if (ctx.effectivePassed.has(id)) return "passed";
    if (ctx.effectiveSel.has(id)) return "selected";
    if (hoverId === id) return "hover";
    if (hoverId && !hoveredExcluded && ctx.hAnc.has(id)) return "hpre";
    if (hoverId && !hoveredExcluded && ctx.hCoreq.has(id)) return "hcoreq";
    if (hoverId && !hoveredExcluded && ctx.hDesc.has(id)) return "hfwd";
    if (ctx.selAnc.has(id)) return "spre";
    if (ctx.selCoreq.has(id)) return "scoreq";
    if (ctx.selDesc.has(id)) return "sfwd";
    return "normal";
  }

  function edgeState(link: GraphEdge, ctx: RendererContext) {
    const hoverId = getHoverId();
    if (link.etype === "anti") return "anti";
    const source =
      typeof link.source === "object" ? link.source.id : link.source;
    const target =
      typeof link.target === "object" ? link.target.id : link.target;
    if (link.etype === "coreq") {
      const coreqGroup = hoverId
        ? new Set([hoverId, ...ctx.hCoreq])
        : new Set();
      if (hoverId && coreqGroup.has(source) && coreqGroup.has(target))
        return "hcoreq";
      const selectedCoreq = new Set([
        ...ctx.effectiveSel,
        ...ctx.effectivePassed,
        ...ctx.selCoreq,
      ]);
      if (selectedCoreq.has(source) && selectedCoreq.has(target))
        return "scoreq";
      return "coreq";
    }
    if (ctx.effExcl.has(source) || ctx.effExcl.has(target)) return "excl";

    const hoverPre = hoverId ? new Set([hoverId, ...ctx.hAnc]) : new Set();
    const hoverFwd = hoverId ? new Set([hoverId, ...ctx.hDesc]) : new Set();
    if (hoverId && hoverPre.has(source) && hoverPre.has(target)) return "hpre";
    if (hoverId && hoverFwd.has(source) && hoverFwd.has(target)) return "hfwd";

    const activePlan = new Set([...ctx.effectiveSel, ...ctx.effectivePassed]);
    const selectedPre = new Set([...activePlan, ...ctx.selAnc]);
    const selectedFwd = new Set([...activePlan, ...ctx.selDesc]);
    if (selectedPre.has(source) && selectedPre.has(target)) return "spre";
    if (selectedFwd.has(source) && selectedFwd.has(target)) return "sfwd";

    return "normal";
  }

  const nodeMap: Record<string, GraphNode> = Object.fromEntries(
    (nodes || []).map((node) => [node.id, node]),
  );

  function render() {
    const hoverId = getHoverId();
    const previewState = getPreviewState ? getPreviewState() : null;
    const activeManualExcluded = previewState?.manualExcluded || manualExcluded;
    const activeSelected = previewState?.selected || selected;
    const activePassed = previewState?.passed || passed;
    const hiddenLevels = getHiddenLevels();
    const isHiddenLevel = (node: GraphNode) =>
      hiddenLevels.has(String(node.level));
    const isVisibleNode = (node: GraphNode) =>
      !isHiddenLevel(node) ||
      activeSelected.has(node.id) ||
      activePassed.has(node.id);
    const levelExcluded = new Set(
      (nodes || [])
        .filter(
          (node) =>
            isHiddenLevel(node) &&
            !activeSelected.has(node.id) &&
            !activePassed.has(node.id),
        )
        .map((node) => node.id),
    );
    const effExcl = graphState.computeEffectivelyExcluded(
      activeManualExcluded,
      levelExcluded,
    );
    const hoveredExcluded = Boolean(hoverId && effExcl.has(hoverId));
    const isExternal = (node) =>
      node.isExternal ||
      String(node.level) === "ext" ||
      node.frequency === "external";
    const levelKey = (node) => (isExternal(node) ? "ext" : String(node.level));
    const hAnc =
      hoverId && !hoveredExcluded
        ? graphState.getPrerequisitePathNodes(hoverId)
        : new Set<string>();
    const hCoreq =
      hoverId && !hoveredExcluded
        ? graphState.getAllCorequisites(hoverId)
        : new Set<string>();
    const hDesc =
      hoverId && !hoveredExcluded
        ? graphState.getForwardPathNodes(hoverId)
        : new Set<string>();
    const effectivePassed = new Set(
      [...activePassed].filter((id) => !effExcl.has(id)),
    );
    const effectiveSel = new Set(
      [...activeSelected].filter((id) => !effExcl.has(id)),
    );
    const activePlan = new Set([...effectiveSel, ...effectivePassed]);
    const selAnc = activePlan.size
      ? graphState.getAncestorsOfSet([...activePlan])
      : new Set<string>();
    const selCoreq = new Set<string>();
    activePlan.forEach((id) => {
      graphState
        .getAllCorequisites(id)
        .forEach((linked) => selCoreq.add(linked));
    });
    const selDesc = new Set<string>();
    if (activePlan.size) {
      activePlan.forEach((id) => {
        graphState
          .getForwardPathNodes(id)
          .forEach((descendant) => selDesc.add(descendant));
      });
    }

    const ctx: RendererContext = {
      effExcl,
      manualExcluded: activeManualExcluded,
      effectiveSel,
      effectivePassed,
      hAnc,
      hCoreq,
      hDesc,
      selAnc,
      selCoreq,
      selDesc,
    };

    const effectiveReqKind = new Map<GraphEdge, string>();
    const prereqLinksByTarget = new Map<string, GraphEdge[]>();
    linkSel.each((link) => {
      if (link.etype === "prereq") {
        const target =
          typeof link.target === "object" ? link.target.id : link.target;
        if (!prereqLinksByTarget.has(target))
          prereqLinksByTarget.set(target, []);
        prereqLinksByTarget.get(target)?.push(link);
      }
    });
    prereqLinksByTarget.forEach((links) => {
      const optionalLinks = links.filter(
        (link) => link.requirementKind === "optional",
      );
      const activeOptional = optionalLinks.filter((link) => {
        const source =
          typeof link.source === "object" ? link.source.id : link.source;
        return !effExcl.has(source);
      });
      if (activeOptional.length === 1) {
        effectiveReqKind.set(activeOptional[0], "required");
      }
    });

    if (nodeGroups) {
      nodeGroups.attr("display", (node) =>
        isVisibleNode(node) ? null : "none",
      );
      nodeGroups.each(function (node) {
        const state = nodeState(node, ctx);
        const destination =
          state === "excl-manual" || state === "excl-implied"
            ? excludedLayer
            : nodeLayer;
        if (destination && this.parentNode !== destination)
          destination.appendChild(this);
      });
    }

    circles
      .attr("fill", (node) => {
        const state = nodeState(node, ctx);
        if (state === "excl-manual") return COLORS.excl;
        if (state === "excl-implied") return COLORS.excl;
        if (state === "passed") return COLORS.passed;
        if (state === "selected") return COLORS.sel;
        if (state === "hover") return COLORS.lvl[levelKey(node)] || "#888";
        if (state === "hpre" || state === "spre")
          return "rgba(252,211,77,0.15)";
        if (state === "hcoreq" || state === "scoreq")
          return "rgba(45,212,191,0.14)";
        if (state === "hfwd") return "rgba(96,165,250,0.12)";
        if (state === "sfwd") return "rgba(56,189,248,0.14)";
        return COLORS.lvl[levelKey(node)] || "#888";
      })
      .attr("fill-opacity", (node) => {
        const state = nodeState(node, ctx);
        if (state === "hover") return 0.25;
        if (
          state === "hpre" ||
          state === "spre" ||
          state === "hfwd" ||
          state === "sfwd"
        )
          return 1;
        if (state === "passed") return 0.82;
        if (state === "selected") return 0.85;
        if (state === "excl-implied") return 0.22;
        return 0.18;
      })
      .attr("stroke", (node) => {
        const state = nodeState(node, ctx);
        if (state === "excl-manual") return COLORS.excl;
        if (state === "excl-implied") return COLORS.excl;
        if (state === "passed") return COLORS.passed;
        if (state === "selected") return COLORS.sel;
        if (state === "hover") return COLORS.lvl[levelKey(node)] || "#888";
        if (state === "hpre") return COLORS.hoverPreRequired;
        if (state === "spre") return COLORS.selPreRequired;
        if (state === "hcoreq") return COLORS.hoverCoreqRequired;
        if (state === "scoreq") return COLORS.selCoreqRequired;
        if (state === "hfwd") return COLORS.hoverFwd;
        if (state === "sfwd") return COLORS.selFwd;
        if (isExternal(node)) return COLORS.lvl.ext;
        return COLORS.lvl[levelKey(node)] || "#888";
      })
      .attr("stroke-width", (node) => {
        const state = nodeState(node, ctx);
        if (
          [
            "excl-manual",
            "selected",
            "passed",
            "hover",
            "hpre",
            "spre",
            "hcoreq",
            "scoreq",
            "hfwd",
            "sfwd",
            "excl-implied",
          ].includes(state)
        )
          return 2;
        return 1.2;
      })
      .attr("stroke-dasharray", (node) =>
        nodeState(node, ctx) === "excl-implied" ? "3 2" : null,
      )
      .attr("stroke-opacity", (node) =>
        nodeState(node, ctx) === "excl-implied" ? 0.95 : 1,
      );

    circles.classed(
      "node-unavailable",
      (node) => node.availableInSelectedYear === false,
    );

    labels
      .attr("display", (node) => (isVisibleNode(node) ? null : "none"))
      .attr("fill", (node) => {
        const state = nodeState(node, ctx);
        if (state === "excl-manual") return COLORS.excl;
        if (state === "excl-implied") return COLORS.excl;
        if (state === "passed") return COLORS.passed;
        if (state === "selected") return COLORS.sel;
        if (state === "hover") return COLORS.lvl[levelKey(node)] || "#888";
        if (state === "hpre") return COLORS.hoverPreRequired;
        if (state === "spre") return COLORS.selPreRequired;
        if (state === "hcoreq") return COLORS.hoverCoreqRequired;
        if (state === "scoreq") return COLORS.selCoreqRequired;
        if (state === "hfwd") return COLORS.hoverFwd;
        if (state === "sfwd") return COLORS.selFwd;
        if (isExternal(node)) return COLORS.lvl.ext;
        return COLORS.lvl[levelKey(node)] || "#888";
      })
      .attr("opacity", (node) =>
        nodeState(node, ctx) === "excl-implied" ? 0.9 : 1,
      )
      .attr("font-weight", (node) => {
        const state = nodeState(node, ctx);
        return [
          "selected",
          "passed",
          "hover",
          "hpre",
          "spre",
          "hcoreq",
          "scoreq",
          "hfwd",
          "sfwd",
        ].includes(state)
          ? "500"
          : "400";
      });

    linkSel
      .each(function (link) {
        const state = edgeState(link, ctx);
        const destination =
          state === "anti"
            ? antiLayer
            : state === "excl"
              ? excludedLayer
              : linkLayer;
        if (destination && this.parentNode !== destination)
          destination.appendChild(this);
      })
      .attr("display", (link) => {
        const sourceNode =
          typeof link.source === "object" ? link.source : nodeMap[link.source];
        const targetNode =
          typeof link.target === "object" ? link.target : nodeMap[link.target];
        if (
          (sourceNode && !isVisibleNode(sourceNode)) ||
          (targetNode && !isVisibleNode(targetNode))
        ) {
          return "none";
        }
        return null;
      })
      .attr("stroke", (link) => {
        const state = edgeState(link, ctx);
        const reqKind = effectiveReqKind.get(link) || link.requirementKind;
        if (state === "anti") return COLORS.anti;
        if (state === "coreq")
          return reqKind === "optional"
            ? COLORS.edgeCoreqOptional
            : COLORS.edgeCoreq;
        if (state === "hpre")
          return reqKind === "optional"
            ? COLORS.hoverPreOptional
            : COLORS.hoverPreRequired;
        if (state === "spre")
          return reqKind === "optional"
            ? COLORS.selPreOptional
            : COLORS.selPreRequired;
        if (state === "hcoreq")
          return reqKind === "optional"
            ? COLORS.hoverCoreqOptional
            : COLORS.hoverCoreqRequired;
        if (state === "scoreq")
          return reqKind === "optional"
            ? COLORS.selCoreqOptional
            : COLORS.selCoreqRequired;
        if (state === "hfwd") return COLORS.hoverFwd;
        if (state === "sfwd") return COLORS.selFwd;
        if (state === "excl") return COLORS.excl;
        return reqKind === "optional" ? COLORS.edgeOptional : COLORS.edge;
      })
      .attr("stroke-width", (link) => {
        const state = edgeState(link, ctx);
        if (
          ["hpre", "spre", "hcoreq", "scoreq", "hfwd", "sfwd"].includes(state)
        )
          return 2;
        if (state === "anti" || state === "excl") return 1.5;
        return 0.8;
      })
      .attr("stroke-opacity", (link) => {
        const state = edgeState(link, ctx);
        if (
          ["hpre", "spre", "hcoreq", "scoreq", "hfwd", "sfwd"].includes(state)
        )
          return 0.85;
        if (state === "coreq") return 0.45;
        if (state === "anti") return 0.7;
        if (state === "excl") return 0.4;
        return 0.25;
      })
      .attr("stroke-dasharray", (link) => {
        if (link.etype === "anti") return "5 3";
        if (link.etype === "coreq")
          return link.requirementKind === "optional" ? "4 4" : "2 3";
        return null;
      })
      .attr("marker-end", (link) => {
        const state = edgeState(link, ctx);
        const reqKind = effectiveReqKind.get(link) || link.requirementKind;
        if (state === "anti") return "url(#m-anti)";
        if (state === "coreq")
          return reqKind === "optional"
            ? "url(#m-coreq-optional)"
            : "url(#m-coreq-required)";
        if (state === "hpre")
          return reqKind === "optional"
            ? "url(#m-hover-pre-optional)"
            : "url(#m-hover-pre-required)";
        if (state === "spre")
          return reqKind === "optional"
            ? "url(#m-sel-pre-optional)"
            : "url(#m-sel-pre-required)";
        if (state === "hcoreq")
          return reqKind === "optional"
            ? "url(#m-hover-coreq-optional)"
            : "url(#m-hover-coreq-required)";
        if (state === "scoreq")
          return reqKind === "optional"
            ? "url(#m-sel-coreq-optional)"
            : "url(#m-sel-coreq-required)";
        if (state === "hfwd") return "url(#m-hover-fwd)";
        if (state === "sfwd") return "url(#m-sel-fwd)";
        if (state === "excl") return "url(#m-excl)";
        return "url(#m-edge)";
      });
  }

  return { render };
}
