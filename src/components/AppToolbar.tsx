import React, { useEffect, useMemo, useRef, useState } from "react";
import { Palette, SlidersHorizontal, X } from "lucide-react";
import { GraphLegend } from "./GraphLegend";
import { SearchIcon } from "./SearchIcon";
import { UserControls } from "./UserControls";
import type { AuthUser } from "../types/auth.types";
import type { ModuleSearchResult } from "../types/graph.types";

type AppToolbarProps = {
  currentTitle: string;
  showSubjectSelection: boolean;
  subjectThemeLabel: string;
  themeIsLight: boolean;
  levelsMenuOpen: boolean;
  levelSummary: string;
  searchQuery: string;
  searchResults: ModuleSearchResult[];
  levelsTriggerRef: React.RefObject<HTMLButtonElement | null>;
  user: AuthUser | null;
  signingOut: boolean;
  onShowSubjectSelection: () => void;
  onToggleTheme: () => void;
  onToggleLevelsMenu: () => void;
  onSetSearchQuery: (value: string) => void;
  onClearSearch: () => void;
  onSearchHover: (nodeId: string | null) => void;
  onSearchSelect: (result: ModuleSearchResult) => void;
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
  searchResults,
  levelsTriggerRef,
  user,
  signingOut,
  onShowSubjectSelection,
  onToggleTheme,
  onToggleLevelsMenu,
  onSetSearchQuery,
  onClearSearch,
  onSearchHover,
  onSearchSelect,
  onSignOut,
}: AppToolbarProps) {
  const [searchMenuOpen, setSearchMenuOpen] = useState(false);
  const [activeResultIndex, setActiveResultIndex] = useState(-1);
  const searchWrapRef = useRef<HTMLDivElement | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const trimmedSearchQuery = searchQuery.trim();
  const hasSearchQuery = trimmedSearchQuery.length > 0;
  const shownResults = useMemo(
    () => searchResults.slice(0, 200),
    [searchResults],
  );

  useEffect(() => {
    if (activeResultIndex < 0 || activeResultIndex >= shownResults.length) {
      onSearchHover(null);
      return;
    }
    onSearchHover(shownResults[activeResultIndex]?.moduleId || null);
  }, [activeResultIndex, shownResults, onSearchHover]);

  useEffect(() => {
    if (!searchMenuOpen) {
      onSearchHover(null);
      setActiveResultIndex(-1);
      return;
    }

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null;
      if (!target) return;
      if (searchWrapRef.current?.contains(target)) return;
      setSearchMenuOpen(false);
      setActiveResultIndex(-1);
      onSearchHover(null);
    };

    document.addEventListener("pointerdown", handlePointerDown, true);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown, true);
    };
  }, [searchMenuOpen, onSearchHover]);

  useEffect(() => {
    if (!shownResults.length) {
      setActiveResultIndex(-1);
      return;
    }
    setActiveResultIndex((prev) =>
      prev >= shownResults.length ? shownResults.length - 1 : prev,
    );
  }, [shownResults]);

  const searchMenuVisible = searchMenuOpen && hasSearchQuery;

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

          <div className="search-wrap" ref={searchWrapRef}>
            <SearchIcon />
            <input
              ref={searchInputRef}
              id="search"
              type="text"
              placeholder="Search modules..."
              autoComplete="off"
              spellCheck="false"
              value={searchQuery}
              onFocus={() => setSearchMenuOpen(true)}
              onChange={(event) => onSetSearchQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Escape") {
                  setSearchMenuOpen(false);
                  setActiveResultIndex(-1);
                  onSearchHover(null);
                  return;
                }
                if (!searchMenuVisible || !shownResults.length) return;
                if (event.key === "ArrowDown") {
                  event.preventDefault();
                  setActiveResultIndex((prev) =>
                    prev < shownResults.length - 1 ? prev + 1 : 0,
                  );
                  return;
                }
                if (event.key === "ArrowUp") {
                  event.preventDefault();
                  setActiveResultIndex((prev) =>
                    prev > 0 ? prev - 1 : shownResults.length - 1,
                  );
                  return;
                }
                if (event.key === "Enter" && activeResultIndex >= 0) {
                  event.preventDefault();
                  const result = shownResults[activeResultIndex];
                  if (!result) return;
                  onSearchSelect(result);
                  setSearchMenuOpen(false);
                  setActiveResultIndex(-1);
                  onSearchHover(null);
                }
              }}
            />
            {hasSearchQuery ? (
              <button
                type="button"
                className="search-clear-btn"
                aria-label="Clear search"
                onClick={() => {
                  onClearSearch();
                  setSearchMenuOpen(false);
                  setActiveResultIndex(-1);
                  onSearchHover(null);
                  searchInputRef.current?.focus();
                }}
              >
                <X size={12} aria-hidden="true" />
              </button>
            ) : null}
            {searchMenuVisible ? (
              <div
                className="search-dropdown"
                role="listbox"
                aria-label="Search results"
              >
                {shownResults.length ? (
                  <>
                    {shownResults.map((result, index) => {
                      const isActive = index === activeResultIndex;
                      return (
                        <button
                          key={`${result.moduleId}:${result.catalogId}:${index}`}
                          type="button"
                          className={`search-result ${isActive ? "search-result--active" : ""}`.trim()}
                          role="option"
                          aria-selected={isActive}
                          onMouseEnter={() => setActiveResultIndex(index)}
                          onMouseLeave={() => {
                            setActiveResultIndex(-1);
                            onSearchHover(null);
                          }}
                          onClick={() => {
                            onSearchSelect(result);
                            setSearchMenuOpen(false);
                            setActiveResultIndex(-1);
                            onSearchHover(null);
                          }}
                        >
                          <span className="search-result-main">
                            {result.moduleId}
                          </span>
                          <span className="search-result-name">
                            {result.moduleName}
                          </span>
                          <span className="search-result-meta">
                            {result.catalogName}
                            {!result.availableInSelectedYear
                              ? " - unavailable this year"
                              : ""}
                          </span>
                        </button>
                      );
                    })}
                    {shownResults.length > 5 ? (
                      <div className="search-dropdown-hint">
                        Top matches first - scroll for more
                      </div>
                    ) : null}
                  </>
                ) : (
                  <div className="search-empty">No matching modules found.</div>
                )}
              </div>
            ) : null}
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
