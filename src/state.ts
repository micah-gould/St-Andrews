import type { GraphNode } from "./types/graph.types";
import type { GraphState, UiState } from "./types/runtime.types";
import type { SavedStateSlice } from "./types/saved-state.types";

export function createUiState(nodes: GraphNode[]): UiState {
  let hoverId: string | null = null;
  let activeNodeId: string | null = null;
  const manualExcluded = new Set<string>();
  const selected = new Set<string>();
  const passed = new Set<string>();

  function clearAll() {
    manualExcluded.clear();
    selected.clear();
    passed.clear();
    activeNodeId = null;
  }

  function replaceState(snapshot: Partial<SavedStateSlice> = {}) {
    manualExcluded.clear();
    selected.clear();
    passed.clear();
    (snapshot.excluded || []).forEach((id) => manualExcluded.add(id));
    (snapshot.selected || []).forEach((id) => selected.add(id));
    (snapshot.passed || []).forEach((id) => passed.add(id));
    activeNodeId = null;
  }

  function getStatusMarkup(
    graphState: GraphState,
    levelExcluded = new Set<string>(),
  ) {
    const effExcl = graphState.computeEffectivelyExcluded(
      manualExcluded,
      levelExcluded,
    );
    const rows: string[] = [];

    if (selected.size) {
      const names = [...selected]
        .map((id) => {
          const node = nodes.find((candidate) => candidate.id === id);
          return `${id} <em>${node ? node.name : ""}</em>`;
        })
        .join(", ");
      rows.push(`
        <div class="status-row">
          <span class="status-label status-sel">Included</span>
          <span class="status-value status-sel">${names}</span>
        </div>
      `);
    }

    if (passed.size) {
      const names = [...passed]
        .map((id) => {
          const node = nodes.find((candidate) => candidate.id === id);
          return `${id} <em>${node ? node.name : ""}</em>`;
        })
        .join(", ");
      rows.push(`
        <div class="status-row">
          <span class="status-label status-passed">Passed</span>
          <span class="status-value status-passed">${names}</span>
        </div>
      `);
    }

    if (manualExcluded.size) {
      const names = [...manualExcluded]
        .map((id) => {
          const node = nodes.find((candidate) => candidate.id === id);
          return `${id} <em>${node ? node.name : ""}</em>`;
        })
        .join(", ");
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
          <span class="status-value status-block">${implied.join(", ")}</span>
        </div>
      `);
    }

    if (!rows.length) {
      return '<div class="status-row status-row--single"><span class="status-empty">Hover a node to explore its prerequisite chain, or click a node to pin its details.</span></div>';
    }

    return rows.join("");
  }

  return {
    manualExcluded,
    selected,
    passed,
    clearAll,
    getStatusMarkup,
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
