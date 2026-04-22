export function createTooltip({ prereqRules, manualExcluded, selected, graphState, onSelectToggle, onExcludeToggle, onClose }) {
  const tipEl = () => document.getElementById('tip');

  function showTip(node) {
    const tip = tipEl();
    const effExcl = graphState.computeEffectivelyExcluded(manualExcluded);
    const rules = prereqRules[node.id] || [];
    const isEffExcl = effExcl.has(node.id);
    const isManual = manualExcluded.has(node.id);
    const isSelected = selected.has(node.id);

    const prereqHtml = rules.length
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

    const ancestors = [...graphState.getAllAncestors(node.id)];
    const chainLine = ancestors.length ? `<div class="tip-chain">Full chain: ${ancestors.join(' → ')}</div>` : '';
    const antiLine = node.id === 'MT4512' ? '<div class="tip-anti-note">Anti-req: CS3052</div>' : '';
    const exclNote = isEffExcl && !isManual
      ? '<div class="tip-excl-note">Blocked - prerequisites unavailable</div>'
      : isManual
        ? '<div class="tip-excl-note">Manually excluded</div>'
        : '';

    const actions = node.level === 'ext'
      ? ''
      : `
        <div class="tip-actions">
          <button class="tip-btn" data-action="select" data-state="${isSelected ? 'active' : 'idle'}" type="button">${isSelected ? 'Selected' : 'Select'}</button>
          <button class="tip-btn tip-btn--danger" data-action="exclude" data-state="${isManual ? 'active' : 'idle'}" type="button">${isManual ? 'Excluded' : 'Exclude'}</button>
        </div>
      `;

    tip.innerHTML = `
      <button class="tip-close" type="button" aria-label="Close module info">✕</button>
      <div class="tip-id">${node.id}</div>
      <div class="tip-name">${node.name}</div>
      ${exclNote}
      <div class="tip-section">
        <div class="tip-label">Prerequisites</div>
        ${prereqHtml}
        ${chainLine}
      </div>
      ${antiLine}
      ${actions}
    `;

    tip.querySelector('[data-action="select"]')?.addEventListener('click', (event) => {
      event.stopPropagation();
      onSelectToggle(node);
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
