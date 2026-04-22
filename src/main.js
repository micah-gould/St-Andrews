import './style.css';
import { listCatalogs, loadGraphData } from './dataLoader.js';
import { createGraphState } from './graph.js';
import { createRenderer } from './render.js';
import { listSettings, saveSettings, deleteSettings } from './settingsApi.js';
import { createUiState } from './state.js';
import { createTooltip } from './tooltip.js';
import { COLORS } from './constants.js';

const appState = {
  catalogs: [],
  currentCatalogId: null,
  currentYear: null,
  settingsCache: [],
  graphRuntime: null,
  outsideClickHandler: null,
};

bootstrap();

async function bootstrap() {
  try {
    appState.catalogs = await listCatalogs();
    if (!appState.catalogs.length) {
      throw new Error('No catalogs available.');
    }

    setupCatalogSelector();
    await renderCatalog(appState.catalogs[0].id);
    try {
      await refreshSettings();
    } catch (error) {
      showFeedback(`Saved settings unavailable: ${error.message}`, true);
    }
  } catch (error) {
    document.getElementById('status-text').innerHTML = `<div class="status-row status-row--single"><span class="status-empty">${error.message}</span></div>`;
  }
}

function setupCatalogSelector() {
  const select = document.getElementById('catalog-select');
  select.innerHTML = '';

  appState.catalogs.forEach((catalog) => {
    const option = document.createElement('option');
    option.value = catalog.id;
    option.textContent = catalog.name;
    select.append(option);
  });

  select.addEventListener('change', async (event) => {
    await renderCatalog(event.target.value, appState.currentYear);
    showFeedback(`Showing ${select.selectedOptions[0]?.textContent || event.target.value}.`);
  });

  const yearSelect = document.getElementById('year-select');
  yearSelect.addEventListener('change', async (event) => {
    appState.currentYear = event.target.value;
    await renderCatalog(appState.currentCatalogId || appState.catalogs[0].id, appState.currentYear);
    showFeedback(`Showing ${event.target.value}.`);
  });
}

function populateYearSelector(catalog, selectedYear) {
  const yearSelect = document.getElementById('year-select');
  yearSelect.innerHTML = '';

  (catalog.years || []).forEach((year) => {
    const option = document.createElement('option');
    option.value = year;
    option.textContent = year;
    yearSelect.append(option);
  });

  yearSelect.value = selectedYear || catalog.years?.[0] || '';
}

async function renderCatalog(catalogId, yearOrState = null, maybeRestoredState = null) {
  const restoredState = maybeRestoredState || (yearOrState && typeof yearOrState === 'object' ? yearOrState : null);
  const selectedYear = restoredState?.year || (typeof yearOrState === 'string' ? yearOrState : appState.currentYear);
  const { catalog, selectedYear: resolvedYear, nodes, prereqRules, edges } = await loadGraphData(catalogId, selectedYear);
  appState.currentCatalogId = catalog.id;
  appState.currentYear = resolvedYear;
  document.getElementById('catalog-select').value = catalog.id;
  populateYearSelector(catalog, resolvedYear);
  document.querySelector('.logo').textContent = catalog.name;
  document.getElementById('search').value = '';

  const graphArea = document.getElementById('graph-area');
  graphArea.innerHTML = '<svg id="graph-svg"></svg><aside id="tip"></aside>';

  const runtime = buildGraphRuntime({ catalog, nodes, prereqRules, edges, restoredState });
  appState.graphRuntime = runtime;
  runtime.syncUi();
}

