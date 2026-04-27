import React from 'react';
import { createRoot } from 'react-dom/client';
import type { GraphNode, PrereqRule } from '../types/graph.types';

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
  onClose: () => void;
};

function getCatalogUrl(moduleCode: string) {
  return `https://www.st-andrews.ac.uk/subjects/modules/search/?query=${encodeURIComponent(moduleCode)}`;
}

function formatPath(path: string[]) {
  return path.join(' -> ');
}

function getPathKind(path: string[], graphState: TooltipGraphState) {
  if (path.length < 2) {
    return 'required';
  }

  return graphState.getCoreqRequirementKind(path[0], path[path.length - 1]);
}

function TooltipPanel({ node, prereqRules, manualExcluded, selected, passed, graphState, onSelectToggle, onPassedToggle, onExcludeToggle, onClose }: TooltipPanelProps) {
  const effExcl = graphState.computeEffectivelyExcluded(manualExcluded);
  const rules = prereqRules[node.id] || [];
  const isEffExcl = effExcl.has(node.id);
  const isManual = manualExcluded.has(node.id);
  const isSelected = selected.has(node.id);
  const isPassed = passed.has(node.id);
  const ancestors = [...graphState.getPrerequisitePathNodes(node.id)];
  const antiLinks = [...graphState.getAllAntiLinks(node.id)];
  const descriptionText = node.description || node.summary || '';
  const timetableText = node.plannedTimetable || '';
  const assessmentText = node.assessmentPattern || '';
  const availabilityLabel = node.availableInSelectedYear === false ? 'Not running in selected year' : 'Running in selected year';
  const yearList = Array.isArray(node.years) && node.years.length ? node.years.join(', ') : 'Unknown';
  const availabilityNote = node.frequency === 'every-year'
    ? 'Appears in consecutive tracked years, so it is treated as running every year.'
    : node.frequency === 'alternate-a'
      ? 'Appears to run in alternating years matching 2025/26 and 2027/28.'
      : node.frequency === 'alternate-b'
        ? 'Appears to run in alternating years matching 2026/27.'
        : 'Tracked year data is incomplete or irregular.';
  const prereqPaths = graphState.getSimplePathsFromRoots(node.id, node.antiRequisiteSummary || antiLinks.length ? 3 : 1);
  const coreqPaths = graphState.getCorequisitePaths(node.id);
  const forwardStarts = graphState.getForwardPathStarts(node.id);
  const forwardPaths = [];

  forwardStarts.forEach((startId) => {
    graphState.getSimplePathsForward(startId, 3).forEach((path) => {
      if (forwardPaths.length < 3) {
        forwardPaths.push(path);
      }
    });
  });

  return (
    <>
      <button className="tip-close" type="button" aria-label="Close module info" onClick={(event) => {
        event.stopPropagation();
        onClose();
      }}>
        ✕
      </button>
      <div className="tip-id">{node.id}</div>
      <div className="tip-name">{node.name}</div>
      <div className="tip-catalog">{node.isInSelectedCatalog ? 'Current catalog' : (node.primaryCatalogName || 'Related catalog')}</div>
      <div className="tip-link"><a href={getCatalogUrl(node.id)} target="_blank" rel="noreferrer">View in catalog</a></div>
      <div className="tip-meta">{node.credits ? `${node.credits} credits` : 'Credits unknown'}</div>

      {isEffExcl && !isManual ? <div className="tip-excl-note">Blocked - prerequisites unavailable</div> : null}
      {isManual ? <div className="tip-excl-note">Manually excluded</div> : null}

      <div className="tip-availability">
        <strong>{availabilityLabel}</strong>
        <div className="tip-availability-note">Years seen: {yearList}. {availabilityNote}</div>
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
              const running = node.semesterAvailability?.[semester] !== false;
              return <span key={semester} className="tip-semester-chip" data-running={running}>{semester}</span>;
            })}
          </div>
        ) : (
          <div className="tip-availability-note">Semester data unavailable.</div>
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
            const badgeCls = rule.type === 'all' ? 'tip-badge--all' : 'tip-badge--one';
            const label = rule.type === 'all' ? 'need all' : 'need one';
            return (
              <div key={`${node.id}-rule-${index}`}>
                <span className={`tip-badge ${badgeCls}`}>{label}</span>
                {rule.sources.map((source) => (
                  <span key={source} className={effExcl.has(source) ? 'tip-src-excl' : undefined} style={{ marginRight: '0.35rem' }}>
                    {source}
                  </span>
                ))}
              </div>
            );
          })
        ) : (
          <span style={{ color: 'var(--text-dim)' }}>None</span>
        )}
        {ancestors.length ? <div className="tip-chain">Full chain: {ancestors.join(' -> ')}</div> : null}
      </div>

      {node.coRequisiteSummary ? <div className="tip-coreq-note">Co-reqs: {node.coRequisiteSummary}</div> : null}
      {node.antiRequisiteSummary ? <div className="tip-anti-note">Anti-reqs: {node.antiRequisiteSummary}</div> : null}
      {!node.antiRequisiteSummary && antiLinks.length ? <div className="tip-anti-note">Anti-reqs: {antiLinks.join(', ')}</div> : null}

      {assessmentText ? (
        <div className="tip-section">
          <div className="tip-label">Assessment</div>
          <div className="tip-detail-text">
            {assessmentText}
            {node.reassessment ? <div className="tip-detail-sub">Re-assessment: {node.reassessment}</div> : null}
          </div>
        </div>
      ) : null}

      {prereqPaths.length || coreqPaths.length || forwardPaths.length ? (
        <div className="tip-section">
          <div className="tip-label">Paths</div>
          <div className="tip-paths">
            {prereqPaths.map((path, index) => (
              <div key={`prereq-${index}`} className="tip-path-line"><span className="tip-path-label">Prereq</span>{formatPath(path)}</div>
            ))}
            {coreqPaths.map((path, index) => {
              const kind = getPathKind(path, graphState);
              return (
                <div key={`coreq-${index}`} className="tip-path-line">
                  <span className="tip-path-label tip-path-label--coreq" data-kind={kind}>{kind === 'optional' ? 'Co-req one' : 'Co-req'}</span>
                  {formatPath(path)}
                </div>
              );
            })}
            {forwardPaths.map((path, index) => (
              <div key={`forward-${index}`} className="tip-path-line"><span className="tip-path-label">Forward</span>{formatPath(path)}</div>
            ))}
          </div>
        </div>
      ) : null}

      {!isEffExcl || isManual ? (
        <div className="tip-actions">
          <button className="tip-btn" data-state={isSelected ? 'active' : 'idle'} type="button" onClick={(event) => {
            event.stopPropagation();
            onSelectToggle(node);
          }}>{isSelected ? 'Selected' : 'Select'}</button>
          <button className="tip-btn tip-btn--passed" data-state={isPassed ? 'active' : 'idle'} type="button" onClick={(event) => {
            event.stopPropagation();
            onPassedToggle(node);
          }}>{isPassed ? 'Passed' : 'Mark passed'}</button>
          <button className="tip-btn tip-btn--danger" data-state={isManual ? 'active' : 'idle'} type="button" onClick={(event) => {
            event.stopPropagation();
            onExcludeToggle(node);
          }}>{isManual ? 'Excluded' : 'Exclude'}</button>
        </div>
      ) : null}
    </>
  );
}

export function createTooltip(tip: HTMLElement, props: Omit<TooltipPanelProps, 'node'>) {
  const root = createRoot(tip);

  return {
    showTip(node: GraphNode) {
      root.render(<TooltipPanel {...props} node={node} />);
      tip.style.display = 'block';
    },
    hideTip() {
      root.render(null);
      tip.style.display = 'none';
    },
  };
}
