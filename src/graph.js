export function createGraphState(nodes, edges, prereqRules) {
  const nodeMap = Object.fromEntries(nodes.map((node) => [node.id, node]));
  const prereqsFor = {};
  const prereqOf = {};
  const coreqsFor = {};
  const coreqOf = {};
  const antiFor = {};
  const antiOf = {};
  const prereqEdgeKinds = new Map();
  const coreqEdgeKinds = new Map();

  nodes.forEach((node) => {
    prereqsFor[node.id] = new Set();
    prereqOf[node.id] = new Set();
    coreqsFor[node.id] = new Set();
    coreqOf[node.id] = new Set();
    antiFor[node.id] = new Set();
    antiOf[node.id] = new Set();
  });

  edges.forEach((edge) => {
    if (edge.etype === 'prereq') {
      prereqsFor[edge.target]?.add(edge.source);
      prereqOf[edge.source]?.add(edge.target);
      prereqEdgeKinds.set(`${edge.source}->${edge.target}`, edge.requirementKind || 'required');
      return;
    }

    if (edge.etype === 'coreq') {
      coreqsFor[edge.target]?.add(edge.source);
      coreqOf[edge.source]?.add(edge.target);
      coreqEdgeKinds.set(`${edge.source}->${edge.target}`, edge.requirementKind || 'required');
      return;
    }

    if (edge.etype === 'anti') {
      antiFor[edge.target]?.add(edge.source);
      antiOf[edge.source]?.add(edge.target);
    }
  });

  const topo = topoSort(nodes, edges, prereqOf);

  function computeEffectivelyExcluded(manualExcluded) {
    const eff = new Set(manualExcluded);
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

  function getAllAncestors(id) {
    const visited = new Set();
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

  function getAllDescendants(id) {
    const visited = new Set();
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

  function getAncestorsOfSet(ids) {
    const all = new Set();
    ids.forEach((id) => getAllAncestors(id).forEach((ancestor) => all.add(ancestor)));
    return all;
  }

  function getDescendantsOfSet(ids) {
    const all = new Set();
    ids.forEach((id) => getAllDescendants(id).forEach((descendant) => all.add(descendant)));
    return all;
  }

  function getAllAntiLinks(id) {
    const linked = new Set();
    (antiFor[id] || new Set()).forEach((source) => linked.add(source));
    (antiOf[id] || new Set()).forEach((target) => linked.add(target));
    return linked;
  }

  function getForwardPathStarts(id) {
    const starts = new Set([id]);
    getAllAntiLinks(id).forEach((linkedId) => starts.add(linkedId));
    return starts;
  }

  function getAllCorequisites(id) {
    const linked = new Set();
    (coreqsFor[id] || new Set()).forEach((source) => linked.add(source));
    (coreqOf[id] || new Set()).forEach((target) => linked.add(target));
    return linked;
  }

  function getForwardPathNodes(id) {
    const nodesInPath = new Set();
    getForwardPathStarts(id).forEach((startId) => {
      getAllDescendants(startId).forEach((descendant) => nodesInPath.add(descendant));
    });
    nodesInPath.delete(id);
    return nodesInPath;
  }

  function getPrerequisitePathNodes(id) {
    return getAllAncestors(id);
  }

  function getSimplePathsFromRoots(targetId, maxCount = 3) {
    const paths = [];
    const walk = (currentId, trail) => {
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

  function getCorequisitePaths(id) {
    return [...getAllCorequisites(id)].map((linkedId) => [linkedId, id]);
  }

  function getSimplePathsForward(startId, maxCount = 3) {
    const paths = [];
    const walk = (currentId, trail) => {
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

  function getEdgeRequirementKind(source, target) {
    return prereqEdgeKinds.get(`${source}->${target}`) || 'required';
  }

  function getCoreqRequirementKind(source, target) {
    return coreqEdgeKinds.get(`${source}->${target}`) || 'required';
  }

  function areRulesBlocked(rules, excluded) {
    if (!rules) return false;

    return rules.some((rule) => {
      if (rule.type === 'all') {
        return rule.sources.some((source) => excluded.has(source));
      }

      if (rule.type === 'one') {
        return rule.sources.length > 0 && rule.sources.every((source) => excluded.has(source));
      }

      return false;
    });
  }

  function isExpressionBlocked(expression, excluded) {
    if (!expression) return false;
    if (expression.type === 'module') return excluded.has(expression.code);
    if (expression.type === 'and') return expression.children.some((child) => isExpressionBlocked(child, excluded));
    if (expression.type === 'or') return expression.children.every((child) => isExpressionBlocked(child, excluded));
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

function topoSort(nodes, edges, prereqOf) {
  const indegree = {};
  nodes.forEach((node) => {
    indegree[node.id] = 0;
  });

  edges.forEach((edge) => {
    if (edge.etype === 'prereq') {
      indegree[edge.target] = (indegree[edge.target] || 0) + 1;
    }
  });

  const queue = nodes.map((node) => node.id).filter((id) => !indegree[id]);
  const order = [];

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
