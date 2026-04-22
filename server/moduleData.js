import { catalogs } from './catalogs/index.js';

export function listCatalogs() {
  return catalogs.map((catalog) => ({ id: catalog.id, name: catalog.name }));
}

export function getCatalog(id) {
  return catalogs.find((catalog) => catalog.id === id) || catalogs[0];
}

export function buildEdges(catalog) {
  const edges = [];
  Object.entries(catalog.prereqRules).forEach(([target, rules]) => {
    rules.forEach((rule) => {
      rule.sources.forEach((source) => {
        edges.push({ source, target, ruleType: rule.type, ruleGroup: rule.sources, etype: 'prereq' });
      });
    });
  });

  (catalog.antiRequirements || []).forEach((edge) => {
    edges.push({ ...edge, etype: 'anti' });
  });

  return edges;
}
