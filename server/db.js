import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { randomUUID } from 'crypto';

const __dirname = dirname(fileURLToPath(import.meta.url));
const db = new Database(join(__dirname, 'data', 'app.sqlite'));

db.pragma('journal_mode = WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS saved_settings (
    id TEXT PRIMARY KEY,
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

const idColumn = columns.find((column) => column.name === 'id');
if (idColumn && String(idColumn.type).toUpperCase() !== 'TEXT') {
  db.exec(`
    ALTER TABLE saved_settings RENAME TO saved_settings_legacy;

    CREATE TABLE saved_settings (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      catalog_id TEXT NOT NULL DEFAULT 'mathematics',
      state_json TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);

  const legacyRows = db.prepare(`
    SELECT id, name, catalog_id, state_json, created_at, updated_at
    FROM saved_settings_legacy
  `).all();

  const insertMigratedSetting = db.prepare(`
    INSERT INTO saved_settings (id, name, catalog_id, state_json, created_at, updated_at)
    VALUES (@id, @name, @catalogId, @stateJson, @createdAt, @updatedAt)
  `);

  const migrateRows = db.transaction((rows) => {
    rows.forEach((row) => {
      insertMigratedSetting.run({
        id: randomUUID(),
        name: row.name,
        catalogId: row.catalog_id,
        stateJson: row.state_json,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      });
    });
  });

  migrateRows(legacyRows);
  db.exec(`DROP TABLE saved_settings_legacy`);
}

const insertSetting = db.prepare(`
  INSERT INTO saved_settings (id, name, catalog_id, state_json)
  VALUES (@id, @name, @catalogId, @stateJson)
`);

const listSavedSettings = db.prepare(`
  SELECT id, name, catalog_id, state_json, created_at, updated_at
  FROM saved_settings
  ORDER BY updated_at DESC, created_at DESC
`);

const getSavedSetting = db.prepare(`
  SELECT id, name, catalog_id, state_json, created_at, updated_at
  FROM saved_settings
  WHERE id = ?
`);

const updateSavedSetting = db.prepare(`
  UPDATE saved_settings
  SET name = @name,
      catalog_id = @catalogId,
      state_json = @stateJson,
      updated_at = CURRENT_TIMESTAMP
  WHERE id = @id
`);

const deleteSavedSetting = db.prepare(`
  DELETE FROM saved_settings
  WHERE id = ?
`);

export function getSettings() {
  return listSavedSettings.all().map(mapRow);
}

export function getSetting(id) {
  return mapRow(getSavedSetting.get(id));
}

export function createSetting(name, catalogId, state) {
  const id = randomUUID();
  const stateJson = JSON.stringify(state);
  insertSetting.run({ id, name, catalogId, stateJson });
  return mapRow(getSavedSetting.get(id));
}

export function updateSetting(id, name, catalogId, state) {
  const stateJson = JSON.stringify(state);
  const result = updateSavedSetting.run({ id, name, catalogId, stateJson });
  if (!result.changes) return null;
  return mapRow(getSavedSetting.get(id));
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
