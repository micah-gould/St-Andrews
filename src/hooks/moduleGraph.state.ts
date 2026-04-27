import type { AppState } from "../types/runtime.types";

export function createModuleGraphState(): AppState {
  return {
    catalogs: [],
    currentCatalogId: null,
    currentYear: null,
    settingsCache: [],
    selectedPlanId: "",
    settingsName: "",
    searchQuery: "",
    feedbackMarkup: "",
    feedbackActions: [],
    statusMarkup: "Loading module data...",
    loadedSetting: null,
    sharedSettingId: null,
    graphRuntime: null,
    outsideClickHandler: null,
    hiddenLevels: new Set(["ext", "5000"]),
    theme: "dark",
    isSubjectSelection: true,
  };
}
