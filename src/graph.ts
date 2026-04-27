import type {
  GraphEdge,
  GraphNode,
  PrereqRule,
  RelationshipExpression,
} from "./types/graph.types";
import type { GraphState } from "./types/runtime.types";

export function createGraphState(
  nodes: GraphNode[],
  edges: GraphEdge[],
  prereqRules: Record<string, PrereqRule[]>,
): GraphState {
  const nodeMap: Record<string, GraphNode> = Object.fromEntries(
    nodes.map((node) => [node.id, node]),
  );
  const prereqsFor: Record<string, Set<string>> = {};
  const prereqOf: Record<string, Set<string>> = {};
  const coreqsFor: Record<string, Set<string>> = {};
  const coreqOf: Record<string, Set<string>> = {};
  const antiFor: Record<string, Set<string>> = {};
  const antiOf: Record<string, Set<string>> = {};
  const prereqEdgeKinds = new Map<string, string>();
  const coreqEdgeKinds = new Map<string, string>();

  nodes.forEach((node) => {
    prereqsFor[node.id] = new Set();
    prereqOf[node.id] = new Set();
    coreqsFor[node.id] = new Set();
    coreqOf[node.id] = new Set();
    antiFor[node.id] = new Set();
    antiOf[node.id] = new Set();
  });

  edges.forEach((edge) => {
    const source =
      typeof edge.source === "object" ? edge.source.id : edge.source;
    const target =
      typeof edge.target === "object" ? edge.target.id : edge.target;

    if (edge.etype === "prereq") {
      prereqsFor[target]?.add(source);
      prereqOf[source]?.add(target);
      prereqEdgeKinds.set(
        `${source}->${target}`,
        edge.requirementKind || "required",
      );
      return;
    }

    if (edge.etype === "coreq") {
      coreqsFor[target]?.add(source);
      coreqOf[source]?.add(target);
      coreqEdgeKinds.set(
        `${source}->${target}`,
        edge.requirementKind || "required",
      );
      return;
    }

    if (edge.etype === "anti") {
      antiFor[target]?.add(source);
      antiOf[source]?.add(target);
    }
  });

  const topo = topoSort(nodes, edges, prereqOf);

  function computeEffectivelyExcluded(
    manualExcluded: Set<string>,
    levelExcluded = new Set<string>(),
  ) {
    const eff = new Set([...manualExcluded, ...levelExcluded]);
    let changed = true;

    while (changed) {
      changed = false;

      for (const id of topo) {
        if (eff.has(id)) continue;
        const node = nodeMap[id];

        const prereqBlocked = node?.prerequisiteExpression
          ? isExpressionBlocked(node.prerequisiteExpression, eff)
          : areRulesBlocked(prereqRules[id], eff);

        const coreqBlocked = node?.coRequisiteExpression
          ? isExpressionBlocked(node.coRequisiteExpression, eff)
          : false;

        if (prereqBlocked || coreqBlocked) {
          eff.add(id);
          changed = true;
        }
      }
    }

    return eff;
  }

  function getAllAncestors(id: string) {
    const visited = new Set<string>();
    const queue = [id];
    while (queue.length) {
      const current = queue.pop();
      (prereqsFor[current] || new Set()).forEach((prereq) => {
        if (!visited.has(prereq)) {
          visited.add(prereq);
          queue.push(prereq);
        }
      });
    }
    return visited;
  }

  function getAllDescendants(id: string) {
    const visited = new Set<string>();
    const queue = [id];
    while (queue.length) {
      const current = queue.pop();
      (prereqOf[current] || new Set()).forEach((dependent) => {
        if (!visited.has(dependent)) {
          visited.add(dependent);
          queue.push(dependent);
        }
      });
    }
    return visited;
  }

  function getAncestorsOfSet(ids: string[]) {
    const all = new Set<string>();
    ids.forEach((id) =>
      getAllAncestors(id).forEach((ancestor) => all.add(ancestor)),
    );
    return all;
  }

  function getDescendantsOfSet(ids: string[]) {
    const all = new Set<string>();
    ids.forEach((id) =>
      getAllDescendants(id).forEach((descendant) => all.add(descendant)),
    );
    return all;
  }

  function getAllAntiLinks(id: string) {
    const linked = new Set<string>();
    (antiFor[id] || new Set()).forEach((source) => linked.add(source));
    (antiOf[id] || new Set()).forEach((target) => linked.add(target));
    return linked;
  }

  function getForwardPathStarts(id: string) {
    const starts = new Set([id]);
    getAllAntiLinks(id).forEach((linkedId) => starts.add(linkedId));
    return starts;
  }

  function getAllCorequisites(id: string) {
    const linked = new Set<string>();
    (coreqsFor[id] || new Set()).forEach((source) => linked.add(source));
    (coreqOf[id] || new Set()).forEach((target) => linked.add(target));
    return linked;
  }

  function getForwardPathNodes(id: string) {
    const nodesInPath = new Set<string>();
    getForwardPathStarts(id).forEach((startId) => {
      getAllDescendants(startId).forEach((descendant) =>
        nodesInPath.add(descendant),
      );
    });
    nodesInPath.delete(id);
    return nodesInPath;
  }

  function getPrerequisitePathNodes(id: string) {
    return getAllAncestors(id);
  }

  function getSimplePathsFromRoots(targetId: string, maxCount = 3) {
    const paths: string[][] = [];
    const walk = (currentId: string, trail: string[]) => {
      if (paths.length >= maxCount) return;
      const prereqs = [...(prereqsFor[currentId] || [])];
      if (!prereqs.length) {
        paths.push([...trail].reverse());
        return;
      }

      prereqs.forEach((parentId) => {
        if (trail.includes(parentId) || paths.length >= maxCount) return;
        walk(parentId, [...trail, parentId]);
      });
    };

    walk(targetId, [targetId]);
    return paths;
  }

  function getCorequisitePaths(id: string) {
    return [...getAllCorequisites(id)].map((linkedId) => [linkedId, id]);
  }

  function getSimplePathsForward(startId: string, maxCount = 3) {
    const paths: string[][] = [];
    const walk = (currentId: string, trail: string[]) => {
      if (paths.length >= maxCount) return;
      const dependents = [...(prereqOf[currentId] || [])];
      if (!dependents.length) {
        if (trail.length > 1) paths.push([...trail]);
        return;
      }

      dependents.forEach((childId) => {
        if (trail.includes(childId) || paths.length >= maxCount) return;
        walk(childId, [...trail, childId]);
      });
    };

    walk(startId, [startId]);
    return paths;
  }

  function getEdgeRequirementKind(source: string, target: string) {
    return prereqEdgeKinds.get(`${source}->${target}`) || "required";
  }

  function getCoreqRequirementKind(source: string, target: string) {
    return coreqEdgeKinds.get(`${source}->${target}`) || "required";
  }

  function areRulesBlocked(
    rules: PrereqRule[] | undefined,
    excluded: Set<string>,
  ) {
    if (!rules) return false;

    return rules.some((rule) => {
      if (rule.type === "all") {
        return rule.sources.some((source) => excluded.has(source));
      }

      if (rule.type === "one") {
        return (
          rule.sources.length > 0 &&
          rule.sources.every((source) => excluded.has(source))
        );
      }

      return false;
    });
  }

  function isExpressionBlocked(
    expression: RelationshipExpression | null | undefined,
    excluded: Set<string>,
  ) {
    if (!expression) return false;
    if (expression.type === "module")
      return expression.code ? excluded.has(expression.code) : false;
    if (expression.type === "and")
      return (expression.children || []).some((child) =>
        isExpressionBlocked(child, excluded),
      );
    if (expression.type === "or")
      return (expression.children || []).every((child) =>
        isExpressionBlocked(child, excluded),
      );
    return false;
  }

  return {
    computeEffectivelyExcluded,
    getAllAncestors,
    getAllDescendants,
    getAncestorsOfSet,
    getDescendantsOfSet,
    getAllAntiLinks,
    getAllCorequisites,
    getForwardPathStarts,
    getForwardPathNodes,
    getPrerequisitePathNodes,
    getSimplePathsFromRoots,
    getCorequisitePaths,
    getSimplePathsForward,
    getEdgeRequirementKind,
    getCoreqRequirementKind,
  };
}

function topoSort(
  nodes: GraphNode[],
  edges: GraphEdge[],
  prereqOf: Record<string, Set<string>>,
) {
  const indegree: Record<string, number> = {};
  nodes.forEach((node) => {
    indegree[node.id] = 0;
  });

  edges.forEach((edge) => {
    if (edge.etype === "prereq") {
      const target =
        typeof edge.target === "object" ? edge.target.id : edge.target;
      indegree[target] = (indegree[target] || 0) + 1;
    }
  });

  const queue = nodes.map((node) => node.id).filter((id) => !indegree[id]);
  const order: string[] = [];

  while (queue.length) {
    const nodeId = queue.shift();
    order.push(nodeId);
    (prereqOf[nodeId] || new Set()).forEach((child) => {
      indegree[child] -= 1;
      if (indegree[child] === 0) queue.push(child);
    });
  }

  return order;
}
