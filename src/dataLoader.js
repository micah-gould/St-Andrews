export async function listCatalogs() {
  const response = await fetch('/api/catalogs');
  if (!response.ok) {
    throw new Error(`Failed to load catalogs (${response.status})`);
  }
  return response.json();
}

export async function loadGraphData(catalogId) {
  const response = await fetch(`/api/modules?catalog=${encodeURIComponent(catalogId)}`);
  if (!response.ok) {
    throw new Error(`Failed to load module data (${response.status})`);
  }

  const payload = await response.json();
  return {
    catalog: payload.catalog,
    nodes: payload.nodes,
    prereqRules: payload.prereqRules,
    edges: payload.edges,
  };
}
