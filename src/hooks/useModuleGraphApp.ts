import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { openShareDialog } from "../components/ShareDialog";
import { showRequestAccessOverlay } from "../components/RequestAccessOverlay";
import { listCatalogs, loadGraphData, searchModules } from "../dataLoader";
import { savedStatesApi } from "../savedStatesApi";
import { loadLegendColorsFromStorage } from "../constants";
import type { GraphRuntime } from "../types/runtime.types";
import type { ModuleSearchResult } from "../types/graph.types";
import type {
  SavedStateBlob,
  SavedStateRecord,
  SavedStateSlice,
} from "../types/saved-state.types";
import {
  buildViewModel,
  canPreviewSetting,
  getCatalogName,
  getRestoredSettingState,
  getStoredTheme,
  parseUrl,
  publishAppShell,
  showFeedback,
  updateUrl,
} from "./moduleGraph.helpers";
import { createModuleGraphState } from "./moduleGraph.state";
import type { LoadedGraph } from "./moduleGraph.types";

export function useModuleGraphApp(userId: string | null) {
  const navigate = useNavigate();
  const [appState] = useState(createModuleGraphState);
  const [loadedGraph, setLoadedGraph] = useState<LoadedGraph | null>(null);
  const [, setVersion] = useState(0);

  const refresh = () => setVersion((value) => value + 1);
  const publish = () => publishAppShell(appState, refresh);
  const feedback = (
    message: string,
    isError = false,
    actions: Parameters<typeof showFeedback>[4] = [],
  ) => showFeedback(appState, refresh, message, isError, actions);

  const setSharedSettingId = (
    settingId: string | number | null | undefined,
  ) => {
    appState.sharedSettingId = settingId ? String(settingId) : null;
    updateUrl(
      appState.currentCatalogId,
      appState.currentYear,
      appState.sharedSettingId,
    );
  };

  const clearSharedSettingId = () => {
    if (!appState.sharedSettingId) return;
    appState.sharedSettingId = null;
    updateUrl(appState.currentCatalogId, appState.currentYear, null);
  };

  const getSelectedSavedSetting = () =>
    appState.settingsCache.find(
      (setting) => String(setting.id) === appState.selectedPlanId,
    ) || null;

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

  const refreshSettings = async (selectedId = "") => {
    const listedStates = await savedStatesApi.list();
    appState.settingsCache = Array.isArray(listedStates) ? listedStates : [];
    appState.selectedPlanId = selectedId;
    publish();
  };

  const syncSelectedSettingPreview = () => {
    const selectedSetting = getSelectedSavedSetting();
    if (!selectedSetting || !appState.graphRuntime) {
      appState.graphRuntime?.setPreviewState(null);
      return;
    }
    const { restoredState, needsCatalogSwitch, needsYearSwitch } =
      canPreviewSetting(appState, selectedSetting);
    appState.graphRuntime.setPreviewState(
      needsCatalogSwitch || needsYearSwitch ? null : restoredState,
    );
  };

  const renderCatalog = async (
    catalogId: string,
    yearOrState:
      | string
      | (SavedStateSlice & { catalogId?: string; year?: string | null })
      | null = null,
    maybeRestoredState:
      | (SavedStateSlice & { catalogId?: string; year?: string | null })
      | null = null,
  ) => {
    const restoredState =
      maybeRestoredState ||
      (yearOrState && typeof yearOrState === "object" ? yearOrState : null);
    const selectedYear =
      restoredState?.year ||
      (typeof yearOrState === "string" ? yearOrState : appState.currentYear);
    const {
      catalog,
      selectedYear: resolvedYear,
      nodes,
      prereqRules,
      edges,
    } = await loadGraphData(catalogId, selectedYear);
    appState.currentCatalogId = catalog.id;
    appState.currentYear = resolvedYear;
    appState.hiddenLevels = new Set(
      restoredState?.hiddenLevels ?? [...appState.hiddenLevels],
    );
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
    appState.settingsName = "";
    await renderCatalog(catalogId, appState.currentYear);
    feedback(`Showing ${getCatalogName(appState, catalogId)}.`);
  };

  const selectYear = async (year: string) => {
    appState.currentYear = year;
    clearSharedSettingId();
    appState.loadedSetting = null;
    appState.settingsName = "";
    await renderCatalog(
      appState.currentCatalogId || appState.catalogs[0]?.id || "",
      year,
    );
    feedback(`Showing ${year}.`);
  };

  const advanceYear = async () => {
    const currentCatalog =
      appState.catalogs.find(
        (catalog) => catalog.id === appState.currentCatalogId,
      ) || appState.catalogs[0];
    const years = currentCatalog?.years || [];
    const currentIndex = years.indexOf(appState.currentYear || "");
    const nextYear = currentIndex >= 0 ? years[currentIndex + 1] : years[0];
    if (!nextYear)
      return feedback("No later year is available for this catalog.", true);
    if (!appState.graphRuntime)
      return feedback("The current graph is still loading.", true);

    const snapshot = appState.graphRuntime.snapshot();
    const nextPassed = [
      ...new Set([...(snapshot.passed || []), ...(snapshot.selected || [])]),
    ];
    clearSharedSettingId();
    appState.loadedSetting = null;
    appState.settingsName = "";
    await renderCatalog(currentCatalog.id, {
      ...snapshot,
      catalogId: currentCatalog.id,
      year: nextYear,
      selected: [],
      passed: nextPassed,
    });
    feedback(
      `Advanced to ${nextYear}. Selected modules are now marked as passed.`,
    );
  };

  const switchToSettingPreview = async (
    setting: SavedStateRecord,
    switchCatalog = false,
    switchYear = false,
  ) => {
    const hydrated = await hydrateSetting(setting);
    if (!hydrated) return;
    const { restoredState } = canPreviewSetting(appState, hydrated);
    if (!restoredState) return;
    const nextCatalogId = switchCatalog
      ? restoredState.catalogId
      : appState.currentCatalogId;
    await renderCatalog(nextCatalogId!, {
      ...restoredState,
      catalogId: nextCatalogId,
      year: switchYear ? restoredState.year : appState.currentYear,
    });
    appState.selectedPlanId = String(hydrated.id);
    publish();
    await previewSavedPlan(String(hydrated.id));
  };

  const previewSavedPlan = async (planId: string) => {
    appState.selectedPlanId = planId;
    publish();
    if (!planId) {
      appState.graphRuntime?.setPreviewState(null);
      return feedback("");
    }
    const hydrated = await hydrateSetting(getSelectedSavedSetting());
    if (!hydrated) return;
    const { restoredState, needsCatalogSwitch, needsYearSwitch } =
      canPreviewSetting(appState, hydrated);
    if (needsCatalogSwitch) {
      appState.graphRuntime?.setPreviewState(null);
      return feedback(
        `Preview unavailable, please switch to ${getCatalogName(appState, restoredState?.catalogId || null)}.`,
        false,
        [
          {
            label: "Switch",
            onClick: () => switchToSettingPreview(hydrated, true, true),
          },
        ],
      );
    }
    if (needsYearSwitch) {
      appState.graphRuntime?.setPreviewState(null);
      return feedback(
        `Preview unavailable, please switch to ${restoredState?.year}.`,
        false,
        [
          {
            label: "Switch",
            onClick: () => switchToSettingPreview(hydrated, false, true),
          },
        ],
      );
    }
    appState.graphRuntime?.setPreviewState(restoredState);
    const slice =
      hydrated.state?.catalogs?.[restoredState?.catalogId]?.[
        restoredState?.year
      ];
    feedback(
      `Preview: ${hydrated.name} - ${getCatalogName(appState, restoredState?.catalogId || null)} (${slice?.selected?.length || 0} selected, ${slice?.excluded?.length || 0} excluded)`,
    );
  };

  const saveCurrentPlan = async (nameInput = appState.settingsName) => {
    try {
      if (!appState.userId) {
        const next = encodeURIComponent(
          window.location.pathname + window.location.search,
        );
        feedback("Sign in or create an account to save plans.", false, [
          {
            label: "Log in",
            onClick: () => navigate(`/login?next=${next}`),
          },
          {
            label: "Create account",
            onClick: () => navigate(`/signup?next=${next}`),
          },
        ]);
        return;
      }
      const loadedSetting = appState.loadedSetting;
      const name = nameInput.trim() || loadedSetting?.name || "";
      if (!name) return feedback("Enter a name before saving.", true);
      if (!appState.graphRuntime)
        return feedback("The current graph is still loading.", true);

      const snap = appState.graphRuntime.snapshot();
      const seed: SavedStateBlob = {
        version: 2,
        catalogs: {
          [snap.catalogId]: {
            [snap.year]: {
              selected: snap.selected,
              passed: snap.passed,
              excluded: snap.excluded,
              hiddenLevels: snap.hiddenLevels,
            },
          },
        },
      };
      const isCloneFromView = Boolean(
        loadedSetting &&
        loadedSetting.role === "view" &&
        name === loadedSetting.name,
      );

      let saved: SavedStateRecord;
      let action = "Saved";
      if (isCloneFromView) {
        saved = await savedStatesApi.create({ name, state: seed });
        action = "Cloned";
      } else if (
        loadedSetting &&
        name === loadedSetting.name &&
        loadedSetting.role !== "view"
      ) {
        saved = await savedStatesApi.updateSlice(loadedSetting.id, {
          name,
          slice: {
            catalogId: snap.catalogId,
            year: snap.year,
            selected: snap.selected,
            passed: snap.passed,
            excluded: snap.excluded,
            hiddenLevels: snap.hiddenLevels,
          },
        });
        action = "Updated";
      } else {
        saved = await savedStatesApi.create({ name, state: seed });
      }

      appState.settingsName = "";
      appState.loadedSetting = saved;
      setSharedSettingId(saved.id);
      await refreshSettings(String(saved.id));
      feedback(`${action} "${saved.name}".`);
      window.alert(`${action} "${saved.name}" successfully.`);
    } catch (error) {
      const message = (error as Error).message || "Could not save plan.";
      feedback(message, true);
      window.alert(`Save failed: ${message}`);
    }
  };

  const loadSelectedPlan = async () => {
    const current = getSelectedSavedSetting();
    if (!current) return feedback("Choose a saved setting to load.", true);
    const full = await savedStatesApi.get(current.id);
    const restoredState = getRestoredSettingState(appState, full);
    await renderCatalog(restoredState!.catalogId!, restoredState!);
    appState.loadedSetting = full;
    appState.settingsName = "";
    setSharedSettingId(full.id);
    feedback(`Loaded "${full.name}".`);
  };

  const deleteSelectedPlan = async () => {
    if (!appState.userId)
      return feedback("Please sign in to manage saved plans.", true);
    const current = getSelectedSavedSetting();
    const loadedSetting = appState.loadedSetting;
    if (!current) return feedback("Choose a saved setting to delete.", true);
    if (current.role !== "owner" && current.role !== "admin")
      return feedback("Only the owner or an admin can delete this plan.", true);
    await savedStatesApi.remove(current.id);
    await refreshSettings();
    appState.graphRuntime?.setPreviewState(null);
    if (appState.sharedSettingId === String(current.id)) clearSharedSettingId();
    if (loadedSetting && loadedSetting.id === current.id) {
      appState.loadedSetting = null;
      appState.settingsName = "";
    }
    feedback(`Deleted "${current.name}".`);
  };

  const shareLoadedPlan = async () => {
    try {
      if (!appState.userId)
        return feedback("Please sign in to manage sharing.", true);
      const loaded = appState.loadedSetting;
      if (!loaded)
        return feedback("Save or load a plan before sharing it.", true);
      if (loaded.role !== "owner" && loaded.role !== "admin")
        return feedback("Only the owner or an admin can manage sharing.", true);
      await openShareDialog({
        savedStatesApi,
        state: loaded,
        currentUser: window.__currentUser,
        onChange: async () => {
          const refreshed = await savedStatesApi
            .get(loaded.id)
            .catch(() => null);
          if (refreshed) appState.loadedSetting = refreshed;
          await refreshSettings(String(loaded.id)).catch(() => {});
        },
      });
    } catch (error) {
      const message =
        (error as Error).message || "Could not open sharing dialog.";
      feedback(message, true);
      window.alert(`Share unavailable: ${message}`);
    }
  };

  const setSearchQuery = (query: string) => {
    appState.searchQuery = query;
    appState.graphRuntime?.setSearchQuery(query);
    if (!query.trim()) {
      appState.searchResults = [];
      appState.graphRuntime?.setSearchHover(null);
    }
    publish();
  };

  const setSearchHover = (nodeId: string | null) => {
    appState.graphRuntime?.setSearchHover(nodeId);
  };

  const clearSearch = () => {
    appState.searchQuery = "";
    appState.searchResults = [];
    appState.graphRuntime?.setSearchHover(null);
    appState.graphRuntime?.setSearchQuery("");
    publish();
  };

  const selectSearchResult = async (result: ModuleSearchResult) => {
    const targetCatalogId = result.catalogId;
    const currentYear = appState.currentYear;
    appState.pendingSearchFocusNodeId = result.moduleId;
    appState.searchQuery = result.moduleId;
    appState.graphRuntime?.setSearchHover(null);

    if (appState.currentCatalogId !== targetCatalogId) {
      clearSharedSettingId();
      appState.loadedSetting = null;
      appState.settingsName = "";
      await renderCatalog(targetCatalogId, currentYear);
      feedback(
        `Showing ${result.catalogName} and focusing ${result.moduleId}.`,
      );
      return;
    }

    const activated = appState.graphRuntime?.activateNodeById(result.moduleId);
    if (activated) {
      appState.pendingSearchFocusNodeId = null;
      publish();
    }
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
  const setTheme = (theme: "dark" | "light") => {
    appState.theme = theme;
    localStorage.setItem("moduleGraphTheme", theme);
    publish();
  };
  const toggleTheme = () =>
    setTheme(appState.theme === "light" ? "dark" : "light");
  const refreshGraphColors = () => {
    appState.graphRuntime?.refreshColors();
    publish();
  };

  useEffect(() => {
    if (appState.isSubjectSelection || !appState.searchQuery.trim()) {
      if (appState.searchResults.length > 0) {
        appState.searchResults = [];
        publish();
      }
      return;
    }

    let cancelled = false;
    const query = appState.searchQuery;
    const year = appState.currentYear;

    searchModules(query, year)
      .then((results) => {
        if (cancelled) return;
        if (appState.searchQuery !== query || appState.currentYear !== year) {
          return;
        }
        appState.searchResults = results;
        publish();
      })
      .catch(() => {
        if (cancelled) return;
        appState.searchResults = [];
        publish();
      });

    return () => {
      cancelled = true;
    };
  }, [appState.currentYear, appState.isSubjectSelection, appState.searchQuery]);

  useEffect(() => {
    let cancelled = false;
    const boot = async () => {
      try {
        appState.catalogs = await listCatalogs();
        if (!appState.catalogs.length)
          throw new Error("No catalogs available.");

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
            if (error.status === 403 || error.code === "FORBIDDEN") {
              await showRequestAccessOverlay(sessionId, { savedStatesApi });
              return;
            }
            appState.sharedSettingId = null;
            feedback(`Shared session unavailable: ${error.message}`, true);
            if (subject) {
              const catalog = appState.catalogs.find(
                (entry) => entry.id === subject,
              );
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
          const catalog = appState.catalogs.find(
            (entry) => entry.id === subject,
          );
          if (catalog) {
            appState.isSubjectSelection = false;
            await renderCatalog(catalog.id, year);
          } else {
            appState.isSubjectSelection = true;
          }
        } else {
          appState.isSubjectSelection = true;
        }

        await refreshSettings(appState.sharedSettingId || "").catch((error) => {
          if (appState.userId) {
            feedback(
              `Saved settings unavailable: ${(error as Error).message}`,
              true,
            );
          } else {
            appState.settingsCache = [];
            appState.selectedPlanId = "";
            publish();
          }
        });
        loadLegendColorsFromStorage();
        setTheme(getStoredTheme());
        refreshGraphColors();
      } catch (error) {
        appState.statusMarkup = `<div class="status-row status-row--single"><span class="status-empty">${(error as Error).message}</span></div>`;
        publish();
      }
    };

    boot();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const onRuntimeReady = useCallback(
    (runtime: GraphRuntime) => {
      appState.graphRuntime = runtime;
      runtime.syncUi();
      runtime.setSearchQuery(appState.searchQuery);
      runtime.setSearchHover(null);
      if (appState.pendingSearchFocusNodeId) {
        const focused = runtime.activateNodeById(
          appState.pendingSearchFocusNodeId,
        );
        if (focused) {
          appState.pendingSearchFocusNodeId = null;
        }
      }
      syncSelectedSettingPreview();
    },
    [appState],
  );

  useEffect(() => {
    appState.userId = userId;
    if (!userId) {
      appState.loadedSetting = null;
      appState.settingsName = "";
    }
    refreshSettings(appState.sharedSettingId || "").catch(() => {});
    publish();
  }, [appState, userId]);

  const onStatusMarkupChange = useCallback(
    (markup: string) => {
      appState.statusMarkup = markup;
      publish();
    },
    [appState],
  );

  const showSubjectSelection = useCallback(() => {
    clearSharedSettingId();
    updateUrl(null, null, null);
    appState.isSubjectSelection = true;
    publish();
  }, [appState]);

  const viewModel = useMemo(
    () => buildViewModel(appState),
    [
      appState.catalogs,
      appState.currentCatalogId,
      appState.currentYear,
      appState.feedbackActions,
      appState.feedbackMarkup,
      appState.hiddenLevels,
      appState.isSubjectSelection,
      appState.loadedSetting,
      appState.searchQuery,
      appState.searchResults,
      appState.selectedPlanId,
      appState.settingsCache,
      appState.settingsName,
      appState.statusMarkup,
      appState.theme,
    ],
  );

  return {
    appState,
    loadedGraph,
    viewModel,
    actions: {
      onRuntimeReady,
      onStatusMarkupChange,
      showSubjectSelection,
      toggleTheme,
      clearAll,
      setSearchQuery,
      clearSearch,
      setSearchHover,
      selectSearchResult,
      setHiddenLevels,
      refreshGraphColors,
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
