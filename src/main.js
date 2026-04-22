import { listCatalogs, loadGraphData } from './dataLoader.js';
import { createGraphState } from './graph.js';
import { createRenderer } from './render.js';
import { listSettings, saveSettings, deleteSettings } from './settingsApi.js';
import { createUiState } from './state.js';
import { createTooltip } from './tooltip.js';
import { COLORS } from './constants.js';

const THEME_KEY = 'moduleGraphTheme';

const appState = {
  catalogs: [],
  currentCatalogId: null,
  currentYear: null,
  settingsCache: [],
  graphRuntime: null,
  outsideClickHandler: null,
  hiddenLevels: new Set(),
  theme: 'dark',
  isSubjectSelection: true,
};

function parseUrl() {
  const path = window.location.pathname;
  const segments = path.split('/').filter(segment => segment.length > 0);
  
  if (segments.length === 0) {
    return { subject: null, year: null };
  }
  
  const subject = segments[0];
  const year = segments.length > 1 ? segments[1] : null;
  
  return { subject, year };
}

function updateUrl(subject, year) {
  let path = '/';
  
  if (subject) {
    path += subject;
    if (year) {
      path += '/' + year;
    }
  }
  
  window.history.replaceState({}, '', path);
}

bootstrap();
initializeTheme();

function getStoredTheme() {
  return localStorage.getItem(THEME_KEY) || 'dark';
}

function applyTheme(theme) {
  const body = document.body;
  body.classList.toggle('theme-light', theme === 'light');
  body.dataset.theme = theme;
  
  // Update main theme toggle button
  const button = document.getElementById('theme-toggle');
  if (button) {
    button.textContent = theme === 'light' ? 'Dark mode' : 'Light mode';
    button.setAttribute('aria-pressed', theme === 'light' ? 'true' : 'false');
  }
  
  // Update subject theme toggle button
  const subjectButton = document.getElementById('subject-theme-toggle');
  if (subjectButton) {
    subjectButton.textContent = theme === 'light' ? 'Dark mode' : 'Light mode';
    subjectButton.setAttribute('aria-pressed', theme === 'light' ? 'true' : 'false');
  }
}

function setTheme(theme) {
  appState.theme = theme;
  localStorage.setItem(THEME_KEY, theme);
  applyTheme(theme);
}

function toggleTheme() {
  setTheme(appState.theme === 'light' ? 'dark' : 'light');
}

function showSubjectSelection() {
  appState.isSubjectSelection = true;
  document.getElementById('subject-selection').style.display = 'flex';
  document.getElementById('saved-settings-panel').style.display = 'none';
  document.getElementById('graph-area').style.display = 'none';
  document.getElementById('status').style.display = 'none';
  document.querySelector('.toolbar-right').style.display = 'none';
  document.querySelector('.legend').style.display = 'none';
  document.querySelector('.logo').textContent = 'Modules';
  document.querySelector('.logo').style.cursor = 'default';
  document.querySelector('.logo').onclick = null;

  // Set up subject theme toggle
  const subjectThemeToggle = document.getElementById('subject-theme-toggle');
  if (subjectThemeToggle) {
    subjectThemeToggle.textContent = appState.theme === 'light' ? 'Dark mode' : 'Light mode';
    subjectThemeToggle.setAttribute('aria-pressed', appState.theme === 'light' ? 'true' : 'false');
    subjectThemeToggle.onclick = () => {
      toggleTheme();
      subjectThemeToggle.textContent = appState.theme === 'light' ? 'Dark mode' : 'Light mode';
      subjectThemeToggle.setAttribute('aria-pressed', appState.theme === 'light' ? 'true' : 'false');
    };
  }

  const subjectButtons = document.getElementById('subject-buttons');
  subjectButtons.innerHTML = '';

  appState.catalogs.forEach((catalog) => {
    const button = document.createElement('button');
    button.className = 'subject-button';
    button.textContent = catalog.name;
    button.addEventListener('click', () => selectSubject(catalog.id));
    subjectButtons.appendChild(button);
  });
}

function hideSubjectSelection() {
  appState.isSubjectSelection = false;
  document.getElementById('subject-selection').style.display = 'none';
  document.getElementById('saved-settings-panel').style.display = 'flex';
  document.getElementById('graph-area').style.display = 'block';
  document.getElementById('status').style.display = 'block';
  document.querySelector('.toolbar-right').style.display = 'flex';
  document.querySelector('.legend').style.display = 'flex';

  // Make logo clickable to go back to subject selection
  const logo = document.querySelector('.logo');
  logo.style.cursor = 'pointer';
  logo.onclick = () => {
    updateUrl(null, null);
    showSubjectSelection();
  };
}

async function selectSubject(catalogId) {
  updateUrl(catalogId, null);
  hideSubjectSelection();
  await renderCatalog(catalogId);
}

function initializeTheme() {
  setTheme(getStoredTheme());
}

