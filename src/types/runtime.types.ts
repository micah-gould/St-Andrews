import type { Simulation, Selection } from "d3";
import type {
  GraphDataResponse,
  GraphEdge,
  GraphNode,
  ModuleSearchResult,
  PrereqRule,
} from "./graph.types";
import type { SavedStateRecord, SavedStateSlice } from "./saved-state.types";

export type PreviewState = {
  manualExcluded: Set<string>;
  selected: Set<string>;
  passed: Set<string>;
} | null;

export type GraphSnapshot = SavedStateSlice & {
  catalogId: string;
  year: string | null;
  blocked: string[];
};

export type FeedbackAction = {
  label: string;
  onClick: () => Promise<void> | void;
};

export type GraphRuntime = {
  catalog: GraphDataResponse["catalog"];
  uiState: UiState;
  graphState: GraphState;
  syncUi: () => void;
  setPreviewState: (snapshot?: SavedStateSlice | null) => void;
  setSearchQuery: (query: string) => void;
  setSearchHover: (nodeId: string | null) => void;
  activateNodeById: (nodeId: string) => boolean;
  setHiddenLevels: (levels: Set<string>) => void;
  clearAll: () => void;
  destroy: () => void;
  snapshot: () => GraphSnapshot;
};

export type AppState = {
  catalogs: GraphDataResponse["catalog"][];
  currentCatalogId: string | null;
  currentYear: string | null;
  settingsCache: SavedStateRecord[];
  selectedPlanId: string;
  settingsName: string;
  searchQuery: string;
  searchResults: ModuleSearchResult[];
  pendingSearchFocusNodeId: string | null;
  feedbackMarkup: string;
  feedbackActions: FeedbackAction[];
  statusMarkup: string;
  loadedSetting: SavedStateRecord | null;
  sharedSettingId: string | null;
  graphRuntime: GraphRuntime | null;
  outsideClickHandler: ((event: MouseEvent) => void) | null;
  hiddenLevels: Set<string>;
  theme: "dark" | "light";
  isSubjectSelection: boolean;
};

export type UiState = {
  manualExcluded: Set<string>;
  selected: Set<string>;
  passed: Set<string>;
  clearAll: () => void;
  getStatusMarkup: (
    graphState: GraphState,
    levelExcluded?: Set<string>,
  ) => string;
  replaceState: (snapshot?: Partial<SavedStateSlice>) => void;
  getHoverId: () => string | null;
  getActiveNodeId: () => string | null;
  setHoverId: (id: string | null) => void;
  setActiveNodeId: (id: string | null) => void;
};

export type GraphState = {
  computeEffectivelyExcluded: (
    manualExcluded: Set<string>,
    levelExcluded?: Set<string>,
  ) => Set<string>;
  getAllAncestors: (id: string) => Set<string>;
  getAllDescendants: (id: string) => Set<string>;
  getAncestorsOfSet: (ids: string[]) => Set<string>;
  getDescendantsOfSet: (ids: string[]) => Set<string>;
  getAllAntiLinks: (id: string) => Set<string>;
  getAllCorequisites: (id: string) => Set<string>;
  getForwardPathStarts: (id: string) => Set<string>;
  getForwardPathNodes: (id: string) => Set<string>;
  getPrerequisitePathNodes: (id: string) => Set<string>;
  getSimplePathsFromRoots: (targetId: string, maxCount?: number) => string[][];
  getCorequisitePaths: (id: string) => string[][];
  getSimplePathsForward: (startId: string, maxCount?: number) => string[][];
  getEdgeRequirementKind: (source: string, target: string) => string;
  getCoreqRequirementKind: (source: string, target: string) => string;
};

export type RendererContext = {
  effExcl: Set<string>;
  manualExcluded: Set<string>;
  effectiveSel: Set<string>;
  effectivePassed: Set<string>;
  hAnc: Set<string>;
  hCoreq: Set<string>;
  hDesc: Set<string>;
  selAnc: Set<string>;
  selCoreq: Set<string>;
  selDesc: Set<string>;
};

export type RendererOptions = {
  nodeGroups: Selection<SVGGElement, GraphNode, SVGGElement, unknown>;
  circles: Selection<SVGCircleElement, GraphNode, SVGGElement, unknown>;
  labels: Selection<SVGTextElement, GraphNode, SVGGElement, unknown>;
  linkSel: Selection<SVGLineElement, GraphEdge, SVGGElement, unknown>;
  antiLayer: SVGGElement;
  excludedLayer: SVGGElement;
  linkLayer: SVGGElement;
  nodeLayer: SVGGElement;
  manualExcluded: Set<string>;
  selected: Set<string>;
  passed: Set<string>;
  getHoverId: () => string | null;
  getPinnedNodeIds?: () => Set<string>;
  getSearchQuery: () => string;
  getPreviewState: () => PreviewState;
  getHiddenLevels: () => Set<string>;
  graphState: GraphState;
  nodes: GraphNode[];
};

export type TooltipController = {
  showTip: (node: GraphNode) => void;
  hideTip: () => void;
};

export type GraphBuildArgs = {
  catalog: GraphDataResponse["catalog"];
  nodes: GraphNode[];
  prereqRules: Record<string, PrereqRule[]>;
  edges: GraphEdge[];
  restoredState:
    | (SavedStateSlice & { catalogId?: string; year?: string | null })
    | null;
  hiddenLevels: Set<string>;
};

export type GraphSimulation = Simulation<GraphNode, GraphEdge>;
