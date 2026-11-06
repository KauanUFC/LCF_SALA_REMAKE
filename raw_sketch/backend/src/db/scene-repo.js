'use strict';

const { getDb } = require('./connection');

function mapScene(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    roomId: row.room_id,
    sortOrder: row.sort_order,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapSetting(row) {
  if (!row) return null;
  return {
    id: row.id,
    sceneId: row.scene_id,
    deviceId: row.device_id,
    power: !!row.power,
    brightness: row.brightness,
    colorHex: row.color_hex,
    colorTemp: row.color_temp,
    createdAt: row.created_at,
  };
}

function findAll() {
  const rows = getDb().prepare('SELECT * FROM scenes ORDER BY sort_order ASC, name ASC').all();
  return rows.map(mapScene);
}

function findById(id) {
  const row = getDb().prepare('SELECT * FROM scenes WHERE id = ?').get(id);
  return mapScene(row);
}

function create({ name, roomId }) {
  const now = Date.now();
  // Place at the end of the current sort order.
  const max = getDb().prepare('SELECT COALESCE(MAX(sort_order), 0) AS m FROM scenes').get();
  const { lastInsertRowid } = getDb()
    .prepare(
      `INSERT INTO scenes (name, room_id, sort_order, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?)`
    )
    .run(name, roomId || null, max.m + 1, now, now);
  return findById(lastInsertRowid);
}

function update(id, { name, roomId }) {
  const fields = [];
  const values = [];
  if (name !== undefined) { fields.push('name = ?'); values.push(name); }
  if (roomId !== undefined) { fields.push('room_id = ?'); values.push(roomId || null); }
  if (fields.length === 0) return findById(id);
  fields.push('updated_at = ?');
  values.push(Date.now());
  values.push(id);
  getDb().prepare(`UPDATE scenes SET ${fields.join(', ')} WHERE id = ?`).run(...values);
  return findById(id);
}

function reorder(id, sortOrder) {
  getDb().prepare('UPDATE scenes SET sort_order = ?, updated_at = ? WHERE id = ?').run(sortOrder, Date.now(), id);
  return findById(id);
}

function remove(id) {
  getDb().prepare('DELETE FROM scenes WHERE id = ?').run(id);
}

function settingsForScene(sceneId) {
  const rows = getDb().prepare('SELECT * FROM scene_settings WHERE scene_id = ?').all(sceneId);
  return rows.map(mapSetting);
}

// Replace all settings for a scene with the given list.
function replaceSettings(sceneId, settings) {
  getDb().prepare('DELETE FROM scene_settings WHERE scene_id = ?').run(sceneId);
  const stmt = getDb().prepare(
    `INSERT INTO scene_settings (scene_id, device_id, power, brightness, color_hex, color_temp, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  );
  const now = Date.now();
  for (const s of settings || []) {
    stmt.run(sceneId, s.deviceId, s.power ? 1 : 0, s.brightness ?? null, s.colorHex ?? null, s.colorTemp ?? null, now);
  }
}

module.exports = {
  findAll,
  findById,
  create,
  update,
  reorder,
  remove,
  settingsForScene,
  replaceSettings,
};