async function bootstrap() {
  try {
    appState.catalogs = await listCatalogs();
    if (!appState.catalogs.length) {
      throw new Error('No catalogs available.');
    }

    setupCatalogSelector();

    // Check URL parameters
    const { subject, year } = parseUrl();
    if (subject) {
      const catalog = appState.catalogs.find(c => c.id === subject);
      if (catalog) {
        appState.isSubjectSelection = false;
        await renderCatalog(catalog.id, year);
      } else {
        // Invalid subject, show subject selection
        showSubjectSelection();
      }
    } else {
      showSubjectSelection();
    }

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
  appState.hiddenLevels = new Set(restoredState?.hiddenLevels ?? [...appState.hiddenLevels]);
  document.getElementById('catalog-select').value = catalog.id;
  populateYearSelector(catalog, resolvedYear);
  document.querySelector('.logo').textContent = catalog.name;
  document.getElementById('search').value = '';

  // Update URL with subject and year
  updateUrl(catalog.id, resolvedYear);

  const graphArea = document.getElementById('graph-area');
  graphArea.innerHTML = '<svg id="graph-svg"></svg><aside id="tip"></aside>';

  const runtime = buildGraphRuntime({ catalog, nodes, prereqRules, edges, restoredState, hiddenLevels: appState.hiddenLevels });
  appState.graphRuntime = runtime;
  runtime.syncUi();
}

function buildGraphRuntime({ catalog, nodes, prereqRules, edges, restoredState, hiddenLevels }) {
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
  const nodeMap = Object.fromEntries(nodes.map((node) => [node.id, node]));

  const getVisibleNodes = () => nodes.filter((node) => !hiddenLevels.has(String(node.level)));
  const getVisibleEdges = () => edges.filter((link) => {
    const sourceId = typeof link.source === 'object' ? link.source.id : link.source;
    const targetId = typeof link.target === 'object' ? link.target.id : link.target;
    const source = nodeMap[sourceId];
    const target = nodeMap[targetId];
    return source && target && !hiddenLevels.has(String(source.level)) && !hiddenLevels.has(String(target.level));
  });

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

  const sim = d3.forceSimulation(getVisibleNodes())
    .force('link', d3.forceLink(getVisibleEdges()).id((node) => node.id)
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

  const refreshSimulation = () => {
    sim.nodes(getVisibleNodes());
    sim.force('link').links(getVisibleEdges());
    sim.alpha(1).restart();
  };

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
    nodeGroups: nodeG,
    circles,
    labels,
    linkSel,
    manualExcluded: uiState.manualExcluded,
    selected: uiState.selected,
    getHoverId: () => uiState.getActiveNodeId() || uiState.getHoverId(),
    graphState,
    hiddenLevels,
    nodes,
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

  wireCommonControls(uiState, graphState, renderer, tooltip, linkSel, labels, circles, syncUi, refreshSimulation);
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
      hiddenLevels: [...appState.hiddenLevels],
    }),
  };
}

function wireCommonControls(uiState, graphState, renderer, tooltip, linkSel, labels, circles, syncUi, refreshSimulation) {
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

  const levelInputs = document.querySelectorAll('#level-filter input[type=checkbox]');
  const syncLevelCheckboxes = () => {
    levelInputs.forEach((input) => {
      input.checked = !appState.hiddenLevels.has(input.value);
    });
  };

  syncLevelCheckboxes();

  levelInputs.forEach((input) => {
    input.onchange = () => {
      if (input.checked) {
        appState.hiddenLevels.delete(input.value);
      } else {
        appState.hiddenLevels.add(input.value);
      }
      refreshSimulation();
      syncUi();
    };
  });

  document.getElementById('clear-all').onclick = () => {
    uiState.clearAll();
    uiState.setHoverId(null);
    uiState.setActiveNodeId(null);
    tooltip.hideTip();
    syncUi();
  };

  const themeToggle = document.getElementById('theme-toggle');
  if (themeToggle) {
    themeToggle.onclick = () => {
      toggleTheme();
    };
  }

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
  const settingsList = document.getElementById('saved-settings-list');

  // Track the currently loaded setting for save/update logic
  let loadedSetting = null;

  // Function to reset dropdown to empty
  const resetDropdown = () => {
    settingsList.value = '';
    loadedSetting = null;
    nameInput.placeholder = 'e.g. Pure maths path';
    showFeedback('');
  };

  // Function to show preview of selected setting
  const showPreview = (setting) => {
    if (!setting) {
      showFeedback('');
      return;
    }
    const catalogName = appState.catalogs.find(c => c.id === setting.state.catalogId)?.name || setting.state.catalogId;
    showFeedback(`Preview: ${setting.name} - ${catalogName} (${setting.selectedCount} selected, ${setting.excludedCount} excluded)`);
  };

  // Dropdown change handler
  settingsList.addEventListener('change', () => {
    const selectedId = settingsList.value;
    const setting = appState.settingsCache.find(s => String(s.id) === selectedId);
    showPreview(setting);
  });

  // Reset dropdown when clicking outside
  document.addEventListener('click', (event) => {
    if (!settingsList.contains(event.target) && !loadButton.contains(event.target)) {
      resetDropdown();
    }
  });

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
      const state = appState.graphRuntime.snapshot();
      let saved;

      // Check if this is an update (same name as loaded setting) or new save
      if (loadedSetting && name === loadedSetting.name) {
        // Update existing setting
        await deleteSettings(loadedSetting.id);
        saved = await saveSettings({ name, state });
      } else {
        // Create new setting
        saved = await saveSettings({ name, state });
      }

      await refreshSettings(String(saved.id));
      nameInput.value = '';
      loadedSetting = null;
      nameInput.placeholder = 'e.g. Pure maths path';
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
      loadedSetting = current;
      nameInput.placeholder = current.name;
      nameInput.value = '';
      resetDropdown();
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
      if (loadedSetting && loadedSetting.id === current.id) {
        loadedSetting = null;
        nameInput.placeholder = 'e.g. Pure maths path';
      }
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

  // Add empty option first
  const emptyOption = document.createElement('option');
  emptyOption.value = '';
  emptyOption.textContent = '';
  select.append(emptyOption);

  appState.settingsCache.forEach((setting) => {
    const option = document.createElement('option');
    option.value = String(setting.id);
    option.textContent = `${setting.name} [${setting.catalogName}] (${setting.selectedCount} selected, ${setting.excludedCount} excluded)`;
    select.append(option);
  });

  select.value = selectedId || '';
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
