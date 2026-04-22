export function createGraphState(nodes, edges, prereqRules) {
  const prereqsFor = {};
  const prereqOf = {};

  nodes.forEach((node) => {
    prereqsFor[node.id] = new Set();
    prereqOf[node.id] = new Set();
  });

  edges.forEach((edge) => {
    if (edge.etype === 'prereq') {
      prereqsFor[edge.target].add(edge.source);
      prereqOf[edge.source].add(edge.target);
    }
  });

  const topo = topoSort(nodes, edges, prereqOf);

  function computeEffectivelyExcluded(manualExcluded) {
    const eff = new Set(manualExcluded);
    for (const id of topo) {
      if (eff.has(id)) continue;
      const rules = prereqRules[id];
      if (!rules) continue;
      const blocked = rules.some((rule) => {
        if (rule.type === 'all') return rule.sources.some((source) => eff.has(source));
        return rule.sources.every((source) => eff.has(source));
      });
      if (blocked) eff.add(id);
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

  return {
    computeEffectivelyExcluded,
    getAllAncestors,
    getAllDescendants,
    getAncestorsOfSet,
    getDescendantsOfSet,
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
