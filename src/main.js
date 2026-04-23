import { listCatalogs, loadGraphData } from './dataLoader.js';
import { createGraphState } from './graph.js';
import { createRenderer } from './render.js';
import { getSetting, listSettings, saveSettings, updateSettings, deleteSettings } from './settingsApi.js';
import { createUiState } from './state.js';
import { createTooltip } from './tooltip.js';
import { COLORS } from './constants.js';

const THEME_KEY = 'moduleGraphTheme';
const SESSION_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const appState = {
  catalogs: [],
  currentCatalogId: null,
  currentYear: null,
  settingsCache: [],
  loadedSetting: null,
  sharedSettingId: null,
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
    return { subject: null, year: null, sessionId: null };
  }

  let sessionId = null;
  if (SESSION_ID_PATTERN.test(segments[segments.length - 1])) {
    sessionId = segments.pop();
  }

  const subject = segments[0] || null;
  const year = segments.length > 1 ? segments[1] : null;

  return { subject, year, sessionId };
}

function updateUrl(subject, year, sessionId = appState.sharedSettingId) {
  let path = '/';

  if (subject) {
    path += subject;
    if (year) {
      path += '/' + year;
    }
  }

  if (sessionId) {
    path += `${path.endsWith('/') ? '' : '/'}${encodeURIComponent(sessionId)}`;
  }

  window.history.replaceState({}, '', path);
}

function syncShareUrl() {
  updateUrl(appState.currentCatalogId, appState.currentYear, appState.sharedSettingId);
}

function setSharedSettingId(settingId) {
  appState.sharedSettingId = settingId ? String(settingId) : null;
  syncShareUrl();
}

function clearSharedSettingId() {
  if (!appState.sharedSettingId) return;
  appState.sharedSettingId = null;
  syncShareUrl();
}

function clearLoadedSetting() {
  appState.loadedSetting = null;
  const nameInput = document.getElementById('settings-name');
  if (nameInput) {
    nameInput.placeholder = 'e.g. first year plan';
  }
  const saveButton = document.getElementById('save-settings');
  if (saveButton) {
    const typedName = nameInput?.value.trim() || '';
    saveButton.textContent = typedName ? 'Save' : 'Save';
  }
}

function getSettingCatalogId(setting) {
  return setting?.state?.catalogId || setting?.catalogId || appState.catalogs[0]?.id || null;
}

function getRestoredSettingState(setting) {
  if (!setting) return null;
  return {
    ...setting.state,
    catalogId: getSettingCatalogId(setting),
    year: setting.state?.year || null,
    passed: setting.state?.passed || [],
  };
}

function getCatalogName(catalogId) {
  return appState.catalogs.find((catalog) => catalog.id === catalogId)?.name || catalogId;
}

function canPreviewSetting(setting) {
  const restoredState = getRestoredSettingState(setting);
  const needsCatalogSwitch = Boolean(restoredState?.catalogId && restoredState.catalogId !== appState.currentCatalogId);
  const needsYearSwitch = Boolean(restoredState?.year && restoredState.year !== appState.currentYear);
  return { restoredState, needsCatalogSwitch, needsYearSwitch };
}

function syncSelectedSettingPreview() {
  const selectedSetting = getSelectedSavedSetting();
  if (!selectedSetting || !appState.graphRuntime) {
    appState.graphRuntime?.setPreviewState(null);
    return;
  }

  const { restoredState, needsCatalogSwitch, needsYearSwitch } = canPreviewSetting(selectedSetting);
  appState.graphRuntime.setPreviewState(needsCatalogSwitch || needsYearSwitch ? null : restoredState);
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
    appState.sharedSettingId = null;
    updateUrl(null, null, null);
    showSubjectSelection();
  };
}

async function selectSubject(catalogId) {
  clearSharedSettingId();
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
    const { subject, year, sessionId } = parseUrl();
    if (sessionId) {
      try {
        const setting = await getSetting(sessionId);
        const restoredState = getRestoredSettingState(setting);
        appState.loadedSetting = setting;
        appState.sharedSettingId = String(setting.id);
        hideSubjectSelection();
        await renderCatalog(restoredState.catalogId, restoredState);
        document.getElementById('settings-name').placeholder = setting.name;
      } catch (error) {
        appState.sharedSettingId = null;
        showFeedback(`Shared session unavailable: ${error.message}`, true);
        if (subject) {
          const catalog = appState.catalogs.find(c => c.id === subject);
          if (catalog) {
            hideSubjectSelection();
            await renderCatalog(catalog.id, year);
          } else {
            showSubjectSelection();
          }
        } else {
          showSubjectSelection();
        }
      }
    } else if (subject) {
      const catalog = appState.catalogs.find(c => c.id === subject);
      if (catalog) {
        hideSubjectSelection();
        await renderCatalog(catalog.id, year);
      } else {
        // Invalid subject, show subject selection
        showSubjectSelection();
      }
    } else {
      showSubjectSelection();
    }

    try {
      await refreshSettings(appState.sharedSettingId || '');
    } catch (error) {
      showFeedback(`Saved settings unavailable: ${error.message}`, true);
    }
  } catch (error) {
    document.getElementById('status-text').innerHTML = `<div class="status-row status-row--single"><span class="status-empty">${error.message}</span></div>`;
  }
}

