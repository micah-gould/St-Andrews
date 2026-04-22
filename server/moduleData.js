import { describeExpression, extractModuleCodes } from './catalogs/relationship-parser.js';
import { catalogs } from './catalogs/index.js';

const catalogById = new Map(catalogs.map((catalog) => [catalog.id, catalog]));
const nodeIndex = buildNodeIndex(catalogs);

export function listCatalogs() {
  return catalogs.map((catalog) => ({ id: catalog.id, name: catalog.name, years: catalog.years || [] }));
}

export function getCatalog(id) {
  return catalogById.get(id) || catalogs[0];
}

export function getGraphData(catalog, year) {
  const selectedYear = year && (catalog.years || []).includes(year) ? year : (catalog.years || [])[0] || null;
  const graph = buildCatalogGraph(catalog, selectedYear);

  return {
    selectedYear,
    nodes: graph.nodes,
    edges: graph.edges,
    prereqRules: graph.prereqRules,
  };
}

function buildCatalogGraph(catalog, selectedYear) {
  const catalogNodeIds = new Set((catalog.nodes || []).map((node) => node.id));
  const graphNodeIds = new Set(catalogNodeIds);
  const queue = [...catalogNodeIds];

  while (queue.length) {
    const nodeId = queue.shift();
    const node = nodeIndex.get(nodeId);
    if (!node) continue;

    getReferencedCodes(node).forEach((refId) => {
      if (graphNodeIds.has(refId)) return;
      if (!nodeIndex.has(refId)) return;
      graphNodeIds.add(refId);
      queue.push(refId);
    });
  }

  const nodeIds = [...graphNodeIds];
  const nodes = nodeIds
    .map((id) => buildNodeForYear(nodeIndex.get(id), selectedYear, catalogNodeIds.has(id)))
    .filter(Boolean)
    .sort(compareNodes);

  const edgeMap = new Map();
  const edges = [];
  const prereqRules = {};

  nodeIds.forEach((id) => {
    const node = nodeIndex.get(id);
    if (!node) return;

    if (node.prereqRules?.length) {
      prereqRules[id] = node.prereqRules;
      node.prereqRules.forEach((rule) => {
        rule.sources.forEach((source) => {
          if (!graphNodeIds.has(source)) return;
          pushEdge(edgeMap, edges, {
            source,
            target: id,
            ruleType: rule.type,
            ruleGroup: rule.sources,
            requirementKind: rule.type === 'all' ? 'required' : 'optional',
            etype: 'prereq',
          });
        });
      });
    }

    extractExpressionEdges(node.prerequisiteExpression).forEach(({ source, requirementKind }) => {
      if (!graphNodeIds.has(source)) return;
      pushEdge(edgeMap, edges, {
        source,
        target: id,
        ruleType: 'parsed',
        ruleGroup: [source],
        requirementKind,
        etype: 'prereq',
      });
    });

    extractModuleCodes(node.antiRequisiteExpression).forEach((source) => {
      if (!graphNodeIds.has(source)) return;
      pushEdge(edgeMap, edges, { source, target: id, etype: 'anti' });
    });

    (node.antiRequirements || []).forEach((edge) => {
      if (!graphNodeIds.has(edge.source) || !graphNodeIds.has(edge.target)) return;
      pushEdge(edgeMap, edges, { ...edge, etype: 'anti' });
    });
  });

  return { nodes, edges, prereqRules };
}

function buildNodeIndex(allCatalogs) {
  const index = new Map();

  allCatalogs.forEach((catalog) => {
    (catalog.nodes || []).forEach((node) => {
      const existing = index.get(node.id);
      const merged = mergeNode(existing, node, catalog);
      index.set(node.id, merged);
    });

    Object.entries(catalog.prereqRules || {}).forEach(([target, rules]) => {
      const existing = index.get(target) || createPlaceholderNode(target);
      existing.prereqRules = dedupeRules([...(existing.prereqRules || []), ...rules]);
      index.set(target, existing);

      rules.forEach((rule) => {
        rule.sources.forEach((source) => {
          if (index.has(source)) return;
          index.set(source, createPlaceholderNode(source));
        });
      });
    });

    (catalog.antiRequirements || []).forEach((edge) => {
      const source = index.get(edge.source) || createPlaceholderNode(edge.source);
      source.antiRequirements = [...(source.antiRequirements || []), edge];
      index.set(edge.source, source);
      if (!index.has(edge.target)) index.set(edge.target, createPlaceholderNode(edge.target));
    });
  });

  return index;
}

