import type { GraphDataResponse } from "../types/graph.types";
import type { SavedStateSlice } from "../types/saved-state.types";

export type RestoredState = SavedStateSlice & {
  catalogId: string | null;
  year: string | null;
};

export type LoadedGraph = {
  catalog: GraphDataResponse["catalog"];
  nodes: GraphDataResponse["nodes"];
  edges: GraphDataResponse["edges"];
  prereqRules: GraphDataResponse["prereqRules"];
  restoredState:
    | (SavedStateSlice & { catalogId?: string; year?: string | null })
    | null;
};
