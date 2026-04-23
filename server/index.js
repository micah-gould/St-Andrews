import cors from 'cors';
import express from 'express';
import { createSetting, getSetting, getSettings, removeSetting, updateSetting } from './db.js';
import { getCatalog, getGraphData, listCatalogs } from './moduleData.js';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function parseSettingId(rawId) {
  return typeof rawId === 'string' && UUID_PATTERN.test(rawId) ? rawId : null;
}

const PORT = 5175;
const app = express();

app.use(cors());
app.use(express.json());

app.get('/api/health', (_req, res) => {
  res.json({ ok: true });
});

app.get('/api/catalogs', (_req, res) => {
  res.json(listCatalogs());
});

app.get('/api/modules', (req, res) => {
  const catalog = getCatalog(req.query.catalog);
  const year = typeof req.query.year === 'string' ? req.query.year : null;
  const graph = getGraphData(catalog, year);
  res.json({
    catalog: { id: catalog.id, name: catalog.name, years: catalog.years || [] },
    selectedYear: graph.selectedYear,
    nodes: graph.nodes,
    prereqRules: graph.prereqRules,
    edges: graph.edges,
  });
});

app.get('/api/settings', (_req, res) => {
  res.json(getSettings().map((setting) => ({
    ...setting,
    catalogName: getCatalog(setting.catalogId).name,
  })));
});

app.get('/api/settings/:id', (req, res) => {
  const id = parseSettingId(req.params.id);
  if (!id) {
    res.status(400).json({ error: 'Invalid settings id.' });
    return;
  }

  const setting = getSetting(id);
  if (!setting) {
    res.status(404).json({ error: 'Saved settings not found.' });
    return;
  }

  setting.catalogName = getCatalog(setting.catalogId).name;
  res.json(setting);
});

app.post('/api/settings', (req, res) => {
  const { name, state } = req.body || {};
  if (!name || typeof name !== 'string' || !name.trim()) {
    res.status(400).json({ error: 'A settings name is required.' });
    return;
  }

  if (!state || typeof state !== 'object') {
    res.status(400).json({ error: 'A state payload is required.' });
    return;
  }

  const sanitizedState = {
    catalogId: typeof state.catalogId === 'string' && state.catalogId ? state.catalogId : 'mathematics',
    year: typeof state.year === 'string' ? state.year : null,
    selected: Array.isArray(state.selected) ? state.selected : [],
    passed: Array.isArray(state.passed) ? state.passed : [],
    excluded: Array.isArray(state.excluded) ? state.excluded : [],
    blocked: Array.isArray(state.blocked) ? state.blocked : [],
  };

  const saved = createSetting(name.trim(), sanitizedState.catalogId, sanitizedState);
  saved.catalogName = getCatalog(saved.catalogId).name;
  res.status(201).json(saved);
});

app.put('/api/settings/:id', (req, res) => {
  const id = parseSettingId(req.params.id);
  if (!id) {
    res.status(400).json({ error: 'Invalid settings id.' });
    return;
  }

  const { name, state } = req.body || {};
  if (!name || typeof name !== 'string' || !name.trim()) {
    res.status(400).json({ error: 'A settings name is required.' });
    return;
  }

  if (!state || typeof state !== 'object') {
    res.status(400).json({ error: 'A state payload is required.' });
    return;
  }

  const sanitizedState = {
    catalogId: typeof state.catalogId === 'string' && state.catalogId ? state.catalogId : 'mathematics',
    year: typeof state.year === 'string' ? state.year : null,
    selected: Array.isArray(state.selected) ? state.selected : [],
    passed: Array.isArray(state.passed) ? state.passed : [],
    excluded: Array.isArray(state.excluded) ? state.excluded : [],
    blocked: Array.isArray(state.blocked) ? state.blocked : [],
  };

  const saved = updateSetting(id, name.trim(), sanitizedState.catalogId, sanitizedState);
  if (!saved) {
    res.status(404).json({ error: 'Saved settings not found.' });
    return;
  }

  saved.catalogName = getCatalog(saved.catalogId).name;
  res.json(saved);
});

app.delete('/api/settings/:id', (req, res) => {
  const id = parseSettingId(req.params.id);
  if (!id) {
    res.status(400).json({ error: 'Invalid settings id.' });
    return;
  }

  const result = removeSetting(id);
  if (!result.changes) {
    res.status(404).json({ error: 'Saved settings not found.' });
    return;
  }

  res.status(204).end();
});

app.listen(PORT, () => {
  console.log(`API listening on http://localhost:${PORT}`);
});