function buildGraphRuntime({ catalog, nodes, prereqRules, edges, restoredState }) {
  const area = document.getElementById('graph-area');
  const width = area.clientWidth || 900;
  const height = area.clientHeight || 620;
  const getNodeRadius = (node) => {
    const baseRadius = node.level === 'ext' ? 18 : node.level === 1000 ? 19 : 18;
    return Math.max(baseRadius, Math.ceil(node.id.length * 3.25));
  };

  const uiState = createUiState(nodes);
  if (restoredState) {
    uiState.replaceState(restoredState);
  }

  const graphState = createGraphState(nodes, edges, prereqRules);

  const closePanel = () => {
    uiState.setActiveNodeId(null);
    uiState.setHoverId(null);
    tooltip.hideTip();
    renderer.render();
  };

  const toggleSelected = (node) => {
    if (uiState.selected.has(node.id)) {
      uiState.selected.delete(node.id);
    } else {
      uiState.selected.add(node.id);
      uiState.manualExcluded.delete(node.id);
    }
    syncUi();
    tooltip.showTip(node);
  };

  const toggleExcluded = (node) => {
    if (uiState.manualExcluded.has(node.id)) {
      uiState.manualExcluded.delete(node.id);
    } else {
      uiState.manualExcluded.add(node.id);
      uiState.selected.delete(node.id);
      graphState.computeEffectivelyExcluded(uiState.manualExcluded).forEach((id) => uiState.selected.delete(id));
    }
    syncUi();
    tooltip.showTip(node);
  };

  const tooltip = createTooltip({
    prereqRules,
    manualExcluded: uiState.manualExcluded,
    selected: uiState.selected,
    graphState,
    onSelectToggle: toggleSelected,
    onExcludeToggle: toggleExcluded,
    onClose: closePanel,
  });

  const svg = d3.select('#graph-svg');
  const root = svg.append('g');

  svg.call(
    d3.zoom()
      .scaleExtent([0.15, 5])
      .on('zoom', (event) => root.attr('transform', event.transform))
  );

  const defs = svg.append('defs');
  const filt = defs.append('filter').attr('id', 'glow').attr('x', '-40%').attr('y', '-40%').attr('width', '180%').attr('height', '180%');
  filt.append('feGaussianBlur').attr('stdDeviation', '3').attr('result', 'blur');
  const feMerge = filt.append('feMerge');
  feMerge.append('feMergeNode').attr('in', 'blur');
  feMerge.append('feMergeNode').attr('in', 'SourceGraphic');

  [
    ['edge', COLORS.edge],
    ['hover-pre-required', COLORS.hoverPreRequired],
    ['hover-pre-optional', COLORS.hoverPreOptional],
    ['hover-fwd', COLORS.hoverFwd],
    ['sel-pre-required', COLORS.selPreRequired],
    ['sel-pre-optional', COLORS.selPreOptional],
    ['sel-fwd', COLORS.selFwd],
    ['anti', COLORS.anti],
    ['excl', COLORS.excl],
  ].forEach(([id, color]) => {
    defs.append('marker')
      .attr('id', `m-${id}`)
      .attr('viewBox', '0 0 10 10')
      .attr('refX', 18)
      .attr('refY', 5)
      .attr('markerWidth', 5)
      .attr('markerHeight', 5)
      .attr('orient', 'auto-start-reverse')
      .append('path')
      .attr('d', 'M2 1L8 5L2 9')
      .attr('fill', 'none')
      .attr('stroke', color)
      .attr('stroke-width', '1.5')
      .attr('stroke-linecap', 'round')
      .attr('stroke-linejoin', 'round');
  });

  const sim = d3.forceSimulation(nodes)
    .force('link', d3.forceLink(edges).id((node) => node.id)
      .distance((edge) => (edge.etype === 'anti' ? 130 : 88))
      .strength((edge) => (edge.etype === 'anti' ? 0.04 : 0.5)))
    .force('charge', d3.forceManyBody().strength((node) => (node.level === 'ext' ? -60 : -195)))
    .force('x', d3.forceX((node) => {
      if (node.level === 'ext') return width * 0.93;
      return { 1000: width * 0.08, 2000: width * 0.24, 3000: width * 0.42, 4000: width * 0.62, 5000: width * 0.8 }[node.level] || width / 2;
    }).strength((node) => (node.level === 'ext' ? 0.7 : 0.45)))
    .force('y', d3.forceY(height / 2).strength(0.04))
    .force('collision', d3.forceCollide((node) => getNodeRadius(node) + 10));

  sim.alpha(1).restart();

  const linkSel = root.append('g').attr('class', 'links')
    .selectAll('line').data(edges).join('line').attr('fill', 'none');

  const nodeG = root.append('g').attr('class', 'nodes')
    .selectAll('g').data(nodes).join('g').attr('cursor', 'pointer');

  nodeG.append('circle')
    .attr('r', (node) => getNodeRadius(node) + 6)
    .attr('fill', 'transparent')
    .attr('stroke', 'none');

  const circles = nodeG.append('circle')
    .attr('r', (node) => getNodeRadius(node));

  const labels = nodeG.append('text')
    .attr('text-anchor', 'middle')
    .attr('dy', '0.35em')
    .attr('font-family', 'var(--font-mono)')
    .attr('pointer-events', 'none')
    .attr('font-size', '9px')
    .text((node) => node.id);

  const renderer = createRenderer({
    circles,
    labels,
    linkSel,
    manualExcluded: uiState.manualExcluded,
    selected: uiState.selected,
    getHoverId: () => uiState.getActiveNodeId() || uiState.getHoverId(),
    graphState,
  });

  const syncUi = () => {
    renderer.render();
    uiState.updateStatus(graphState);
  };

  const drag = d3.drag()
    .on('start', (event, node) => {
      if (!event.active) sim.alphaTarget(0.3).restart();
      node.fx = node.x;
      node.fy = node.y;
    })
    .on('drag', (event, node) => {
      node.fx = event.x;
      node.fy = event.y;
    })
    .on('end', (event) => {
      if (!event.active) sim.alphaTarget(0);
    });

  nodeG.call(drag);
  nodeG.on('dblclick', (event, node) => {
    event.stopPropagation();
    node.fx = null;
    node.fy = null;
    sim.alphaTarget(0.1).restart();
  });

  nodeG
    .on('mouseover', (event, node) => {
      if (uiState.getActiveNodeId()) return;
      uiState.setHoverId(node.id);
      renderer.render();
    })
    .on('mouseout', () => {
      if (uiState.getActiveNodeId()) return;
      uiState.setHoverId(null);
      renderer.render();
    })
    .on('click', (event, node) => {
      event.stopPropagation();

      uiState.setActiveNodeId(node.id);
      uiState.setHoverId(node.id);
      syncUi();
      tooltip.showTip(node);
    });

  sim.on('tick', () => {
    linkSel
      .attr('x1', (edge) => edge.source.x)
      .attr('y1', (edge) => edge.source.y)
      .attr('x2', (edge) => {
        const dx = edge.target.x - edge.source.x;
        const dy = edge.target.y - edge.source.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        const radius = getNodeRadius(edge.target);
        return edge.target.x - (dx / dist) * radius;
      })
      .attr('y2', (edge) => {
        const dx = edge.target.x - edge.source.x;
        const dy = edge.target.y - edge.source.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        const radius = getNodeRadius(edge.target);
        return edge.target.y - (dy / dist) * radius;
      });

    nodeG.attr('transform', (node) => `translate(${Math.max(16, Math.min(width - 16, node.x))},${Math.max(16, Math.min(height - 16, node.y))})`);
  });

  wireCommonControls(uiState, graphState, renderer, tooltip, linkSel, labels, circles, syncUi);
  document.getElementById('status-text').textContent = `Showing ${catalog.name}. Hover to explore, or click a node to pin its details.`;

  return {
    catalog,
    uiState,
    graphState,
    syncUi,
    snapshot: () => ({
      catalogId: catalog.id,
      year: appState.currentYear,
      selected: [...uiState.selected],
      excluded: [...uiState.manualExcluded],
      blocked: [...graphState.computeEffectivelyExcluded(uiState.manualExcluded)].filter((id) => !uiState.manualExcluded.has(id)),
    }),
  };
}

