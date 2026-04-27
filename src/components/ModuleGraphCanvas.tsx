import React, { useEffect, useRef } from 'react';
import { buildGraphRuntime } from '../moduleGraph/runtime';
import type { GraphDataResponse, PrereqRule } from '../types/graph.types';
import type { AppState, GraphRuntime } from '../types/runtime.types';
import type { SavedStateSlice } from '../types/saved-state.types';

type ModuleGraphCanvasProps = {
  catalog: GraphDataResponse['catalog'];
  nodes: GraphDataResponse['nodes'];
  edges: GraphDataResponse['edges'];
  prereqRules: Record<string, PrereqRule[]>;
  restoredState: (SavedStateSlice & { catalogId?: string; year?: string | null }) | null;
  hiddenLevels: Set<string>;
  appState: AppState;
  clearSharedSettingId: () => void;
  onStatusMarkupChange: (markup: string) => void;
  onRuntimeReady: (runtime: GraphRuntime) => void;
};

export function ModuleGraphCanvas({ catalog, nodes, edges, prereqRules, restoredState, hiddenLevels, appState, clearSharedSettingId, onStatusMarkupChange, onRuntimeReady }: ModuleGraphCanvasProps) {
  const areaRef = useRef<HTMLDivElement | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const tipRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!areaRef.current || !svgRef.current || !tipRef.current) {
      return;
    }

    svgRef.current.innerHTML = '';
    tipRef.current.innerHTML = '';
    tipRef.current.style.display = 'none';

    const runtime = buildGraphRuntime({
      catalog,
      nodes,
      prereqRules,
      edges,
      restoredState,
      hiddenLevels,
      area: areaRef.current,
      svgElement: svgRef.current,
      tipElement: tipRef.current,
      appState,
      clearSharedSettingId,
      onStatusMarkupChange,
    });

    onRuntimeReady(runtime);
  }, [catalog, nodes, prereqRules, edges, restoredState, hiddenLevels, appState, clearSharedSettingId, onStatusMarkupChange, onRuntimeReady]);

  return (
    <div id="graph-area" ref={areaRef}>
      <svg id="graph-svg" ref={svgRef} />
      <aside id="tip" ref={tipRef} />
    </div>
  );
}
