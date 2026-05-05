import React from "react";
import { COLORS } from "../constants";

export function GraphLegend() {
  return (
    <div className="legend">
      <span className="leg">
        <span className="dot" style={{ background: COLORS.lvl[1000] }} />
        1000
      </span>
      <span className="leg">
        <span className="dot" style={{ background: COLORS.lvl[2000] }} />
        2000
      </span>
      <span className="leg">
        <span className="dot" style={{ background: COLORS.lvl[3000] }} />
        3000
      </span>
      <span className="leg">
        <span className="dot" style={{ background: COLORS.lvl[4000] }} />
        4000
      </span>
      <span className="leg">
        <span className="dot" style={{ background: COLORS.lvl[5000] }} />
        5000
      </span>
      <span className="leg">
        <span className="dot" style={{ background: COLORS.lvl.ext }} />
        Ext
      </span>
      <span className="divider" />
      <span className="leg">
        <span className="dot" style={{ background: COLORS.sel }} />
        Selected
      </span>
      <span className="leg">
        <span className="dot" style={{ background: COLORS.passed }} />
        Passed
      </span>
      <span className="leg">
        <span className="dot" style={{ background: COLORS.excl }} />
        Excluded
      </span>
      <span className="leg">
        <span className="dot" style={{ background: COLORS.hoverPreRequired }} />
        Required prereq
      </span>
      <span className="leg">
        <span className="dot" style={{ background: COLORS.hoverPreOptional }} />
        Optional prereq
      </span>
      <span className="leg">
        <span className="dot" style={{ background: COLORS.hoverFwd }} />
        Hover unlocks
      </span>
      <span className="leg">
        <span className="dot" style={{ background: COLORS.selFwd }} />
        Selected unlocks
      </span>
    </div>
  );
}