function setupCatalogSelector() {
  const select = document.getElementById('catalog-select');
  const nextYearButton = document.getElementById('next-year');
  select.innerHTML = '';

  appState.catalogs.forEach((catalog) => {
    const option = document.createElement('option');
    option.value = catalog.id;
    option.textContent = catalog.name;
    select.append(option);
  });

  select.addEventListener('change', async (event) => {
    clearSharedSettingId();
    clearLoadedSetting();
    await renderCatalog(event.target.value, appState.currentYear);
    showFeedback(`Showing ${select.selectedOptions[0]?.textContent || event.target.value}.`);
  });

  const yearSelect = document.getElementById('year-select');
  yearSelect.addEventListener('change', async (event) => {
    appState.currentYear = event.target.value;
    clearSharedSettingId();
    clearLoadedSetting();
    await renderCatalog(appState.currentCatalogId || appState.catalogs[0].id, appState.currentYear);
    showFeedback(`Showing ${event.target.value}.`);
  });

  nextYearButton.onclick = async () => {
    const currentCatalog = appState.catalogs.find((catalog) => catalog.id === appState.currentCatalogId) || appState.catalogs[0];
    const years = currentCatalog?.years || [];
    const currentIndex = years.indexOf(appState.currentYear);
    const nextYear = currentIndex >= 0 ? years[currentIndex + 1] : years[0];

    if (!nextYear) {
      showFeedback('No later year is available for this catalog.', true);
      return;
    }

    if (!appState.graphRuntime) {
      showFeedback('The current graph is still loading.', true);
      return;
    }

    const snapshot = appState.graphRuntime.snapshot();
    const nextPassed = [...new Set([...(snapshot.passed || []), ...(snapshot.selected || [])])];

    clearSharedSettingId();
    clearLoadedSetting();

    await renderCatalog(currentCatalog.id, {
      ...snapshot,
      catalogId: currentCatalog.id,
      year: nextYear,
      selected: [],
      passed: nextPassed,
    });

    showFeedback(`Advanced to ${nextYear}. Selected modules are now marked as passed.`);
  };
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
  syncSelectedSettingPreview();
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
  let previewState = null;

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
    clearSharedSettingId();
    if (uiState.selected.has(node.id)) {
      uiState.selected.delete(node.id);
    } else {
      uiState.selected.add(node.id);
      uiState.passed.delete(node.id);
      uiState.manualExcluded.delete(node.id);
    }
    syncUi();
    tooltip.showTip(node);
  };

  const togglePassed = (node) => {
    clearSharedSettingId();
    if (uiState.passed.has(node.id)) {
      uiState.passed.delete(node.id);
    } else {
      uiState.passed.add(node.id);
      uiState.selected.delete(node.id);
      uiState.manualExcluded.delete(node.id);
    }
    syncUi();
    tooltip.showTip(node);
  };

  const toggleExcluded = (node) => {
    clearSharedSettingId();
    if (uiState.manualExcluded.has(node.id)) {
      uiState.manualExcluded.delete(node.id);
    } else {
      uiState.manualExcluded.add(node.id);
      uiState.selected.delete(node.id);
      uiState.passed.delete(node.id);
      graphState.computeEffectivelyExcluded(uiState.manualExcluded).forEach((id) => {
        uiState.selected.delete(id);
        uiState.passed.delete(id);
      });
    }
    syncUi();
    tooltip.showTip(node);
  };

  const tooltip = createTooltip({
    prereqRules,
    manualExcluded: uiState.manualExcluded,
    selected: uiState.selected,
    passed: uiState.passed,
    graphState,
    onSelectToggle: toggleSelected,
    onPassedToggle: togglePassed,
    onExcludeToggle: toggleExcluded,
    onClose: closePanel,
  });

  const svg = d3.select('#graph-svg');
  const root = svg.append('g');
  const antiLayer = root.append('g').attr('class', 'links links--anti');
  const excludedLayer = root.append('g').attr('class', 'graph-excluded-layer');
  const linkLayer = root.append('g').attr('class', 'links');
  const nodeLayer = root.append('g').attr('class', 'nodes');

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

  const linkSel = linkLayer
    .selectAll('line').data(edges).join('line').attr('fill', 'none');

  const nodeG = nodeLayer
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
    antiLayer: antiLayer.node(),
    excludedLayer: excludedLayer.node(),
    linkLayer: linkLayer.node(),
    nodeLayer: nodeLayer.node(),
    manualExcluded: uiState.manualExcluded,
    selected: uiState.selected,
    passed: uiState.passed,
    getHoverId: () => uiState.getActiveNodeId() || uiState.getHoverId(),
    getPreviewState: () => previewState,
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
    const getClampedPoint = (node) => {
      const radius = getNodeRadius(node);
      return {
        x: Math.max(radius + 8, Math.min(width - radius - 8, node.x ?? width / 2)),
        y: Math.max(radius + 8, Math.min(height - radius - 8, node.y ?? height / 2)),
      };
    };

    linkSel
      .attr('x1', (edge) => {
        const source = getClampedPoint(edge.source);
        const target = getClampedPoint(edge.target);
        const dx = target.x - source.x;
        const dy = target.y - source.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        const radius = getNodeRadius(edge.source);
        return source.x + (dx / dist) * radius;
      })
      .attr('y1', (edge) => {
        const source = getClampedPoint(edge.source);
        const target = getClampedPoint(edge.target);
        const dx = target.x - source.x;
        const dy = target.y - source.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        const radius = getNodeRadius(edge.source);
        return source.y + (dy / dist) * radius;
      })
      .attr('x2', (edge) => {
        const source = getClampedPoint(edge.source);
        const target = getClampedPoint(edge.target);
        const dx = target.x - source.x;
        const dy = target.y - source.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        const radius = getNodeRadius(edge.target);
        return target.x - (dx / dist) * radius;
      })
      .attr('y2', (edge) => {
        const source = getClampedPoint(edge.source);
        const target = getClampedPoint(edge.target);
        const dx = target.x - source.x;
        const dy = target.y - source.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        const radius = getNodeRadius(edge.target);
        return target.y - (dy / dist) * radius;
      });

    nodeG.attr('transform', (node) => {
      const clamped = getClampedPoint(node);
      node.x = clamped.x;
      node.y = clamped.y;
      return `translate(${clamped.x},${clamped.y})`;
    });
  });

  wireCommonControls(uiState, graphState, renderer, tooltip, linkSel, labels, circles, syncUi, refreshSimulation);
  document.getElementById('status-text').textContent = `Showing ${catalog.name}. Hover to explore, or click a node to pin its details.`;

  return {
    catalog,
    uiState,
    graphState,
    syncUi,
    setPreviewState: (snapshot = null) => {
      previewState = snapshot ? {
        manualExcluded: new Set(snapshot.excluded || []),
        selected: new Set(snapshot.selected || []),
        passed: new Set(snapshot.passed || []),
      } : null;
      renderer.render();
    },
    snapshot: () => ({
      catalogId: catalog.id,
      year: appState.currentYear,
      selected: [...uiState.selected],
      passed: [...uiState.passed],
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
      clearSharedSettingId();
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
    clearSharedSettingId();
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
  const saveButton = document.getElementById('save-settings');
  const loadButton = document.getElementById('load-settings');
  const deleteButton = document.getElementById('delete-settings');
  const settingsList = document.getElementById('saved-settings-list');

  const defaultPlaceholder = 'e.g. first year plan';

  const clearPreview = () => {
    appState.graphRuntime?.setPreviewState(null);
  };

  // Function to reset dropdown to empty
  const resetDropdown = () => {
    settingsList.value = '';
    clearPreview();
    showFeedback('');
  };

  const resetLoadedSetting = () => {
    clearLoadedSetting();
    nameInput.placeholder = defaultPlaceholder;
    updateSaveButtonLabel();
  };

  const getLoadedSetting = () => appState.loadedSetting;

  const updateSaveButtonLabel = () => {
    const loadedSetting = getLoadedSetting();
    const typedName = nameInput.value.trim();
    const effectiveName = typedName || loadedSetting?.name || '';
    const isUpdate = Boolean(loadedSetting && effectiveName === loadedSetting.name);
    saveButton.textContent = isUpdate ? 'Update' : 'Save';
  };

  const switchToSettingPreview = async (setting, switchCatalog = false, switchYear = false) => {
    const { restoredState } = canPreviewSetting(setting);
    if (!restoredState) return;

    const nextCatalogId = switchCatalog ? restoredState.catalogId : appState.currentCatalogId;
    const nextState = {
      ...restoredState,
      catalogId: nextCatalogId,
      year: switchYear ? restoredState.year : appState.currentYear,
    };

    await renderCatalog(nextCatalogId, nextState);
    settingsList.value = String(setting.id);
    const refreshedSetting = appState.settingsCache.find((candidate) => candidate.id === setting.id) || setting;
    const previewStatus = canPreviewSetting(refreshedSetting);
    if (previewStatus.needsCatalogSwitch || previewStatus.needsYearSwitch) {
      showPreview(refreshedSetting);
      return;
    }

    appState.graphRuntime?.setPreviewState(previewStatus.restoredState);
    showFeedback(`Preview: ${refreshedSetting.name} - ${getCatalogName(previewStatus.restoredState.catalogId)} (${refreshedSetting.selectedCount} selected, ${refreshedSetting.excludedCount} excluded)`);
  };

  // Function to show preview of selected setting
  const showPreview = (setting) => {
    if (!setting) {
      clearPreview();
      showFeedback('');
      return;
    }

    const { restoredState, needsCatalogSwitch, needsYearSwitch } = canPreviewSetting(setting);
    if (needsCatalogSwitch) {
      clearPreview();
      showFeedback(`Preview unavailable, please switch to ${getCatalogName(restoredState.catalogId)}.`, false, [
        {
          label: 'Switch',
          onClick: async () => switchToSettingPreview(setting, true, true),
        },
      ]);
      return;
    }

    if (needsYearSwitch) {
      clearPreview();
      showFeedback(`Preview unavailable, please switch to ${restoredState.year}.`, false, [
        {
          label: 'Switch',
          onClick: async () => switchToSettingPreview(setting, false, true),
        },
      ]);
      return;
    }

    appState.graphRuntime?.setPreviewState(restoredState);
    showFeedback(`Preview: ${setting.name} - ${getCatalogName(restoredState.catalogId)} (${setting.selectedCount} selected, ${setting.excludedCount} excluded)`);
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

  nameInput.addEventListener('input', () => {
    updateSaveButtonLabel();
  });

  form.onsubmit = async (event) => {
    event.preventDefault();
    const typedName = nameInput.value.trim();
    const loadedSetting = getLoadedSetting();
    const name = typedName || loadedSetting?.name || '';
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
      let action = 'Saved';

      if (loadedSetting && name === loadedSetting.name) {
        saved = await updateSettings(loadedSetting.id, { name, state });
        action = 'Updated';
      } else {
        saved = await saveSettings({ name, state });
      }

      await refreshSettings(String(saved.id));
      nameInput.value = '';
      appState.loadedSetting = saved;
      nameInput.placeholder = saved.name;
      setSharedSettingId(saved.id);
      updateSaveButtonLabel();
      resetDropdown();
      showFeedback(`${action} "${saved.name}".`);
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
      const restoredState = getRestoredSettingState(current);
      await renderCatalog(restoredState.catalogId, restoredState);
      appState.loadedSetting = current;
      setSharedSettingId(current.id);
      nameInput.placeholder = current.name;
      nameInput.value = '';
      updateSaveButtonLabel();
      resetDropdown();
      showFeedback(`Loaded "${current.name}".`);
    } catch (error) {
      showFeedback(error.message, true);
    }
  };

  deleteButton.onclick = async () => {
    const current = getSelectedSavedSetting();
    const loadedSetting = getLoadedSetting();
    if (!current) {
      showFeedback('Choose a saved setting to delete.', true);
      return;
    }

    try {
      await deleteSettings(current.id);
      await refreshSettings();
      appState.graphRuntime?.setPreviewState(null);
      if (appState.sharedSettingId === String(current.id)) {
        clearSharedSettingId();
      }
      if (loadedSetting && loadedSetting.id === current.id) {
        resetLoadedSetting();
      }
      showFeedback(`Deleted "${current.name}".`);
    } catch (error) {
      showFeedback(error.message, true);
    }
  };

  updateSaveButtonLabel();
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
    const yearLabel = setting.state?.year || 'No year';
    option.textContent = `${setting.name} [${setting.catalogName}, ${yearLabel}] (${setting.selectedCount} selected, ${setting.excludedCount} excluded)`;
    select.append(option);
  });

  select.value = selectedId || '';
}

function getSelectedSavedSetting() {
  const value = document.getElementById('saved-settings-list').value;
  return appState.settingsCache.find((setting) => String(setting.id) === value) || null;
}

function showFeedback(message, isError = false, actions = []) {
  const feedback = document.getElementById('settings-feedback');
  feedback.innerHTML = '';

  const messageNode = document.createElement('span');
  messageNode.textContent = message;
  feedback.append(messageNode);

  actions.forEach((action) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'settings-feedback-action';
    button.textContent = action.label;
    button.onclick = async (event) => {
      event.stopPropagation();
      try {
        await action.onClick();
      } catch (error) {
        showFeedback(error.message, true);
      }
    };
    feedback.append(button);
  });

  feedback.dataset.state = isError ? 'error' : 'ok';
}
