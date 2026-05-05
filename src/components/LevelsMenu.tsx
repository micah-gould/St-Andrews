import React from "react";

type LevelsMenuProps = {
  open: boolean;
  menuRef: React.RefObject<HTMLDivElement | null>;
  position: { top: number; left: number; width: number };
  levelOptions: readonly string[];
  hiddenLevels: Set<string>;
  visibleLevelCount: number;
  totalLevelCount: number;
  onToggleAll: () => void;
  onToggleLevel: (level: string, checked: boolean) => void;
};

export function LevelsMenu({
  open,
  menuRef,
  position,
  levelOptions,
  hiddenLevels,
  visibleLevelCount,
  totalLevelCount,
  onToggleAll,
  onToggleLevel,
}: LevelsMenuProps) {
  if (!open) {
    return null;
  }

  return (
    <div
      ref={menuRef}
      className="toolbar-levels-panel toolbar-levels-panel--floating"
      style={{
        top: `${position.top}px`,
        left: `${position.left}px`,
        width: `${position.width}px`,
      }}
    >
      <div className="toolbar-levels-panel-inner">
        <button
          type="button"
          className="level-filter-menu-action"
          onClick={onToggleAll}
        >
          {visibleLevelCount === totalLevelCount
            ? "Deselect all"
            : "Select all"}
        </button>
        <div className="level-filter-options">
          {levelOptions.map((level) => (
            <label key={level} className="level-toggle">
              <input
                type="checkbox"
                value={level}
                checked={!hiddenLevels.has(level)}
                onChange={(event) => onToggleLevel(level, event.target.checked)}
              />
              {level === "ext" ? "Ext" : level}
            </label>
          ))}
        </div>
      </div>
    </div>
  );
}
