import React, { memo } from "react";
import { ModuleGraphCanvas } from "./ModuleGraphCanvas";
import type { LoadedGraph } from "../hooks/moduleGraph.types";
import type { AppState, GraphRuntime } from "../types/runtime.types";

type AppGraphContentProps = {
  showGraph: boolean;
  loadedGraph: LoadedGraph | null;
  hiddenLevels: Set<string>;
  appState: AppState;
  clearSharedSettingId: () => void;
  onStatusMarkupChange: (markup: string) => void;
  onRuntimeReady: (runtime: GraphRuntime) => void;
};

function AppGraphContentInner({
  showGraph,
  loadedGraph,
  hiddenLevels,
  appState,
  clearSharedSettingId,
  onStatusMarkupChange,
  onRuntimeReady,
}: AppGraphContentProps) {
  if (!showGraph) {
    return null;
  }

  if (!loadedGraph) {
    return (
      <div
        id="graph-area"
        className="graph-loading-state"
        role="status"
        aria-live="polite"
      >
        <div className="graph-loading-card">
          <div className="graph-loading-kicker">Planner</div>
          <div className="graph-loading-title">Loading modules...</div>
          <p className="graph-loading-copy">
            Preparing your subject graph and saved plans.
          </p>
        </div>
      </div>
    );
  }

  return (
    <ModuleGraphCanvas
      catalog={loadedGraph.catalog}
      nodes={loadedGraph.nodes}
      edges={loadedGraph.edges}
      prereqRules={loadedGraph.prereqRules}
      restoredState={loadedGraph.restoredState}
      hiddenLevels={hiddenLevels}
      appState={appState}
      clearSharedSettingId={clearSharedSettingId}
      onStatusMarkupChange={onStatusMarkupChange}
      onRuntimeReady={onRuntimeReady}
    />
  );
}

export const AppGraphContent = memo(
  AppGraphContentInner,
  (prev, next) =>
    prev.showGraph === next.showGraph &&
    prev.loadedGraph === next.loadedGraph &&
    prev.hiddenLevels === next.hiddenLevels &&
    prev.appState === next.appState,
);
