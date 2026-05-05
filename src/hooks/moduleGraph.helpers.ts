import { emptySavedState, getSliceFor } from "../savedStatesApi";
import type { AppState, FeedbackAction } from "../types/runtime.types";
import type { SavedStateRecord } from "../types/saved-state.types";
import type { RestoredState } from "./moduleGraph.types";

export const THEME_KEY = "moduleGraphTheme";
export const SESSION_ID_PATTERN =
  /^(?:c[a-z0-9]{20,30}|[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})$/i;

export function getStoredTheme(): "dark" | "light" {
  return localStorage.getItem(THEME_KEY) === "light" ? "light" : "dark";
}

export function parseUrl() {
  const segments = window.location.pathname
    .split("/")
    .filter((segment) => segment.length > 0);
  let sessionId = null;
  if (
    segments.length &&
    SESSION_ID_PATTERN.test(segments[segments.length - 1])
  ) {
    sessionId = segments.pop() || null;
  }
  return {
    subject: segments[0] || null,
    year: segments.length > 1 ? segments[1] : null,
    sessionId,
  };
}

export function updateUrl(
  subject: string | null,
  year: string | null,
  sessionId: string | null,
) {
  let path = "/";
  if (subject) {
    path += subject;
    if (year) path += `/${year}`;
  }
  if (sessionId)
    path += `${path.endsWith("/") ? "" : "/"}${encodeURIComponent(sessionId)}`;
  window.history.replaceState({}, "", path);
}

export function publishAppShell(appState: AppState, refresh: () => void) {
  document.body.classList.toggle("theme-light", appState.theme === "light");
  document.body.dataset.theme = appState.theme;
  document.body.classList.toggle(
    "is-readonly",
    Boolean(appState.loadedSetting?.role === "view"),
  );
  refresh();
}

export function showFeedback(
  appState: AppState,
  refresh: () => void,
  message: string,
  isError = false,
  actions: FeedbackAction[] = [],
) {
  appState.feedbackMarkup = isError
    ? `<span data-state="error">${message}</span>`
    : message;
  appState.feedbackActions = actions;
  publishAppShell(appState, refresh);
}

export function firstCatalogInSaved(setting: SavedStateRecord | null) {
  return setting?.state?.catalogs
    ? Object.keys(setting.state.catalogs)[0] || null
    : null;
}

export function firstYearInSaved(
  setting: SavedStateRecord | null,
  catalogId: string | null,
) {
  const years = setting?.state?.catalogs?.[catalogId];
  return years ? Object.keys(years)[0] || null : null;
}

export function getCatalogName(appState: AppState, catalogId: string | null) {
  return (
    appState.catalogs.find((catalog) => catalog.id === catalogId)?.name ||
    catalogId
  );
}

export function getRestoredSettingState(
  appState: AppState,
  setting: SavedStateRecord | null,
  { catalogId, year }: { catalogId?: string | null; year?: string | null } = {},
): RestoredState | null {
  if (!setting) return null;
  const chosenCatalog =
    catalogId ||
    (setting.state?.catalogs?.[appState.currentCatalogId]
      ? appState.currentCatalogId
      : null) ||
    firstCatalogInSaved(setting) ||
    appState.currentCatalogId ||
    appState.catalogs[0]?.id ||
    null;
  const chosenYear =
    year ||
    (setting.state?.catalogs?.[chosenCatalog]?.[appState.currentYear]
      ? appState.currentYear
      : null) ||
    firstYearInSaved(setting, chosenCatalog) ||
    appState.currentYear ||
    null;
  const slice = getSliceFor(
    setting.state || emptySavedState(),
    chosenCatalog,
    chosenYear,
  );
  return { ...slice, catalogId: chosenCatalog, year: chosenYear };
}

export function canPreviewSetting(
  appState: AppState,
  setting: SavedStateRecord,
) {
  const restoredState = getRestoredSettingState(appState, setting);
  const needsCatalogSwitch = Boolean(
    restoredState?.catalogId &&
    restoredState.catalogId !== appState.currentCatalogId,
  );
  const needsYearSwitch = Boolean(
    restoredState?.year && restoredState.year !== appState.currentYear,
  );
  return { restoredState, needsCatalogSwitch, needsYearSwitch };
}

export function buildViewModel(appState: AppState) {
  const currentCatalog =
    appState.catalogs.find(
      (catalog) => catalog.id === appState.currentCatalogId,
    ) || null;
  const loadedSetting = appState.loadedSetting;
  const effectiveName =
    appState.settingsName.trim() || loadedSetting?.name || "";
  const sameName = Boolean(
    loadedSetting && effectiveName === loadedSetting.name,
  );
  const viewOnly = Boolean(loadedSetting && loadedSetting.role === "view");
  const canShare = Boolean(
    loadedSetting &&
    (loadedSetting.role === "owner" || loadedSetting.role === "admin"),
  );
  const canDelete = Boolean(
    loadedSetting &&
    (loadedSetting.role === "owner" || loadedSetting.role === "admin"),
  );
  const visibleLevels = ["1000", "2000", "3000", "4000", "5000", "ext"].filter(
    (level) => !appState.hiddenLevels.has(level),
  );

  return {
    currentTitle: currentCatalog?.name || "Modules",
    theme: appState.theme,
    searchQuery: appState.searchQuery,
    searchResults: appState.searchResults,
    subjects: appState.catalogs.map((catalog) => ({
      id: catalog.id,
      name: catalog.name,
    })),
    showSubjectSelection: appState.isSubjectSelection,
    catalogs: appState.catalogs,
    selectedCatalogId: appState.currentCatalogId || "",
    selectedYear: appState.currentYear || "",
    savedPlans: appState.settingsCache.map((setting) => {
      const counts = setting.counts || {
        selected: 0,
        excluded: 0,
        catalogs: 0,
      };
      const who = setting.isOwner ? "you" : setting.owner?.email || "shared";
      const roleTag =
        setting.role && setting.role !== "owner" ? ` · ${setting.role}` : "";
      return {
        id: String(setting.id),
        name: setting.name,
        label: `${setting.name} — ${counts.catalogs} subject${counts.catalogs === 1 ? "" : "s"}, ${counts.selected} selected (${who}${roleTag})`,
      };
    }),
    selectedPlanId: appState.selectedPlanId,
    settingsName: appState.settingsName,
    settingsPlaceholder: loadedSetting?.name || "e.g. first year plan",
    feedbackMarkup: appState.feedbackMarkup,
    feedbackActions: appState.feedbackActions,
    viewOnlyBadge: viewOnly
      ? `View only — shared by ${loadedSetting?.owner?.email || "the owner"}`
      : "",
    shareVisible: Boolean(loadedSetting),
    shareDisabled: !canShare,
    canSave: Boolean(appState.userId),
    deleteDisabled: !canDelete && Boolean(loadedSetting),
    saveLabel: viewOnly && sameName ? "Clone" : sameName ? "Update" : "Save",
    hiddenLevels: appState.hiddenLevels,
    visibleLevels,
    statusMarkup: appState.statusMarkup,
  };
}
