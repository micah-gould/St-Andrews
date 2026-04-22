import cors from 'cors';
import express from 'express';
import { createSetting, getSettings, removeSetting } from './db.js';
import { buildEdges, getCatalog, listCatalogs } from './moduleData.js';

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
  res.json({
    catalog: { id: catalog.id, name: catalog.name },
    nodes: catalog.nodes,
    prereqRules: catalog.prereqRules,
    edges: buildEdges(catalog),
  });
});

app.get('/api/settings', (_req, res) => {
  res.json(getSettings().map((setting) => ({
    ...setting,
    catalogName: getCatalog(setting.catalogId).name,
  })));
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
    mode: ['explore', 'select', 'exclude'].includes(state.mode) ? state.mode : 'explore',
    selected: Array.isArray(state.selected) ? state.selected : [],
    excluded: Array.isArray(state.excluded) ? state.excluded : [],
    blocked: Array.isArray(state.blocked) ? state.blocked : [],
  };

  const saved = createSetting(name.trim(), sanitizedState.catalogId, sanitizedState);
  saved.catalogName = getCatalog(saved.catalogId).name;
  res.status(201).json(saved);
});

app.delete('/api/settings/:id', (req, res) => {
  const id = Number.parseInt(req.params.id, 10);
  if (!Number.isInteger(id)) {
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
