import React from "react";
import {
  CalendarDays,
  FolderOpen,
  Forward,
  Save,
  Share2,
  Trash2,
  Upload,
} from "lucide-react";

type FeedbackAction = { label: string; onClick: () => void };

type Catalog = {
  id: string;
  name: string;
  years: string[];
};

type SavedPlan = { id: string; label: string };

type SavedSettingsPanelProps = {
  catalogs: Catalog[];
  selectedCatalogId: string;
  selectedYear: string;
  settingsName: string;
  settingsPlaceholder: string;
  saveLabel: string;
  canSave: boolean;
  savedPlans: SavedPlan[];
  selectedPlanId: string;
  shareVisible: boolean;
  shareDisabled: boolean;
  deleteDisabled: boolean;
  viewOnlyBadge: string;
  feedbackMarkup: string;
  feedbackActions: FeedbackAction[];
  onSelectCatalog: (catalogId: string) => void;
  onSelectYear: (year: string) => void;
  onAdvanceYear: () => void;
  onSetSettingsName: (name: string) => void;
  onSaveCurrentPlan: (name: string) => void;
  onPreviewSavedPlan: (planId: string) => void;
  onLoadSelectedPlan: () => void;
  onShareLoadedPlan: () => void;
  onDeleteSelectedPlan: () => void;
};

export function SavedSettingsPanel({
  catalogs,
  selectedCatalogId,
  selectedYear,
  settingsName,
  settingsPlaceholder,
  saveLabel,
  canSave,
  savedPlans,
  selectedPlanId,
  shareVisible,
  shareDisabled,
  deleteDisabled,
  viewOnlyBadge,
  feedbackMarkup,
  feedbackActions,
  onSelectCatalog,
  onSelectYear,
  onAdvanceYear,
  onSetSettingsName,
  onSaveCurrentPlan,
  onPreviewSavedPlan,
  onLoadSelectedPlan,
  onShareLoadedPlan,
  onDeleteSelectedPlan,
}: SavedSettingsPanelProps) {
  const selectedCatalogYears =
    catalogs.find((catalog) => catalog.id === selectedCatalogId)?.years || [];

  return (
    <section id="saved-settings-panel" aria-label="Saved settings">
      <div className="saved-settings-shell">
        <div className="saved-settings-headline" aria-hidden="true">
          <span>St Andrews Planner Workspace</span>
        </div>
        <div className="planner-panel-grid">
          <div className="saved-settings-copy saved-settings-card">
            <strong>Planner workspace</strong>
            <span>
              Switch catalogs, move through years, and save module combinations
              for later review.
            </span>
            <div className="saved-settings-pills" aria-hidden="true">
              <span>Catalogs</span>
              <span>Years</span>
              <span>Saved plans</span>
            </div>
          </div>
          <div className="saved-settings-controls saved-settings-controls--catalogs saved-settings-card">
            <label className="field-group" htmlFor="catalog-select">
              <span>
                <FolderOpen size={13} aria-hidden="true" />
                Catalog
              </span>
              <select
                id="catalog-select"
                aria-label="Course catalog"
                value={selectedCatalogId}
                onChange={(event) => onSelectCatalog(event.target.value)}
              >
                {catalogs.map((catalog) => (
                  <option key={catalog.id} value={catalog.id}>
                    {catalog.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="field-group" htmlFor="year-select">
              <span>
                <CalendarDays size={13} aria-hidden="true" />
                Year
              </span>
              <select
                id="year-select"
                aria-label="Academic year"
                value={selectedYear}
                onChange={(event) => onSelectYear(event.target.value)}
              >
                {selectedCatalogYears.map((year) => (
                  <option key={year} value={year}>
                    {year}
                  </option>
                ))}
              </select>
            </label>
            <button id="next-year" type="button" onClick={onAdvanceYear}>
              <Forward size={14} aria-hidden="true" />
              Next year
            </button>
            <form
              id="settings-form"
              className="settings-form"
              onSubmit={(event) => {
                event.preventDefault();
                onSaveCurrentPlan(settingsName);
              }}
            >
              <input
                id="settings-name"
                name="name"
                type="text"
                maxLength={80}
                placeholder={settingsPlaceholder}
                value={settingsName}
                autoComplete="off"
                onChange={(event) => onSetSettingsName(event.target.value)}
              />
              <button id="save-settings" type="submit">
                <Save size={14} aria-hidden="true" />
                {canSave ? saveLabel : "Sign in to save"}
              </button>
            </form>
          </div>
          <div className="saved-settings-controls saved-settings-controls--plans saved-settings-card">
            <select
              id="saved-settings-list"
              aria-label="Saved plans list"
              value={selectedPlanId}
              onChange={(event) => onPreviewSavedPlan(event.target.value)}
            >
              {!savedPlans.length ? (
                <option value="">No saved plans yet</option>
              ) : (
                <option value="" />
              )}
              {savedPlans.map((plan) => (
                <option key={plan.id} value={plan.id}>
                  {plan.label}
                </option>
              ))}
            </select>
            <button
              id="load-settings"
              type="button"
              onClick={onLoadSelectedPlan}
            >
              <Upload size={14} aria-hidden="true" />
              Load
            </button>
            <button
              id="share-settings"
              type="button"
              style={{ display: shareVisible ? undefined : "none" }}
              aria-disabled={shareDisabled}
              title={
                shareDisabled
                  ? "You do not have permission to share this plan"
                  : undefined
              }
              onClick={onShareLoadedPlan}
            >
              <Share2 size={14} aria-hidden="true" />
              Share
            </button>
            <button
              id="delete-settings"
              type="button"
              className="clear-btn"
              disabled={deleteDisabled}
              onClick={onDeleteSelectedPlan}
            >
              <Trash2 size={14} aria-hidden="true" />
              Delete
            </button>
          </div>
        </div>
        <div
          id="view-only-badge"
          className="view-only-badge"
          style={{ display: viewOnlyBadge ? undefined : "none" }}
          role="status"
        >
          {viewOnlyBadge}
        </div>
        <div id="settings-feedback" aria-live="polite">
          <span dangerouslySetInnerHTML={{ __html: feedbackMarkup }} />
          {feedbackActions.map((action) => (
            <button
              key={action.label}
              type="button"
              className="settings-feedback-action"
              onClick={action.onClick}
            >
              {action.label}
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