function wireCommonControls(uiState, graphState, renderer, tooltip, linkSel, labels, circles, syncUi) {
  const status = document.getElementById('status');

  document.getElementById('search').oninput = (event) => {
    const query = event.target.value.toLowerCase().trim();
    if (!query) {
      renderer.render();
      return;
    }

    circles.attr('stroke-opacity', (node) => (
      node.id.toLowerCase().includes(query) || node.name.toLowerCase().includes(query) ? 1 : 0.06
    )).attr('fill-opacity', (node) => (
      node.id.toLowerCase().includes(query) || node.name.toLowerCase().includes(query) ? 0.25 : 0.04
    ));

    labels.attr('opacity', (node) => (
      node.id.toLowerCase().includes(query) || node.name.toLowerCase().includes(query) ? 1 : 0.06
    ));

    linkSel.attr('stroke-opacity', 0.03);
  };

  document.getElementById('clear-all').onclick = () => {
    uiState.clearAll();
    uiState.setHoverId(null);
    uiState.setActiveNodeId(null);
    tooltip.hideTip();
    syncUi();
  };

  status.onclick = (event) => {
    event.stopPropagation();
    status.classList.add('is-enlarged');
  };

  if (appState.outsideClickHandler) {
    document.removeEventListener('click', appState.outsideClickHandler);
  }

  appState.outsideClickHandler = (event) => {
    const panel = document.getElementById('tip');
    const statusPanel = document.getElementById('status');
    if (uiState.getActiveNodeId() && !panel.contains(event.target)) {
      uiState.setActiveNodeId(null);
      uiState.setHoverId(null);
      tooltip.hideTip();
      renderer.render();
    }

    if (!statusPanel.contains(event.target)) {
      statusPanel.classList.remove('is-enlarged');
    }
  };

  document.addEventListener('click', appState.outsideClickHandler);

  wireSettingsControls();
}

