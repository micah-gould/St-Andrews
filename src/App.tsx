import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AppGraphContent } from "./components/AppGraphContent";
import { AppToolbar } from "./components/AppToolbar";
import { LevelsMenu } from "./components/LevelsMenu";
import { SavedSettingsPanel } from "./components/SavedSettingsPanel";
import { SubjectSelectionSection } from "./components/SubjectSelectionSection";
import { useModuleGraphApp } from "./hooks/useModuleGraphApp";
import { useAuth } from "./providers/AuthProvider";

const LEVEL_OPTIONS = ["1000", "2000", "3000", "4000", "5000", "ext"] as const;

export default function App() {
  const navigate = useNavigate();
  const { logout, user } = useAuth();
  const [signingOut, setSigningOut] = useState(false);
  const [levelsMenuOpen, setLevelsMenuOpen] = useState(false);
  const [levelsMenuPosition, setLevelsMenuPosition] = useState({
    top: 0,
    left: 0,
    width: 180,
  });
  const bootedRef = useRef(false);
  const levelsTriggerRef = useRef<HTMLButtonElement | null>(null);
  const levelsMenuRef = useRef<HTMLDivElement | null>(null);
  const { appState, loadedGraph, viewModel, actions } = useModuleGraphApp(
    user?.id || null,
  );

  useEffect(() => {
    if (!user || bootedRef.current) {
      return;
    }

    bootedRef.current = true;
  }, [user]);

  useEffect(() => {
    if (!levelsMenuOpen) {
      return;
    }

    const updateLevelsMenuPosition = () => {
      const rect = levelsTriggerRef.current?.getBoundingClientRect();
      if (!rect) {
        return;
      }

      const width = Math.max(rect.width, 220);
      const left = Math.min(rect.left, window.innerWidth - width - 16);

      setLevelsMenuPosition({
        top: rect.bottom + 10,
        left: Math.max(16, left),
        width,
      });
    };

    updateLevelsMenuPosition();
    window.addEventListener("resize", updateLevelsMenuPosition);
    window.addEventListener("scroll", updateLevelsMenuPosition, true);

    return () => {
      window.removeEventListener("resize", updateLevelsMenuPosition);
      window.removeEventListener("scroll", updateLevelsMenuPosition, true);
    };
  }, [levelsMenuOpen]);

  useEffect(() => {
    if (!levelsMenuOpen) {
      return;
    }

    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node | null;
      if (levelsMenuRef.current?.contains(target)) {
        return;
      }
      if (levelsTriggerRef.current?.contains(target)) {
        return;
      }
      setLevelsMenuOpen(false);
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setLevelsMenuOpen(false);
        levelsTriggerRef.current?.focus();
      }
    };

    document.addEventListener("pointerdown", handlePointerDown, true);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown, true);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [levelsMenuOpen]);

  const subjectThemeLabel =
    viewModel.theme === "light" ? "Dark mode" : "Light mode";

  const onToggleLevel = (level: string, checked: boolean) => {
    const next = new Set(viewModel.hiddenLevels);
    if (checked) next.delete(level);
    else next.add(level);
    actions.setHiddenLevels(next);
  };

  const levelSummary =
    viewModel.visibleLevels.length === LEVEL_OPTIONS.length
      ? "All levels"
      : viewModel.visibleLevels.length === 0
        ? "No levels"
        : `${viewModel.visibleLevels.length} levels`;

  const toggleAllLevels = () => {
    if (viewModel.visibleLevels.length === LEVEL_OPTIONS.length) {
      actions.setHiddenLevels(new Set(LEVEL_OPTIONS));
      return;
    }
    actions.setHiddenLevels(new Set());
  };

  return (
    <div id="app">
      <AppToolbar
        currentTitle={viewModel.currentTitle}
        showSubjectSelection={viewModel.showSubjectSelection}
        subjectThemeLabel={subjectThemeLabel}
        themeIsLight={viewModel.theme === "light"}
        levelsMenuOpen={levelsMenuOpen}
        levelSummary={levelSummary}
        searchQuery={viewModel.searchQuery}
        searchResults={viewModel.searchResults}
        levelsTriggerRef={levelsTriggerRef}
        user={user}
        signingOut={signingOut}
        onShowSubjectSelection={actions.showSubjectSelection}
        onToggleTheme={actions.toggleTheme}
        onToggleLevelsMenu={() => setLevelsMenuOpen((open) => !open)}
        onSetSearchQuery={actions.setSearchQuery}
        onClearSearch={actions.clearSearch}
        onSearchHover={actions.setSearchHover}
        onSearchSelect={actions.selectSearchResult}
        onLegendColorsChange={actions.refreshGraphColors}
        onSignOut={async () => {
          setSigningOut(true);
          await logout();
          setSigningOut(false);
          navigate(window.location.pathname + window.location.search, {
            replace: true,
          });
        }}
      />

      <LevelsMenu
        open={levelsMenuOpen}
        menuRef={levelsMenuRef}
        position={levelsMenuPosition}
        levelOptions={LEVEL_OPTIONS}
        hiddenLevels={viewModel.hiddenLevels}
        visibleLevelCount={viewModel.visibleLevels.length}
        totalLevelCount={LEVEL_OPTIONS.length}
        onToggleAll={toggleAllLevels}
        onToggleLevel={onToggleLevel}
      />

      {viewModel.showSubjectSelection ? (
        <SubjectSelectionSection
          subjects={viewModel.subjects}
          onSelectSubject={actions.selectSubject}
        />
      ) : (
        <>
          <SavedSettingsPanel
            catalogs={viewModel.catalogs}
            selectedCatalogId={viewModel.selectedCatalogId}
            selectedYear={viewModel.selectedYear}
            settingsName={viewModel.settingsName}
            settingsPlaceholder={viewModel.settingsPlaceholder}
            saveLabel={viewModel.saveLabel}
            canSave={viewModel.canSave}
            savedPlans={viewModel.savedPlans}
            selectedPlanId={viewModel.selectedPlanId}
            shareVisible={viewModel.shareVisible}
            shareDisabled={viewModel.shareDisabled}
            deleteDisabled={viewModel.deleteDisabled}
            viewOnlyBadge={viewModel.viewOnlyBadge}
            feedbackMarkup={viewModel.feedbackMarkup}
            feedbackActions={viewModel.feedbackActions}
            onSelectCatalog={actions.selectCatalog}
            onSelectYear={actions.selectYear}
            onAdvanceYear={actions.advanceYear}
            onSetSettingsName={actions.setSettingsName}
            onSaveCurrentPlan={actions.saveCurrentPlan}
            onPreviewSavedPlan={actions.previewSavedPlan}
            onLoadSelectedPlan={actions.loadSelectedPlan}
            onShareLoadedPlan={actions.shareLoadedPlan}
            onDeleteSelectedPlan={actions.deleteSelectedPlan}
          />
          <AppGraphContent
            showGraph={!viewModel.showSubjectSelection}
            loadedGraph={loadedGraph}
            hiddenLevels={viewModel.hiddenLevels}
            appState={appState}
            clearSharedSettingId={actions.clearSharedSettingId}
            onClearAll={actions.clearAll}
            onStatusMarkupChange={actions.onStatusMarkupChange}
            onRuntimeReady={actions.onRuntimeReady}
          />

          <footer id="status">
            <div
              id="status-text"
              dangerouslySetInnerHTML={{ __html: viewModel.statusMarkup }}
            />
          </footer>
        </>
      )}
    </div>
  );
}
