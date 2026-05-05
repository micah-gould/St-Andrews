import React, { memo, useEffect, useEffectEvent, useRef } from "react";
import { Eraser } from "lucide-react";
import { buildGraphRuntime } from "../moduleGraph/runtime";
import type { GraphDataResponse, PrereqRule } from "../types/graph.types";
import type { AppState, GraphRuntime } from "../types/runtime.types";
import type { SavedStateSlice } from "../types/saved-state.types";

type ModuleGraphCanvasProps = {
  catalog: GraphDataResponse["catalog"];
  nodes: GraphDataResponse["nodes"];
  edges: GraphDataResponse["edges"];
  prereqRules: Record<string, PrereqRule[]>;
  restoredState:
    | (SavedStateSlice & { catalogId?: string; year?: string | null })
    | null;
  hiddenLevels: Set<string>;
  appState: AppState;
  clearSharedSettingId: () => void;
  onClearAll: () => void;
  onStatusMarkupChange: (markup: string) => void;
  onRuntimeReady: (runtime: GraphRuntime) => void;
};

function ModuleGraphCanvasInner({
  catalog,
  nodes,
  edges,
  prereqRules,
  restoredState,
  hiddenLevels: _hiddenLevels,
  appState,
  clearSharedSettingId,
  onClearAll,
  onStatusMarkupChange,
  onRuntimeReady,
}: ModuleGraphCanvasProps) {
  const areaRef = useRef<HTMLDivElement | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const tipRef = useRef<HTMLElement | null>(null);
  const runtimeRef = useRef<GraphRuntime | null>(null);

  const handleClearSharedSettingId = useEffectEvent(() => {
    clearSharedSettingId();
  });

  const handleStatusMarkupChange = useEffectEvent((markup: string) => {
    onStatusMarkupChange(markup);
  });

  const handleRuntimeReady = useEffectEvent((runtime: GraphRuntime) => {
    onRuntimeReady(runtime);
  });

  useEffect(() => {
    if (!areaRef.current || !svgRef.current || !tipRef.current) {
      return;
    }

    svgRef.current.innerHTML = "";
    tipRef.current.style.display = "none";

    const runtime = buildGraphRuntime({
      catalog,
      nodes,
      prereqRules,
      edges,
      restoredState,
      hiddenLevels: _hiddenLevels,
      area: areaRef.current,
      svgElement: svgRef.current,
      tipElement: tipRef.current,
      appState,
      clearSharedSettingId: handleClearSharedSettingId,
      onStatusMarkupChange: handleStatusMarkupChange,
    });

    runtimeRef.current = runtime;
    handleRuntimeReady(runtime);

    return () => {
      runtime.destroy();
      if (runtimeRef.current === runtime) {
        runtimeRef.current = null;
      }
    };
  }, [catalog, nodes, prereqRules, edges, restoredState, appState]);

  return (
    <div id="graph-area" ref={areaRef}>
      <div className="graph-controls" role="toolbar" aria-label="Graph actions">
        <button
          className="clear-btn"
          id="graph-clear-all"
          type="button"
          onClick={onClearAll}
        >
          <Eraser size={14} aria-hidden="true" />
          Clear all
        </button>
      </div>
      <svg id="graph-svg" ref={svgRef} />
      <aside id="tip" ref={tipRef} />
    </div>
  );
}

export const ModuleGraphCanvas = memo(ModuleGraphCanvasInner);
