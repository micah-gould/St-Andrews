const API_BASE = window.location.protocol === 'file:' ? 'http://localhost:5175' : '';

export async function listCatalogs() {
  const response = await fetch(`${API_BASE}/api/catalogs`);
  if (!response.ok) {
    throw new Error(`Failed to load catalogs (${response.status})`);
  }
  return response.json();
}

export async function loadGraphData(catalogId, year) {
  const params = new URLSearchParams({ catalog: catalogId });
  if (year) params.set('year', year);
  const response = await fetch(`${API_BASE}/api/modules?${params.toString()}`);
  if (!response.ok) {
    throw new Error(`Failed to load module data (${response.status})`);
  }

  const payload = await response.json();
  return {
    catalog: payload.catalog,
    selectedYear: payload.selectedYear,
    nodes: payload.nodes,
    prereqRules: payload.prereqRules,
    edges: payload.edges,
  };
}
