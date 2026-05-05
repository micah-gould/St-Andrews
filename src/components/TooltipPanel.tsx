import React, { useEffect, useRef, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import {
  Check,
  ChevronDown,
  ChevronUp,
  Pin,
  PinOff,
  X,
  XCircle,
} from "lucide-react";
import type { GraphNode, PrereqRule } from "../types/graph.types";

const tooltipRoots = new WeakMap<HTMLElement, Root>();

type TooltipGraphState = {
  computeEffectivelyExcluded: (manualExcluded: Set<string>) => Set<string>;
  getCoreqRequirementKind: (source: string, target: string) => string;
  getPrerequisitePathNodes: (id: string) => Set<string>;
  getAllAntiLinks: (id: string) => Set<string>;
  getSimplePathsFromRoots: (targetId: string, maxCount?: number) => string[][];
  getCorequisitePaths: (id: string) => string[][];
  getForwardPathStarts: (id: string) => Set<string>;
  getSimplePathsForward: (startId: string, maxCount?: number) => string[][];
};

type TooltipPanelProps = {
  node: GraphNode;
  prereqRules: Record<string, PrereqRule[]>;
  manualExcluded: Set<string>;
  selected: Set<string>;
  passed: Set<string>;
  graphState: TooltipGraphState;
  onSelectToggle: (node: GraphNode) => void;
  onPassedToggle: (node: GraphNode) => void;
  onExcludeToggle: (node: GraphNode) => void;
  isPinned: boolean;
  isCollapsed: boolean;
  onTogglePin: () => void;
  onToggleCollapsed: () => void;
  onClose: () => void;
};

function getCatalogUrl(moduleCode: string) {
  return `https://www.st-andrews.ac.uk/subjects/modules/search/?query=${encodeURIComponent(moduleCode)}`;
}

function formatPath(path: string[]) {
  return path.join(" -> ");
}

function getPathKind(path: string[], graphState: TooltipGraphState) {
  if (path.length < 2) {
    return "required";
  }

  return graphState.getCoreqRequirementKind(path[0], path[path.length - 1]);
}

function TooltipPanel({
  node,
  prereqRules,
  manualExcluded,
  selected,
  passed,
  graphState,
  onSelectToggle,
  onPassedToggle,
  onExcludeToggle,
  isPinned,
  isCollapsed,
  onTogglePin,
  onToggleCollapsed,
  onClose,
}: TooltipPanelProps) {
  const effExcl = graphState.computeEffectivelyExcluded(manualExcluded);
  const rules = prereqRules[node.id] || [];
  const isEffExcl = effExcl.has(node.id);
  const isManual = manualExcluded.has(node.id);
  const isSelected = selected.has(node.id);
  const isPassed = passed.has(node.id);
  const ancestors = [...graphState.getPrerequisitePathNodes(node.id)];
  const antiLinks = [...graphState.getAllAntiLinks(node.id)];
  const descriptionText = node.description || node.summary || "";
  const timetableText = node.plannedTimetable || "";
  const assessmentText = node.assessmentPattern || "";
  const availabilityLabel =
    node.availableInSelectedYear === false
      ? "Not running in selected year"
      : "Running in selected year";
  const yearList =
    Array.isArray(node.years) && node.years.length
      ? node.years.join(", ")
      : "Unknown";
  const availabilityNote =
    node.frequency === "every-year"
      ? "Appears in consecutive tracked years, so it is treated as running every year."
      : node.frequency === "alternate-a"
        ? "Appears to run in alternating years matching 2025/26 and 2027/28."
        : node.frequency === "alternate-b"
          ? "Appears to run in alternating years matching 2026/27."
          : "Tracked year data is incomplete or irregular.";
  const prereqPaths = graphState.getSimplePathsFromRoots(
    node.id,
    node.antiRequisiteSummary || antiLinks.length ? 3 : 1,
  );
  const coreqPaths = graphState.getCorequisitePaths(node.id);
  const forwardStarts = graphState.getForwardPathStarts(node.id);
  const forwardPaths = [];

  const statusKind = isSelected
    ? "selected"
    : isPassed
      ? "passed"
      : isManual
        ? "excluded"
        : isEffExcl
          ? "blocked"
          : "available";

  const statusLabel =
    statusKind === "selected"
      ? "Selected"
      : statusKind === "passed"
        ? "Marked passed"
        : statusKind === "excluded"
          ? "Excluded"
          : statusKind === "blocked"
            ? "Implicitly excluded"
            : "Available";

  forwardStarts.forEach((startId) => {
    graphState.getSimplePathsForward(startId, 3).forEach((path) => {
      if (forwardPaths.length < 3) {
        forwardPaths.push(path);
      }
    });
  });

  return (
    <div className="tip-shell">
      <div className="tip-header">
        <div>
          <div className="tip-id">{node.id}</div>
          <div className="tip-name">{node.name}</div>
        </div>
        <div className="tip-top-actions">
          <button
            className="tip-btn tip-btn--ghost"
            type="button"
            data-state={isPinned ? "active" : "idle"}
            onClick={(event) => {
              event.stopPropagation();
              onTogglePin();
            }}
          >
            {isPinned ? (
              <PinOff size={13} aria-hidden="true" />
            ) : (
              <Pin size={13} aria-hidden="true" />
            )}
            {isPinned ? "Unpin" : "Pin"}
          </button>
          {isPinned ? (
            <button
              className="tip-btn tip-btn--ghost"
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                onToggleCollapsed();
              }}
            >
              {isCollapsed ? (
                <ChevronDown size={13} aria-hidden="true" />
              ) : (
                <ChevronUp size={13} aria-hidden="true" />
              )}
              {isCollapsed ? "Expand" : "Collapse"}
            </button>
          ) : null}
          <button
            className="tip-close"
            type="button"
            aria-label="Close module info"
            onClick={(event) => {
              event.stopPropagation();
              onClose();
            }}
          >
            <X size={16} aria-hidden="true" />
          </button>
        </div>
      </div>

      <div className="tip-status-line">
        <span className="tip-status-chip" data-state={statusKind}>
          {statusLabel}
        </span>
        <span className="tip-meta">
          {node.credits ? `${node.credits} credits` : "Credits unknown"}
        </span>
        {isPinned ? <span className="tip-status-meta">Pinned</span> : null}
      </div>

      {!isCollapsed && (
        <>
          <div className="tip-summary-grid">
            <div className="tip-summary-card">
              <div className="tip-label">Catalog</div>
              <div className="tip-catalog-value">
                {node.isInSelectedCatalog
                  ? "Current catalog"
                  : node.primaryCatalogName || "Related catalog"}
              </div>
            </div>
            <div className="tip-summary-card">
              <div className="tip-label">Module page</div>
              <div className="tip-link">
                <a
                  href={getCatalogUrl(node.id)}
                  target="_blank"
                  rel="noreferrer"
                >
                  Open in St Andrews catalog
                </a>
              </div>
            </div>
          </div>

          {isEffExcl && !isManual ? (
            <div className="tip-alert tip-alert--blocked">
              Blocked - prerequisites unavailable
            </div>
          ) : null}
          {isManual ? (
            <div className="tip-alert tip-alert--excluded">
              Manually excluded
            </div>
          ) : null}

          <div className="tip-availability">
            <strong>{availabilityLabel}</strong>
            <div className="tip-availability-note">
              Years seen: {yearList}. {availabilityNote}
            </div>
          </div>

          {descriptionText ? (
            <div className="tip-section">
              <div className="tip-label">Description</div>
              <div className="tip-description">{descriptionText}</div>
            </div>
          ) : null}

          <div className="tip-section">
            <div className="tip-label">Semesters</div>
            {Array.isArray(node.semesters) && node.semesters.length ? (
              <div className="tip-semesters">
                {node.semesters.map((semester) => {
                  const running =
                    node.semesterAvailability?.[semester] !== false;
                  return (
                    <span
                      key={semester}
                      className="tip-semester-chip"
                      data-running={running}
                    >
                      {semester}
                    </span>
                  );
                })}
              </div>
            ) : (
              <div className="tip-availability-note">
                Semester data unavailable.
              </div>
            )}
          </div>

          {timetableText ? (
            <div className="tip-section">
              <div className="tip-label">Planned timetable</div>
              <div className="tip-detail-text">{timetableText}</div>
            </div>
          ) : null}

          <div className="tip-section">
            <div className="tip-label">Prerequisites</div>
            {node.prerequisiteSummary ? (
              <div>{node.prerequisiteSummary}</div>
            ) : rules.length ? (
              rules.map((rule, index) => {
                const badgeCls =
                  rule.type === "all" ? "tip-badge--all" : "tip-badge--one";
                const label = rule.type === "all" ? "need all" : "need one";
                return (
                  <div
                    key={`${node.id}-rule-${index}`}
                    className="tip-rule-line"
                  >
                    <span className={`tip-badge ${badgeCls}`}>{label}</span>
                    {rule.sources.map((source) => (
                      <span
                        key={source}
                        className={`tip-source ${effExcl.has(source) ? "tip-src-excl" : ""}`}
                      >
                        {source}
                      </span>
                    ))}
                  </div>
                );
              })
            ) : (
              <span className="tip-empty">None</span>
            )}
            {ancestors.length ? (
              <div className="tip-chain">
                Full chain: {ancestors.join(" -> ")}
              </div>
            ) : null}
          </div>

          {node.coRequisiteSummary ? (
            <div className="tip-coreq-note tip-alert">
              Co-reqs: {node.coRequisiteSummary}
            </div>
          ) : null}
          {node.antiRequisiteSummary ? (
            <div className="tip-anti-note tip-alert tip-alert--excluded">
              Anti-reqs: {node.antiRequisiteSummary}
            </div>
          ) : null}
          {!node.antiRequisiteSummary && antiLinks.length ? (
            <div className="tip-anti-note tip-alert tip-alert--excluded">
              Anti-reqs: {antiLinks.join(", ")}
            </div>
          ) : null}

          {assessmentText ? (
            <div className="tip-section">
              <div className="tip-label">Assessment</div>
              <div className="tip-detail-text">
                {assessmentText}
                {node.reassessment ? (
                  <div className="tip-detail-sub">
                    Re-assessment: {node.reassessment}
                  </div>
                ) : null}
              </div>
            </div>
          ) : null}

          {prereqPaths.length || coreqPaths.length || forwardPaths.length ? (
            <div className="tip-section">
              <div className="tip-label">Paths</div>
              <div className="tip-paths">
                {prereqPaths.map((path, index) => (
                  <div key={`prereq-${index}`} className="tip-path-line">
                    <span className="tip-path-label">Prereq </span>
                    {formatPath(path)}
                  </div>
                ))}
                {coreqPaths.map((path, index) => {
                  const kind = getPathKind(path, graphState);
                  return (
                    <div key={`coreq-${index}`} className="tip-path-line">
                      <span
                        className="tip-path-label tip-path-label--coreq"
                        data-kind={kind}
                      >
                        {kind === "optional" ? "Co-req one" : "Co-req"}
                      </span>
                      {formatPath(path)}
                    </div>
                  );
                })}
                {forwardPaths.map((path, index) => (
                  <div key={`forward-${index}`} className="tip-path-line">
                    <span className="tip-path-label">Forward </span>
                    {formatPath(path)}
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {!isEffExcl || isManual ? (
            <div className="tip-actions">
              <button
                className="tip-btn"
                data-state={isSelected ? "active" : "idle"}
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  onSelectToggle(node);
                }}
              >
                <Check size={14} aria-hidden="true" />
                {isSelected ? "Selected" : "Select"}
              </button>
              <button
                className="tip-btn tip-btn--passed"
                data-state={isPassed ? "active" : "idle"}
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  onPassedToggle(node);
                }}
              >
                <Check size={14} aria-hidden="true" />
                {isPassed ? "Passed" : "Mark passed"}
              </button>
              <button
                className="tip-btn tip-btn--danger"
                data-state={isManual ? "active" : "idle"}
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  onExcludeToggle(node);
                }}
              >
                <XCircle size={14} aria-hidden="true" />
                {isManual ? "Excluded" : "Exclude"}
              </button>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}

export function createTooltip(
  tip: HTMLElement,
  props: Omit<
    TooltipPanelProps,
    "node" | "isPinned" | "isCollapsed" | "onTogglePin" | "onToggleCollapsed"
  >,
) {
  const root = tooltipRoots.get(tip) ?? createRoot(tip);
  tooltipRoots.set(tip, root);

  type TooltipPanelDescriptor = {
    node: GraphNode;
    isPinned: boolean;
    isCollapsed: boolean;
    onTogglePin: () => void;
    onToggleCollapsed: () => void;
    onClose: () => void;
  };

  function TooltipStack({ panels }: { panels: TooltipPanelDescriptor[] }) {
    const listRef = useRef<HTMLDivElement | null>(null);
    const [activeIndex, setActiveIndex] = useState(0);

    useEffect(() => {
      if (!panels.length) return;
      if (activeIndex > panels.length - 1) {
        setActiveIndex(panels.length - 1);
      }
    }, [activeIndex, panels.length]);

    const scrollToIndex = (index: number) => {
      const clamped = Math.max(0, Math.min(index, panels.length - 1));
      const panel = listRef.current?.querySelector<HTMLElement>(
        `[data-tip-index="${clamped}"]`,
      );
      panel?.scrollIntoView({ behavior: "smooth", block: "start" });
      setActiveIndex(clamped);
    };

    return (
      <div className="tip-stack-shell">
        <div className="tip-stack-toolbar">
          <span className="tip-stack-count">
            {panels.length} open {panels.length === 1 ? "module" : "modules"}
          </span>
          {panels.length > 1 ? (
            <div className="tip-stack-nav">
              <button
                type="button"
                className="tip-btn tip-btn--ghost"
                onClick={() => scrollToIndex(activeIndex - 1)}
              >
                Prev
              </button>
              <button
                type="button"
                className="tip-btn tip-btn--ghost"
                onClick={() => scrollToIndex(activeIndex + 1)}
              >
                Next
              </button>
            </div>
          ) : null}
        </div>

        <div className="tip-stack" ref={listRef}>
          {panels.map((panel, index) => (
            <div
              key={panel.node.id}
              className="tip-item"
              data-tip-index={index}
              data-tip-tone={index % 2}
            >
              <TooltipPanel
                {...props}
                node={panel.node}
                isPinned={panel.isPinned}
                isCollapsed={panel.isCollapsed}
                onTogglePin={panel.onTogglePin}
                onToggleCollapsed={panel.onToggleCollapsed}
                onClose={panel.onClose}
              />
              {index < panels.length - 1 ? (
                <div className="tip-divider" />
              ) : null}
            </div>
          ))}
        </div>
      </div>
    );
  }

  return {
    showTips(panels: TooltipPanelDescriptor[]) {
      if (!panels.length) {
        root.render(null);
        tip.style.display = "none";
        return;
      }
      root.render(<TooltipStack panels={panels} />);
      tip.style.display = "block";
    },
    hideTip() {
      root.render(null);
      tip.style.display = "none";
    },
    destroy() {
      root.render(null);
      tip.style.display = "none";
    },
  };
}
