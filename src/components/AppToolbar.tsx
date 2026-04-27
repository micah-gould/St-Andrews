import React from "react";
import { Eraser, Palette, SlidersHorizontal } from "lucide-react";
import { GraphLegend } from "./GraphLegend";
import { SearchIcon } from "./SearchIcon";
import { UserControls } from "./UserControls";
import type { AuthUser } from "../types/auth.types";

type AppToolbarProps = {
  currentTitle: string;
  showSubjectSelection: boolean;
  subjectThemeLabel: string;
  themeIsLight: boolean;
  levelsMenuOpen: boolean;
  levelSummary: string;
  searchQuery: string;
  levelsTriggerRef: React.RefObject<HTMLButtonElement | null>;
  user: AuthUser | null;
  signingOut: boolean;
  onShowSubjectSelection: () => void;
  onClearAll: () => void;
  onToggleTheme: () => void;
  onToggleLevelsMenu: () => void;
  onSetSearchQuery: (value: string) => void;
  onSignOut: () => void | Promise<void>;
};

export function AppToolbar({
  currentTitle,
  showSubjectSelection,
  subjectThemeLabel,
  themeIsLight,
  levelsMenuOpen,
  levelSummary,
  searchQuery,
  levelsTriggerRef,
  user,
  signingOut,
  onShowSubjectSelection,
  onClearAll,
  onToggleTheme,
  onToggleLevelsMenu,
  onSetSearchQuery,
  onSignOut,
}: AppToolbarProps) {
  return (
    <header
      id="toolbar"
      className={levelsMenuOpen ? "toolbar--levels-open" : undefined}
    >
      <div className="toolbar-main-row">
        <div className="toolbar-left">
          <div className="brand-block">
            <button
              className="logo"
              type="button"
              onClick={
                !showSubjectSelection ? onShowSubjectSelection : undefined
              }
            >
              {currentTitle}
            </button>
            <p className="brand-subtitle">University of St Andrews</p>
          </div>
          <GraphLegend />
        </div>

        <div className="toolbar-right">
          <button
            className="clear-btn"
            id="clear-all"
            type="button"
            onClick={onClearAll}
          >
            <Eraser size={14} aria-hidden="true" />
            Clear all
          </button>
          <button
            className="clear-btn"
            id="theme-toggle"
            type="button"
            aria-pressed={themeIsLight}
            onClick={onToggleTheme}
          >
            <Palette size={14} aria-hidden="true" />
            {subjectThemeLabel}
          </button>

          <div
            className="level-filter"
            id="level-filter"
            aria-label="Module level visibility"
          >
            <button
              ref={levelsTriggerRef}
              type="button"
              className="level-filter-trigger"
              aria-expanded={levelsMenuOpen}
              onClick={onToggleLevelsMenu}
            >
              <span className="level-filter-label">
                <SlidersHorizontal size={13} aria-hidden="true" />
                Levels
              </span>
              <span className="level-filter-value">{levelSummary}</span>
            </button>
          </div>

          <div className="search-wrap">
            <SearchIcon />
            <input
              id="search"
              type="text"
              placeholder="Search modules..."
              autoComplete="off"
              spellCheck="false"
              value={searchQuery}
              onChange={(event) => onSetSearchQuery(event.target.value)}
            />
          </div>

          <UserControls
            user={user}
            signingOut={signingOut}
            onSignOut={onSignOut}
          />
        </div>
      </div>
    </header>
  );
}
