export function createTooltip({ prereqRules, manualExcluded, selected, passed, graphState, onSelectToggle, onPassedToggle, onExcludeToggle, onClose }) {
  const tipEl = () => document.getElementById('tip');
  const getCatalogUrl = (moduleCode) => `https://www.st-andrews.ac.uk/subjects/modules/search/?query=${encodeURIComponent(moduleCode)}`;

  function formatPath(path) {
    return path.join(' -> ');
  }

  function getPathKind(path) {
    if (path.length < 2) return 'required';
    return graphState.getCoreqRequirementKind(path[0], path[path.length - 1]);
  }

  function showTip(node) {
    const tip = tipEl();
    const effExcl = graphState.computeEffectivelyExcluded(manualExcluded);
    const rules = prereqRules[node.id] || [];
    const isEffExcl = effExcl.has(node.id);
    const isManual = manualExcluded.has(node.id);
    const isSelected = selected.has(node.id);
    const isPassed = passed.has(node.id);

    const prereqHtml = node.prerequisiteSummary
      ? `<div>${node.prerequisiteSummary}</div>`
      : rules.length
      ? rules.map((rule) => {
          const badgeCls = rule.type === 'all' ? 'tip-badge--all' : 'tip-badge--one';
          const label = rule.type === 'all' ? 'need all' : 'need one';
          const srcLabels = rule.sources.map((source) => {
            if (effExcl.has(source)) return `<span class="tip-src-excl">${source}</span>`;
            return `<span>${source}</span>`;
          }).join(' ');
          return `<span class="tip-badge ${badgeCls}">${label}</span>${srcLabels}`;
        }).join('<br>')
      : '<span style="color:var(--text-dim)">None</span>';

    const ancestors = [...graphState.getPrerequisitePathNodes(node.id)];
    const chainLine = ancestors.length ? `<div class="tip-chain">Full chain: ${ancestors.join(' -> ')}</div>` : '';
    const coReqLine = node.coRequisiteSummary
      ? `<div class="tip-coreq-note">Co-reqs: ${node.coRequisiteSummary}</div>`
      : '';
    const antiLinks = [...graphState.getAllAntiLinks(node.id)];
    const antiLine = node.antiRequisiteSummary
      ? `<div class="tip-anti-note">Anti-reqs: ${node.antiRequisiteSummary}</div>`
      : antiLinks.length
        ? `<div class="tip-anti-note">Anti-reqs: ${antiLinks.join(', ')}</div>`
        : '';
    const exclNote = isEffExcl && !isManual
      ? '<div class="tip-excl-note">Blocked - prerequisites unavailable</div>'
      : isManual
        ? '<div class="tip-excl-note">Manually excluded</div>'
        : '';
    const availabilityLabel = node.availableInSelectedYear === false ? 'Not running in selected year' : 'Running in selected year';
    const yearList = Array.isArray(node.years) && node.years.length ? node.years.join(', ') : 'Unknown';
    const availabilityNote = node.frequency === 'every-year'
      ? 'Appears in consecutive tracked years, so it is treated as running every year.'
      : node.frequency === 'alternate-a'
        ? 'Appears to run in alternating years matching 2025/26 and 2027/28.'
        : node.frequency === 'alternate-b'
          ? 'Appears to run in alternating years matching 2026/27.'
          : 'Tracked year data is incomplete or irregular.';
    const semesterHtml = Array.isArray(node.semesters) && node.semesters.length
      ? `<div class="tip-semesters">${node.semesters.map((semester) => {
          const running = node.semesterAvailability?.[semester] !== false;
          return `<span class="tip-semester-chip" data-running="${running}">${semester}</span>`;
        }).join('')}</div>`
      : '<div class="tip-availability-note">Semester data unavailable.</div>';
    const prereqPaths = graphState.getSimplePathsFromRoots(node.id, node.antiRequisiteSummary || antiLinks.length ? 3 : 1);
    const coreqPaths = graphState.getCorequisitePaths(node.id);
    const forwardStarts = graphState.getForwardPathStarts(node.id);
    const forwardPaths = [];
    forwardStarts.forEach((startId) => {
      graphState.getSimplePathsForward(startId, 3).forEach((path) => {
        if (forwardPaths.length < 3) forwardPaths.push(path);
      });
    });
    const pathSection = (prereqPaths.length || coreqPaths.length || forwardPaths.length)
      ? `
        <div class="tip-section">
          <div class="tip-label">Paths</div>
          <div class="tip-paths">
            ${prereqPaths.map((path) => `<div class="tip-path-line"><span class="tip-path-label">Prereq</span>${formatPath(path)}</div>`).join('')}
            ${coreqPaths.map((path) => `<div class="tip-path-line"><span class="tip-path-label tip-path-label--coreq" data-kind="${getPathKind(path)}">${getPathKind(path) === 'optional' ? 'Co-req one' : 'Co-req'}</span>${formatPath(path)}</div>`).join('')}
            ${forwardPaths.map((path) => `<div class="tip-path-line"><span class="tip-path-label">Forward</span>${formatPath(path)}</div>`).join('')}
          </div>
        </div>
      `
      : '';

    const actions = (isEffExcl && !isManual)
      ? ''
      : `
        <div class="tip-actions">
          <button class="tip-btn" data-action="select" data-state="${isSelected ? 'active' : 'idle'}" type="button">${isSelected ? 'Selected' : 'Select'}</button>
          <button class="tip-btn tip-btn--passed" data-action="passed" data-state="${isPassed ? 'active' : 'idle'}" type="button">${isPassed ? 'Passed' : 'Mark passed'}</button>
          <button class="tip-btn tip-btn--danger" data-action="exclude" data-state="${isManual ? 'active' : 'idle'}" type="button">${isManual ? 'Excluded' : 'Exclude'}</button>
        </div>
      `;

    tip.innerHTML = `
      <button class="tip-close" type="button" aria-label="Close module info">✕</button>
      <div class="tip-id">${node.id}</div>
      <div class="tip-name">${node.name}</div>
      <div class="tip-catalog">${node.isInSelectedCatalog ? 'Current catalog' : (node.primaryCatalogName || 'Related catalog')}</div>
      <div class="tip-link"><a href="${getCatalogUrl(node.id)}" target="_blank" rel="noreferrer">View in catalog</a></div>
      <div class="tip-meta">${node.credits ? `${node.credits} credits` : 'Credits unknown'}</div>
      ${exclNote}
      <div class="tip-availability"><strong>${availabilityLabel}</strong><div class="tip-availability-note">Years seen: ${yearList}. ${availabilityNote}</div></div>
      <div class="tip-section">
        <div class="tip-label">Semesters</div>
        ${semesterHtml}
      </div>
      <div class="tip-section">
        <div class="tip-label">Prerequisites</div>
        ${prereqHtml}
        ${chainLine}
      </div>
      ${coReqLine}
      ${antiLine}
      ${pathSection}
      ${actions}
    `;

    tip.querySelector('[data-action="select"]')?.addEventListener('click', (event) => {
      event.stopPropagation();
      onSelectToggle(node);
    });

    tip.querySelector('[data-action="passed"]')?.addEventListener('click', (event) => {
      event.stopPropagation();
      onPassedToggle(node);
    });

    tip.querySelector('[data-action="exclude"]')?.addEventListener('click', (event) => {
      event.stopPropagation();
      onExcludeToggle(node);
    });

    tip.querySelector('.tip-close')?.addEventListener('click', (event) => {
      event.stopPropagation();
      onClose();
    });

    tip.style.display = 'block';
  }

  function hideTip() {
    tipEl().style.display = 'none';
  }

  return { showTip, hideTip };
}
