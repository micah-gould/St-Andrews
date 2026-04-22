export function createUiState(nodes) {
  let hoverId = null;
  let activeNodeId = null;
  const manualExcluded = new Set();
  const selected = new Set();

  function clearAll() {
    manualExcluded.clear();
    selected.clear();
    activeNodeId = null;
  }

  function replaceState(snapshot = {}) {
    manualExcluded.clear();
    selected.clear();
    (snapshot.excluded || []).forEach((id) => manualExcluded.add(id));
    (snapshot.selected || []).forEach((id) => selected.add(id));
    activeNodeId = null;
  }

  function updateStatus(graphState) {
    const effExcl = graphState.computeEffectivelyExcluded(manualExcluded);
    const rows = [];

    if (selected.size) {
      const names = [...selected].map((id) => {
        const node = nodes.find((candidate) => candidate.id === id);
        return `${id} <em>${node ? node.name : ''}</em>`;
      }).join(', ');
      rows.push(`
        <div class="status-row">
          <span class="status-label status-sel">Included</span>
          <span class="status-value status-sel">${names}</span>
        </div>
      `);
    }

    if (manualExcluded.size) {
      const names = [...manualExcluded].map((id) => {
        const node = nodes.find((candidate) => candidate.id === id);
        return `${id} <em>${node ? node.name : ''}</em>`;
      }).join(', ');
      rows.push(`
        <div class="status-row">
          <span class="status-label status-excl">Excluded</span>
          <span class="status-value status-excl">${names}</span>
        </div>
      `);
    }

    const implied = [...effExcl].filter((id) => !manualExcluded.has(id));
    if (implied.length) {
      rows.push(`
        <div class="status-row status-row--wrap">
          <span class="status-label status-block">Implicitly excluded</span>
          <span class="status-value status-block">${implied.join(', ')}</span>
        </div>
      `);
    }

    const status = document.getElementById('status-text');
    if (!rows.length) {
      status.innerHTML = '<div class="status-row status-row--single"><span class="status-empty">Hover a node to explore its prerequisite chain, or click a node to pin its details.</span></div>';
      return;
    }

    status.innerHTML = rows.join('');
  }

  return {
    manualExcluded,
    selected,
    clearAll,
    updateStatus,
    replaceState,
    getHoverId: () => hoverId,
    getActiveNodeId: () => activeNodeId,
    setHoverId: (id) => {
      hoverId = id;
    },
    setActiveNodeId: (id) => {
      activeNodeId = id;
    },
  };
}
