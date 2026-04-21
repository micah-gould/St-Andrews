// js/graph.js — Graph topology utilities

// Build lookup maps: prereqsFor[id] = Set of direct prerequisites
//                    prereqOf[id]   = Set of modules that need this one
const prereqsFor = {};
const prereqOf   = {};
NODES.forEach(n => { prereqsFor[n.id] = new Set(); prereqOf[n.id] = new Set(); });
EDGES.forEach(e => {
  if (e.etype === 'prereq') {
    prereqsFor[e.target].add(e.source);
    prereqOf[e.source].add(e.target);
  }
});

// Topological sort (Kahn's algorithm) — used for propagating exclusions
function topoSort() {
  const indeg = {};
  NODES.forEach(n => indeg[n.id] = 0);
  EDGES.forEach(e => { if (e.etype === 'prereq') indeg[e.target] = (indeg[e.target] || 0) + 1; });

  const q = NODES.map(n => n.id).filter(id => !indeg[id]);
  const order = [];
  while (q.length) {
    const n = q.shift();
    order.push(n);
    (prereqOf[n] || new Set()).forEach(c => { if (--indeg[c] === 0) q.push(c); });
  }
  return order;
}
const TOPO = topoSort();

// Returns the full set of effectively-excluded nodes given a manual exclusion set.
// A module is effectively excluded if any rule that would satisfy its prereqs is blocked.
function computeEffectivelyExcluded(manualExcluded) {
  const eff = new Set(manualExcluded);
  for (const id of TOPO) {
    if (eff.has(id)) continue;
    const rules = PREREQ_RULES[id];
    if (!rules) continue;
    const blocked = rules.some(rule => {
      if (rule.type === 'all') return rule.sources.some(s => eff.has(s));
      else return rule.sources.every(s => eff.has(s));
    });
    if (blocked) eff.add(id);
  }
  return eff;
}

// BFS upward (prerequisites)
function getAllAncestors(id) {
  const vis = new Set(), q = [id];
  while (q.length) {
    const cur = q.pop();
    (prereqsFor[cur] || new Set()).forEach(p => { if (!vis.has(p)) { vis.add(p); q.push(p); } });
  }
  return vis;
}

// BFS downward (unlocks)
function getAllDescendants(id) {
  const vis = new Set(), q = [id];
  while (q.length) {
    const cur = q.pop();
    (prereqOf[cur] || new Set()).forEach(c => { if (!vis.has(c)) { vis.add(c); q.push(c); } });
  }
  return vis;
}

function getAncestorsOfSet(ids) {
  const s = new Set();
  ids.forEach(id => getAllAncestors(id).forEach(a => s.add(a)));
  return s;
}

function getDescendantsOfSet(ids) {
  const s = new Set();
  ids.forEach(id => getAllDescendants(id).forEach(d => s.add(d)));
  return s;
}