function mergeNode(existing, node, catalog) {
  if (!existing) {
    return {
      ...node,
      semesters: [...(node.semesters || [])],
      years: [...(node.years || [])],
      availability: { ...(node.availability || {}) },
      catalogs: [catalog.id],
      primaryCatalogId: catalog.id,
      primaryCatalogName: catalog.name,
      isExternal: node.level === 'ext',
      prereqRules: [],
      antiRequirements: [],
    };
  }

  return {
    ...existing,
    ...node,
    name: chooseName(existing.name, node.name, node.id),
    level: chooseLevel(existing.level, node.level),
    credits: node.credits ?? existing.credits ?? null,
    summary: node.summary || existing.summary || '',
    description: node.description || existing.description || '',
    semesters: dedupeStrings([...(existing.semesters || []), ...(node.semesters || [])]),
    years: dedupeStrings([...(existing.years || []), ...(node.years || [])]).sort(),
    availability: { ...(existing.availability || {}), ...(node.availability || {}) },
    prerequisiteExpression: existing.prerequisiteExpression || node.prerequisiteExpression || null,
    antiRequisiteExpression: existing.antiRequisiteExpression || node.antiRequisiteExpression || null,
    prerequisitesText: existing.prerequisitesText || node.prerequisitesText || '',
    antiRequisitesText: existing.antiRequisitesText || node.antiRequisitesText || '',
    catalogs: dedupeStrings([...(existing.catalogs || []), catalog.id]),
    primaryCatalogId: existing.primaryCatalogId || catalog.id,
    primaryCatalogName: existing.primaryCatalogName || catalog.name,
    isExternal: existing.isExternal && node.level === 'ext',
    prereqRules: existing.prereqRules || [],
    antiRequirements: existing.antiRequirements || [],
  };
}

function createPlaceholderNode(id) {
  return {
    id,
    name: id,
    level: 'ext',
    credits: null,
    summary: '',
    description: '',
    semesters: [],
    years: [],
    availability: {},
    frequency: 'external',
    prerequisitesText: '',
    antiRequisitesText: '',
    prerequisiteExpression: null,
    antiRequisiteExpression: null,
    catalogs: [],
    primaryCatalogId: null,
    primaryCatalogName: 'External prerequisite',
    isExternal: true,
    prereqRules: [],
    antiRequirements: [],
  };
}

function buildNodeForYear(node, selectedYear, isInSelectedCatalog) {
  if (!node) return null;
  const years = [...(node.years || [])].sort();
  const semesters = [...(node.semesters || [])];
  const availability = node.availability || {};
  const availableInSelectedYear = selectedYear ? availability[selectedYear] !== false : true;
  const semesterAvailability = Object.fromEntries(
    semesters.map((semester) => [semester, selectedYear ? availability[selectedYear] !== false : true]),
  );

  return {
    ...node,
    years,
    semesters,
    availableInSelectedYear,
    semesterAvailability,
    selectedYear,
    isInSelectedCatalog,
    prerequisiteSummary: node.prerequisiteExpression ? describeExpression(node.prerequisiteExpression) : node.prerequisitesText,
    antiRequisiteSummary: node.antiRequisiteExpression ? describeExpression(node.antiRequisiteExpression) : node.antiRequisitesText,
  };
}

function getReferencedCodes(node) {
  const refs = new Set();

  extractModuleCodes(node?.prerequisiteExpression).forEach((code) => refs.add(code));
  extractModuleCodes(node?.antiRequisiteExpression).forEach((code) => refs.add(code));

  (node?.prereqRules || []).forEach((rule) => {
    rule.sources.forEach((source) => refs.add(source));
  });

  (node?.antiRequirements || []).forEach((edge) => {
    refs.add(edge.source);
    refs.add(edge.target);
  });

  return refs;
}

function extractExpressionEdges(expression, requirementKind = 'required', seen = new Map()) {
  if (!expression) return [...seen.values()];

  if (expression.type === 'module') {
    const existing = seen.get(expression.code);
    const nextKind = mergeRequirementKind(existing?.requirementKind, requirementKind);
    seen.set(expression.code, { source: expression.code, requirementKind: nextKind });
    return [...seen.values()];
  }

  if (expression.type === 'and') {
    expression.children.forEach((child) => extractExpressionEdges(child, requirementKind, seen));
    return [...seen.values()];
  }

  if (expression.type === 'or') {
    expression.children.forEach((child) => extractExpressionEdges(child, 'optional', seen));
  }

  return [...seen.values()];
}

function pushEdge(edgeMap, edges, edge) {
  const key = `${edge.etype}:${edge.source}->${edge.target}`;
  const existing = edgeMap.get(key);
  if (existing) {
    if (existing.etype === 'prereq' && edge.etype === 'prereq') {
      existing.requirementKind = mergeRequirementKind(existing.requirementKind, edge.requirementKind);
      if (existing.ruleType === 'parsed' && edge.ruleType !== 'parsed') {
        existing.ruleType = edge.ruleType;
        existing.ruleGroup = edge.ruleGroup;
      }
    }
    return;
  }

  edgeMap.set(key, edge);
  edges.push(edge);
}

function mergeRequirementKind(left = 'optional', right = 'optional') {
  return left === 'required' || right === 'required' ? 'required' : 'optional';
}

function dedupeRules(rules) {
  const seen = new Set();
  return rules.filter((rule) => {
    const key = `${rule.type}:${[...rule.sources].sort().join(',')}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function dedupeStrings(values) {
  return [...new Set(values.filter(Boolean))];
}

function chooseName(existingName, incomingName, id) {
  if (existingName && existingName !== id) return existingName;
  return incomingName || existingName || id;
}

function chooseLevel(existingLevel, incomingLevel) {
  if (incomingLevel && incomingLevel !== 'ext') return incomingLevel;
  return existingLevel || incomingLevel || 'ext';
}

function compareNodes(a, b) {
  const rankA = getLevelRank(a.level);
  const rankB = getLevelRank(b.level);
  if (rankA !== rankB) return rankA - rankB;
  return a.id.localeCompare(b.id);
}

function getLevelRank(level) {
  if (level === 'ext') return 9999;
  if (typeof level === 'number') return level;
  return 9998;
}
