import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { GraphLegend } from './components/GraphLegend';
import { ModuleGraphCanvas } from './components/ModuleGraphCanvas';
import { SearchIcon } from './components/SearchIcon';
import { UserControls } from './components/UserControls';
import { useModuleGraphApp } from './hooks/useModuleGraphApp';
import { useAuth } from './providers/AuthProvider';

const LEVEL_OPTIONS = ['1000', '2000', '3000', '4000', '5000', 'ext'] as const;

export default function App() {
  const navigate = useNavigate();
  const { logout, user } = useAuth();
  const [signingOut, setSigningOut] = useState(false);
  const bootedRef = useRef(false);
  const { appState, loadedGraph, viewModel, actions } = useModuleGraphApp();

  useEffect(() => {
    if (!user || bootedRef.current) {
      return;
    }

    bootedRef.current = true;
  }, [user]);

  const subjectThemeLabel = viewModel.theme === 'light' ? 'Dark mode' : 'Light mode';

  const onToggleLevel = (level: string, checked: boolean) => {
    const next = new Set(viewModel.hiddenLevels);
    if (checked) next.delete(level);
    else next.add(level);
    actions.setHiddenLevels(next);
  };

  return (
    <div id="app">
      <header id="toolbar">
        <div className="toolbar-left">
          <h1 className="logo" onClick={!viewModel.showSubjectSelection ? actions.showSubjectSelection : undefined}>{viewModel.currentTitle}</h1>
          <GraphLegend />
        </div>

        <div className="toolbar-right">
          <button className="clear-btn" id="clear-all" type="button" onClick={actions.clearAll}>Clear all</button>
          <button className="clear-btn" id="theme-toggle" type="button" aria-pressed={viewModel.theme === 'light'} onClick={actions.toggleTheme}>{subjectThemeLabel}</button>

          <div className="level-filter" id="level-filter" aria-label="Module level visibility">
            <span className="level-filter-label">Levels</span>
            {LEVEL_OPTIONS.map((level) => (
              <label key={level} className="level-toggle"><input type="checkbox" value={level} checked={!viewModel.hiddenLevels.has(level)} onChange={(event) => onToggleLevel(level, event.target.checked)} />{level === 'ext' ? 'Ext' : level}</label>
            ))}
          </div>

          <div className="search-wrap">
            <SearchIcon />
            <input id="search" type="text" placeholder="Search modules..." autoComplete="off" spellCheck="false" value={viewModel.searchQuery} onChange={(event) => actions.setSearchQuery(event.target.value)} />
          </div>

          <UserControls
            user={user}
            signingOut={signingOut}
            onSignOut={async () => {
              setSigningOut(true);
              await logout();
              navigate('/login', { replace: true });
            }}
          />
        </div>
      </header>

      <section id="subject-selection" aria-label="Subject selection" style={{ display: viewModel.showSubjectSelection ? 'flex' : 'none' }}>
        <div className="subject-selection-header">
          <button className="clear-btn" id="subject-theme-toggle" type="button" aria-pressed={viewModel.theme === 'light'} onClick={actions.toggleTheme}>{subjectThemeLabel}</button>
        </div>
        <div className="subject-selection-content">
          <h2>Select a Subject</h2>
          <div id="subject-buttons" className="subject-buttons">
            {viewModel.subjects.map((subject) => (
              <button key={subject.id} className="subject-button" type="button" onClick={() => actions.selectSubject(subject.id)}>{subject.name}</button>
            ))}
          </div>
        </div>
      </section>

      <section id="saved-settings-panel" aria-label="Saved settings" style={{ display: viewModel.showSubjectSelection ? 'none' : 'block' }}>
        <div className="saved-settings-copy">
          <strong>Saved comparisons</strong>
          <span>Switch catalogs, save combinations, and reload them later.</span>
        </div>
        <div className="saved-settings-controls">
          <label className="field-group" htmlFor="catalog-select">
            <span>Catalog</span>
            <select id="catalog-select" aria-label="Course catalog" value={viewModel.selectedCatalogId} onChange={(event) => actions.selectCatalog(event.target.value)}>
              {viewModel.catalogs.map((catalog) => <option key={catalog.id} value={catalog.id}>{catalog.name}</option>)}
            </select>
          </label>
          <label className="field-group" htmlFor="year-select">
            <span>Year</span>
            <select id="year-select" aria-label="Academic year" value={viewModel.selectedYear} onChange={(event) => actions.selectYear(event.target.value)}>
              {(viewModel.catalogs.find((catalog) => catalog.id === viewModel.selectedCatalogId)?.years || []).map((year) => <option key={year} value={year}>{year}</option>)}
            </select>
          </label>
          <button id="next-year" type="button" onClick={actions.advanceYear}>Next year</button>
        </div>
        <form id="settings-form" className="settings-form" onSubmit={(event) => {
          event.preventDefault();
          actions.saveCurrentPlan(viewModel.settingsName);
        }}>
          <input id="settings-name" name="name" type="text" maxLength={80} placeholder={viewModel.settingsPlaceholder} value={viewModel.settingsName} onChange={(event) => actions.setSettingsName(event.target.value)} />
          <button id="save-settings" type="submit">{viewModel.saveLabel}</button>
        </form>
        <div className="saved-settings-controls">
          <select id="saved-settings-list" aria-label="Saved plans list" value={viewModel.selectedPlanId} onChange={(event) => actions.previewSavedPlan(event.target.value)}>
            {!viewModel.savedPlans.length ? <option value="">No saved plans yet</option> : <option value="" />}
            {viewModel.savedPlans.map((plan) => <option key={plan.id} value={plan.id}>{plan.label}</option>)}
          </select>
          <button id="load-settings" type="button" onClick={actions.loadSelectedPlan}>Load</button>
          <button id="share-settings" type="button" style={{ display: viewModel.shareVisible ? undefined : 'none' }} disabled={viewModel.shareDisabled} onClick={actions.shareLoadedPlan}>Share</button>
          <button id="delete-settings" type="button" className="clear-btn" disabled={viewModel.deleteDisabled} onClick={actions.deleteSelectedPlan}>Delete</button>
        </div>
        <div id="view-only-badge" className="view-only-badge" style={{ display: viewModel.viewOnlyBadge ? undefined : 'none' }} role="status">{viewModel.viewOnlyBadge}</div>
        <div id="settings-feedback" aria-live="polite">
          <span dangerouslySetInnerHTML={{ __html: viewModel.feedbackMarkup }} />
          {viewModel.feedbackActions.map((action) => (
            <button key={action.label} type="button" className="settings-feedback-action" onClick={action.onClick}>{action.label}</button>
          ))}
        </div>
      </section>

      {loadedGraph ? (
        <ModuleGraphCanvas
          catalog={loadedGraph.catalog}
          nodes={loadedGraph.nodes}
          edges={loadedGraph.edges}
          prereqRules={loadedGraph.prereqRules}
          restoredState={loadedGraph.restoredState}
          hiddenLevels={viewModel.hiddenLevels}
          appState={appState}
          clearSharedSettingId={actions.clearSharedSettingId}
          onStatusMarkupChange={actions.onStatusMarkupChange}
          onRuntimeReady={actions.onRuntimeReady}
        />
      ) : <div id="graph-area"><svg id="graph-svg" /><aside id="tip" /></div>}

      <footer id="status">
        <div id="status-text" dangerouslySetInnerHTML={{ __html: viewModel.statusMarkup }} />
      </footer>
    </div>
  );
}
