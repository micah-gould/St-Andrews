import { useEffect, useMemo, useState } from 'react';
import { openShareDialog } from '../components/ShareDialog';
import { showRequestAccessOverlay } from '../components/RequestAccessOverlay';
import { listCatalogs, loadGraphData } from '../dataLoader';
import { savedStatesApi } from '../savedStatesApi';
import type { GraphRuntime } from '../types/runtime.types';
import type { SavedStateBlob, SavedStateRecord, SavedStateSlice } from '../types/saved-state.types';
import { buildViewModel, canPreviewSetting, getCatalogName, getRestoredSettingState, getStoredTheme, parseUrl, publishAppShell, showFeedback, updateUrl } from './moduleGraph.helpers';
import { createModuleGraphState } from './moduleGraph.state';
import type { LoadedGraph } from './moduleGraph.types';

export function useModuleGraphApp() {
  const [appState] = useState(createModuleGraphState);
  const [loadedGraph, setLoadedGraph] = useState<LoadedGraph | null>(null);
  const [, setVersion] = useState(0);

  const refresh = () => setVersion((value) => value + 1);
  const publish = () => publishAppShell(appState, refresh);
  const feedback = (message: string, isError = false, actions: Parameters<typeof showFeedback>[4] = []) => showFeedback(appState, refresh, message, isError, actions);

  const setSharedSettingId = (settingId: string | number | null | undefined) => {
    appState.sharedSettingId = settingId ? String(settingId) : null;
    updateUrl(appState.currentCatalogId, appState.currentYear, appState.sharedSettingId);
  };

  const clearSharedSettingId = () => {
    if (!appState.sharedSettingId) return;
    appState.sharedSettingId = null;
    updateUrl(appState.currentCatalogId, appState.currentYear, null);
  };

  const getSelectedSavedSetting = () => appState.settingsCache.find((setting) => String(setting.id) === appState.selectedPlanId) || null;

  const hydrateSetting = async (setting: SavedStateRecord | null) => {
    if (!setting) return null;
    if (setting.state) return setting;
    try {
      const full = await savedStatesApi.get(setting.id);
      Object.assign(setting, full);
      return setting;
    } catch (error) {
      feedback(`Could not load plan: ${(error as Error).message}`, true);
      return null;
    }
  };

  const refreshSettings = async (selectedId = '') => {
    appState.settingsCache = await savedStatesApi.list();
    appState.selectedPlanId = selectedId;
    publish();
  };

  const syncSelectedSettingPreview = () => {
    const selectedSetting = getSelectedSavedSetting();
    if (!selectedSetting || !appState.graphRuntime) {
      appState.graphRuntime?.setPreviewState(null);
      return;
    }
    const { restoredState, needsCatalogSwitch, needsYearSwitch } = canPreviewSetting(appState, selectedSetting);
    appState.graphRuntime.setPreviewState(needsCatalogSwitch || needsYearSwitch ? null : restoredState);
  };

  const renderCatalog = async (catalogId: string, yearOrState: string | (SavedStateSlice & { catalogId?: string; year?: string | null }) | null = null, maybeRestoredState: (SavedStateSlice & { catalogId?: string; year?: string | null }) | null = null) => {
    const restoredState = maybeRestoredState || (yearOrState && typeof yearOrState === 'object' ? yearOrState : null);
    const selectedYear = restoredState?.year || (typeof yearOrState === 'string' ? yearOrState : appState.currentYear);
    const { catalog, selectedYear: resolvedYear, nodes, prereqRules, edges } = await loadGraphData(catalogId, selectedYear);
    appState.currentCatalogId = catalog.id;
    appState.currentYear = resolvedYear;
    appState.hiddenLevels = new Set(restoredState?.hiddenLevels ?? [...appState.hiddenLevels]);
    appState.searchQuery = '';
    updateUrl(catalog.id, resolvedYear, appState.sharedSettingId);
    setLoadedGraph({ catalog, nodes, edges, prereqRules, restoredState });
    publish();
  };

  const selectSubject = async (catalogId: string) => {
    clearSharedSettingId();
    appState.isSubjectSelection = false;
    await renderCatalog(catalogId);
  };

  const selectCatalog = async (catalogId: string) => {
    clearSharedSettingId();
    appState.loadedSetting = null;
    appState.settingsName = '';
    await renderCatalog(catalogId, appState.currentYear);
    feedback(`Showing ${getCatalogName(appState, catalogId)}.`);
  };

  const selectYear = async (year: string) => {
    appState.currentYear = year;
    clearSharedSettingId();
    appState.loadedSetting = null;
    appState.settingsName = '';
    await renderCatalog(appState.currentCatalogId || appState.catalogs[0]?.id || '', year);
    feedback(`Showing ${year}.`);
  };

  const advanceYear = async () => {
    const currentCatalog = appState.catalogs.find((catalog) => catalog.id === appState.currentCatalogId) || appState.catalogs[0];
    const years = currentCatalog?.years || [];
    const currentIndex = years.indexOf(appState.currentYear || '');
    const nextYear = currentIndex >= 0 ? years[currentIndex + 1] : years[0];
    if (!nextYear) return feedback('No later year is available for this catalog.', true);
    if (!appState.graphRuntime) return feedback('The current graph is still loading.', true);

    const snapshot = appState.graphRuntime.snapshot();
    const nextPassed = [...new Set([...(snapshot.passed || []), ...(snapshot.selected || [])])];
    clearSharedSettingId();
    appState.loadedSetting = null;
    appState.settingsName = '';
    await renderCatalog(currentCatalog.id, { ...snapshot, catalogId: currentCatalog.id, year: nextYear, selected: [], passed: nextPassed });
    feedback(`Advanced to ${nextYear}. Selected modules are now marked as passed.`);
  };

  const switchToSettingPreview = async (setting: SavedStateRecord, switchCatalog = false, switchYear = false) => {
    const hydrated = await hydrateSetting(setting);
    if (!hydrated) return;
    const { restoredState } = canPreviewSetting(appState, hydrated);
    if (!restoredState) return;
    const nextCatalogId = switchCatalog ? restoredState.catalogId : appState.currentCatalogId;
    await renderCatalog(nextCatalogId!, { ...restoredState, catalogId: nextCatalogId, year: switchYear ? restoredState.year : appState.currentYear });
    appState.selectedPlanId = String(hydrated.id);
    publish();
    await previewSavedPlan(String(hydrated.id));
  };

  const previewSavedPlan = async (planId: string) => {
    appState.selectedPlanId = planId;
    publish();
    if (!planId) {
      appState.graphRuntime?.setPreviewState(null);
      return feedback('');
    }
    const hydrated = await hydrateSetting(getSelectedSavedSetting());
    if (!hydrated) return;
    const { restoredState, needsCatalogSwitch, needsYearSwitch } = canPreviewSetting(appState, hydrated);
    if (needsCatalogSwitch) {
      appState.graphRuntime?.setPreviewState(null);
      return feedback(`Preview unavailable, please switch to ${getCatalogName(appState, restoredState?.catalogId || null)}.`, false, [{ label: 'Switch', onClick: () => switchToSettingPreview(hydrated, true, true) }]);
    }
    if (needsYearSwitch) {
      appState.graphRuntime?.setPreviewState(null);
      return feedback(`Preview unavailable, please switch to ${restoredState?.year}.`, false, [{ label: 'Switch', onClick: () => switchToSettingPreview(hydrated, false, true) }]);
    }
    appState.graphRuntime?.setPreviewState(restoredState);
    const slice = hydrated.state?.catalogs?.[restoredState?.catalogId]?.[restoredState?.year];
    feedback(`Preview: ${hydrated.name} - ${getCatalogName(appState, restoredState?.catalogId || null)} (${slice?.selected?.length || 0} selected, ${slice?.excluded?.length || 0} excluded)`);
  };

  const saveCurrentPlan = async (nameInput = appState.settingsName) => {
    const loadedSetting = appState.loadedSetting;
    const name = nameInput.trim() || loadedSetting?.name || '';
    if (!name) return feedback('Enter a name before saving.', true);
    if (!appState.graphRuntime) return feedback('The current graph is still loading.', true);

    const snap = appState.graphRuntime.snapshot();
    const seed: SavedStateBlob = { version: 2, catalogs: { [snap.catalogId]: { [snap.year]: { selected: snap.selected, passed: snap.passed, excluded: snap.excluded, hiddenLevels: snap.hiddenLevels } } } };
    const isCloneFromView = Boolean(loadedSetting && loadedSetting.role === 'view' && name === loadedSetting.name);

    let saved: SavedStateRecord;
    let action = 'Saved';
    if (isCloneFromView) {
      saved = await savedStatesApi.create({ name, state: seed });
      action = 'Cloned';
    } else if (loadedSetting && name === loadedSetting.name && loadedSetting.role !== 'view') {
      saved = await savedStatesApi.updateSlice(loadedSetting.id, { name, slice: { catalogId: snap.catalogId, year: snap.year, selected: snap.selected, passed: snap.passed, excluded: snap.excluded, hiddenLevels: snap.hiddenLevels } });
      action = 'Updated';
    } else {
      saved = await savedStatesApi.create({ name, state: seed });
    }

    appState.settingsName = '';
    appState.loadedSetting = saved;
    setSharedSettingId(saved.id);
    await refreshSettings(String(saved.id));
    feedback(`${action} "${saved.name}".`);
  };

  const loadSelectedPlan = async () => {
    const current = getSelectedSavedSetting();
    if (!current) return feedback('Choose a saved setting to load.', true);
    const full = await savedStatesApi.get(current.id);
    const restoredState = getRestoredSettingState(appState, full);
    await renderCatalog(restoredState!.catalogId!, restoredState!);
    appState.loadedSetting = full;
    appState.settingsName = '';
    setSharedSettingId(full.id);
    feedback(`Loaded "${full.name}".`);
  };

  const deleteSelectedPlan = async () => {
    const current = getSelectedSavedSetting();
    const loadedSetting = appState.loadedSetting;
    if (!current) return feedback('Choose a saved setting to delete.', true);
    if (current.role !== 'owner' && current.role !== 'admin') return feedback('Only the owner or an admin can delete this plan.', true);
    await savedStatesApi.remove(current.id);
    await refreshSettings();
    appState.graphRuntime?.setPreviewState(null);
    if (appState.sharedSettingId === String(current.id)) clearSharedSettingId();
    if (loadedSetting && loadedSetting.id === current.id) {
      appState.loadedSetting = null;
      appState.settingsName = '';
    }
    feedback(`Deleted "${current.name}".`);
  };

  const shareLoadedPlan = async () => {
    const loaded = appState.loadedSetting;
    if (!loaded) return feedback('Save or load a plan before sharing it.', true);
    if (loaded.role !== 'owner' && loaded.role !== 'admin') return feedback('Only the owner or an admin can manage sharing.', true);
    await openShareDialog({
      savedStatesApi,
      state: loaded,
      currentUser: window.__currentUser,
      onChange: async () => {
        const refreshed = await savedStatesApi.get(loaded.id).catch(() => null);
        if (refreshed) appState.loadedSetting = refreshed;
        await refreshSettings(String(loaded.id)).catch(() => {});
      },
    });
  };

  const setSearchQuery = (query: string) => {
    appState.searchQuery = query;
    appState.graphRuntime?.setSearchQuery(query);
    publish();
  };

  const setHiddenLevels = (levels: Set<string>) => {
    appState.hiddenLevels = new Set(levels);
    appState.graphRuntime?.setHiddenLevels(levels);
    publish();
  };

  const setSettingsName = (name: string) => {
    appState.settingsName = name;
    publish();
  };

  const clearAll = () => appState.graphRuntime?.clearAll();
  const setTheme = (theme: 'dark' | 'light') => {
    appState.theme = theme;
    localStorage.setItem('moduleGraphTheme', theme);
    publish();
  };
  const toggleTheme = () => setTheme(appState.theme === 'light' ? 'dark' : 'light');

  useEffect(() => {
    let cancelled = false;
    const boot = async () => {
      try {
        appState.catalogs = await listCatalogs();
        if (!appState.catalogs.length) throw new Error('No catalogs available.');

        const { subject, year, sessionId } = parseUrl();
        if (sessionId) {
          try {
            const setting = await savedStatesApi.get(sessionId);
            if (cancelled) return;
            const restoredState = getRestoredSettingState(appState, setting);
            appState.loadedSetting = setting;
            appState.sharedSettingId = String(setting.id);
            appState.isSubjectSelection = false;
            await renderCatalog(restoredState!.catalogId!, restoredState!);
          } catch (error: any) {
            if (error.status === 403 || error.code === 'FORBIDDEN') {
              await showRequestAccessOverlay(sessionId, { savedStatesApi });
              return;
            }
            appState.sharedSettingId = null;
            feedback(`Shared session unavailable: ${error.message}`, true);
            if (subject) {
              const catalog = appState.catalogs.find((entry) => entry.id === subject);
              if (catalog) {
                appState.isSubjectSelection = false;
                await renderCatalog(catalog.id, year);
              } else {
                appState.isSubjectSelection = true;
              }
            } else {
              appState.isSubjectSelection = true;
            }
          }
        } else if (subject) {
          const catalog = appState.catalogs.find((entry) => entry.id === subject);
          if (catalog) {
            appState.isSubjectSelection = false;
            await renderCatalog(catalog.id, year);
          } else {
            appState.isSubjectSelection = true;
          }
        } else {
          appState.isSubjectSelection = true;
        }

        await refreshSettings(appState.sharedSettingId || '').catch((error) => feedback(`Saved settings unavailable: ${(error as Error).message}`, true));
        setTheme(getStoredTheme());
      } catch (error) {
        appState.statusMarkup = `<div class="status-row status-row--single"><span class="status-empty">${(error as Error).message}</span></div>`;
        publish();
      }
    };

    boot();
    return () => {
      cancelled = true;
    };
  }, []);

  const viewModel = useMemo(() => buildViewModel(appState), [appState.catalogs, appState.currentCatalogId, appState.currentYear, appState.feedbackActions, appState.feedbackMarkup, appState.hiddenLevels, appState.isSubjectSelection, appState.loadedSetting, appState.searchQuery, appState.selectedPlanId, appState.settingsCache, appState.settingsName, appState.statusMarkup, appState.theme]);

  return {
    appState,
    loadedGraph,
    viewModel,
    actions: {
      onRuntimeReady(runtime: GraphRuntime) {
        appState.graphRuntime = runtime;
        runtime.syncUi();
        syncSelectedSettingPreview();
      },
      onStatusMarkupChange(markup: string) {
        appState.statusMarkup = markup;
        publish();
      },
      showSubjectSelection() {
        clearSharedSettingId();
        updateUrl(null, null, null);
        appState.isSubjectSelection = true;
        publish();
      },
      toggleTheme,
      clearAll,
      setSearchQuery,
      setHiddenLevels,
      setSettingsName,
      selectSubject,
      selectCatalog,
      selectYear,
      advanceYear,
      previewSavedPlan,
      loadSelectedPlan,
      saveCurrentPlan,
      deleteSelectedPlan,
      shareLoadedPlan,
      clearSharedSettingId,
    },
  };
}
