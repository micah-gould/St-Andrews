import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  getLegendColor,
  resetLegendColorsToDefaults,
  saveLegendColorsToStorage,
  setLegendColor,
} from "../constants";

const LEGEND_ITEMS = [
  { key: "lvl1000", label: "1000" },
  { key: "lvl2000", label: "2000" },
  { key: "lvl3000", label: "3000" },
  { key: "lvl4000", label: "4000" },
  { key: "lvl5000", label: "5000" },
  { key: "lvlext", label: "Ext" },
  { key: "sel", label: "Selected" },
  { key: "passed", label: "Passed" },
  { key: "excl", label: "Excluded" },
  { key: "hoverPreRequired", label: "Required prereq" },
  { key: "hoverPreOptional", label: "Optional prereq" },
  { key: "hoverFwd", label: "Hover unlocks" },
  { key: "selFwd", label: "Selected unlocks" },
] as const;

type LegendItem = (typeof LEGEND_ITEMS)[number];

function ColorEditor({
  item,
  onColorsChange,
}: {
  item: LegendItem;
  onColorsChange: () => void;
}) {
  const [draftColor, setDraftColor] = useState(getLegendColor(item.key));

  return (
    <div
      className="legend-color-popover"
      role="dialog"
      aria-label="Color picker"
    >
      <div className="legend-color-popover__title">{item.label} color</div>
      <div className="legend-color-popover__controls">
        <input
          type="color"
          value={draftColor}
          onChange={(event) => {
            const nextColor = event.target.value.toUpperCase();
            setDraftColor(nextColor);
            setLegendColor(item.key, nextColor);
            onColorsChange();
          }}
          aria-label={`${item.label} color`}
        />
        <input
          type="text"
          value={draftColor}
          onChange={(event) => {
            const next = event.target.value.toUpperCase();
            setDraftColor(next);
            if (/^#[0-9A-F]{6}$/.test(next)) {
              setLegendColor(item.key, next);
              onColorsChange();
            }
          }}
          maxLength={7}
          spellCheck="false"
          aria-label={`${item.label} hex value`}
        />
      </div>
    </div>
  );
}

export function GraphLegend({
  onColorsChange,
}: {
  onColorsChange: () => void;
}) {
  const [activeKey, setActiveKey] = useState<LegendItem["key"] | null>(null);
  const legendRef = useRef<HTMLDivElement | null>(null);
  const activeItem = useMemo(
    () => LEGEND_ITEMS.find((item) => item.key === activeKey) || null,
    [activeKey],
  );

  useEffect(() => {
    if (!activeKey) return;

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null;
      if (target && legendRef.current?.contains(target)) return;
      setActiveKey(null);
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setActiveKey(null);
      }
    };

    document.addEventListener("pointerdown", handlePointerDown, true);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown, true);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [activeKey]);

  return (
    <div className="legend" ref={legendRef}>
      {LEGEND_ITEMS.map((item, index) => (
        <React.Fragment key={item.key}>
          {index === 6 ? <span className="divider" /> : null}
          <span className="leg">
            <button
              type="button"
              className="dot dot-btn"
              style={{ background: getLegendColor(item.key) }}
              onClick={() =>
                setActiveKey((current) =>
                  current === item.key ? null : item.key,
                )
              }
              aria-label={`Edit ${item.label} color`}
              title={`Edit ${item.label} color`}
              aria-expanded={activeKey === item.key}
            />
            {item.label}
            {activeKey === item.key ? (
              <ColorEditor item={item} onColorsChange={onColorsChange} />
            ) : null}
          </span>
        </React.Fragment>
      ))}
      <span className="divider" />
      <div className="legend-actions">
        <button
          type="button"
          className="legend-color-btn"
          onClick={() => {
            resetLegendColorsToDefaults();
            onColorsChange();
          }}
        >
          Reset defaults
        </button>
        <button
          type="button"
          className="legend-color-btn legend-color-btn--primary"
          onClick={() => {
            saveLegendColorsToStorage();
            setActiveKey(null);
          }}
        >
          Save colors
        </button>
      </div>
    </div>
  );
}