function wireSettingsControls() {
  const form = document.getElementById('settings-form');
  const nameInput = document.getElementById('settings-name');
  const loadButton = document.getElementById('load-settings');
  const deleteButton = document.getElementById('delete-settings');

  form.onsubmit = async (event) => {
    event.preventDefault();
    const name = nameInput.value.trim();
    if (!name) {
      showFeedback('Enter a name before saving.', true);
      return;
    }

    if (!appState.graphRuntime) {
      showFeedback('The current graph is still loading.', true);
      return;
    }

    try {
      const saved = await saveSettings({ name, state: appState.graphRuntime.snapshot() });
      await refreshSettings(String(saved.id));
      nameInput.value = '';
      showFeedback(`Saved "${saved.name}".`);
    } catch (error) {
      showFeedback(error.message, true);
    }
  };

  loadButton.onclick = async () => {
    const current = getSelectedSavedSetting();
    if (!current) {
      showFeedback('Choose a saved setting to load.', true);
      return;
    }

    try {
      await renderCatalog(current.state.catalogId || appState.catalogs[0].id, current.state);
      showFeedback(`Loaded "${current.name}".`);
    } catch (error) {
      showFeedback(error.message, true);
    }
  };

  deleteButton.onclick = async () => {
    const current = getSelectedSavedSetting();
    if (!current) {
      showFeedback('Choose a saved setting to delete.', true);
      return;
    }

    try {
      await deleteSettings(current.id);
      await refreshSettings();
      showFeedback(`Deleted "${current.name}".`);
    } catch (error) {
      showFeedback(error.message, true);
    }
  };
}

async function refreshSettings(selectedId = '') {
  appState.settingsCache = await listSettings();
  const select = document.getElementById('saved-settings-list');
  select.innerHTML = '';

  if (!appState.settingsCache.length) {
    const option = document.createElement('option');
    option.value = '';
    option.textContent = 'No saved settings yet';
    select.append(option);
    return;
  }

  appState.settingsCache.forEach((setting) => {
    const option = document.createElement('option');
    option.value = String(setting.id);
    option.textContent = `${setting.name} [${setting.catalogName}] (${setting.selectedCount} selected, ${setting.excludedCount} excluded)`;
    select.append(option);
  });

  select.value = selectedId || String(appState.settingsCache[0].id);
}

function getSelectedSavedSetting() {
  const value = document.getElementById('saved-settings-list').value;
  return appState.settingsCache.find((setting) => String(setting.id) === value) || null;
}

function showFeedback(message, isError = false) {
  const feedback = document.getElementById('settings-feedback');
  feedback.textContent = message;
  feedback.dataset.state = isError ? 'error' : 'ok';
}
