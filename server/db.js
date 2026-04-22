import Database from 'better-sqlite3';

const db = new Database(new URL('./data/app.sqlite', import.meta.url).pathname);

db.pragma('journal_mode = WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS saved_settings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    catalog_id TEXT NOT NULL DEFAULT 'mathematics',
    state_json TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )
`);

const columns = db.prepare(`PRAGMA table_info(saved_settings)`).all();
if (!columns.some((column) => column.name === 'catalog_id')) {
  db.exec(`ALTER TABLE saved_settings ADD COLUMN catalog_id TEXT NOT NULL DEFAULT 'mathematics'`);
}

const insertSetting = db.prepare(`
  INSERT INTO saved_settings (name, catalog_id, state_json)
  VALUES (@name, @catalogId, @stateJson)
`);

const listSavedSettings = db.prepare(`
  SELECT id, name, catalog_id, state_json, created_at, updated_at
  FROM saved_settings
  ORDER BY updated_at DESC, id DESC
`);

const getSavedSetting = db.prepare(`
  SELECT id, name, catalog_id, state_json, created_at, updated_at
  FROM saved_settings
  WHERE id = ?
`);

const deleteSavedSetting = db.prepare(`
  DELETE FROM saved_settings
  WHERE id = ?
`);

export function getSettings() {
  return listSavedSettings.all().map(mapRow);
}

export function createSetting(name, catalogId, state) {
  const stateJson = JSON.stringify(state);
  const result = insertSetting.run({ name, catalogId, stateJson });
  return mapRow(getSavedSetting.get(result.lastInsertRowid));
}

export function removeSetting(id) {
  return deleteSavedSetting.run(id);
}

function mapRow(row) {
  if (!row) return null;

  const state = JSON.parse(row.state_json);
  return {
    id: row.id,
    name: row.name,
    catalogId: row.catalog_id,
    catalogName: row.catalog_id,
    state,
    selectedCount: state.selected?.length || 0,
    excludedCount: state.excluded?.length || 0,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
