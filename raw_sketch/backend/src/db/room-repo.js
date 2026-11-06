'use strict';

const { getDb } = require('./connection');
const deviceRepo = require('./device-repo');

function mapRoom(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    icon: row.icon,
    sortOrder: row.sort_order,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function findAll(search) {
  if (search && search.trim()) {
    const term = `%${search.trim()}%`;
    const rows = getDb()
      .prepare('SELECT * FROM rooms WHERE name LIKE ? ORDER BY sort_order ASC, name ASC')
      .all(term);
    return rows.map(mapRoom);
  }
  const rows = getDb().prepare('SELECT * FROM rooms ORDER BY sort_order ASC, name ASC').all();
  return rows.map(mapRoom);
}

function findById(id) {
  const row = getDb().prepare('SELECT * FROM rooms WHERE id = ?').get(id);
  return mapRoom(row);
}

function create({ name, icon }) {
  const now = Date.now();
  try {
    const { lastInsertRowid } = getDb()
      .prepare('INSERT INTO rooms (name, icon, created_at, updated_at) VALUES (?, ?, ?, ?)')
      .run(name, icon || '💡', now, now);
    return findById(lastInsertRowid);
  } catch (err) {
    throw toRoomError(err);
  }
}

function update(id, { name, icon }) {
  const fields = [];
  const values = [];
  if (name !== undefined) { fields.push('name = ?'); values.push(name); }
  if (icon !== undefined) { fields.push('icon = ?'); values.push(icon); }
  if (fields.length === 0) return findById(id);
  fields.push('updated_at = ?');
  values.push(Date.now());
  values.push(id);
  try {
    getDb().prepare(`UPDATE rooms SET ${fields.join(', ')} WHERE id = ?`).run(...values);
  } catch (err) {
    throw toRoomError(err);
  }
  return findById(id);
}

function toRoomError(err) {
  if (err && typeof err.code === 'string' && err.code.startsWith('SQLITE_CONSTRAINT')) {
    const conflict = new Error('A room with this name already exists');
    conflict.statusCode = 409;
    return conflict;
  }
  return err;
}

function remove(id) {
  getDb().prepare('DELETE FROM rooms WHERE id = ?').run(id);
}

function devicesInRoom(roomId) {
  const rows = getDb().prepare('SELECT * FROM devices WHERE room_id = ? ORDER BY name ASC').all(roomId);
  return rows.map(deviceRepo.mapDevice);
}

function aggregateStatus(roomId) {
  const devices = getDb().prepare('SELECT status, last_seen, last_telemetry_json FROM devices WHERE room_id = ?').all(roomId);
  const now = Date.now();
  const staleMs = 20000; // keep in sync with frontend TELEMETRY_STALE_MS
  let online = 0; let offline = 0; let busy = 0; let onCount = 0; let offCount = 0;
  for (const d of devices) {
    // Online is driven by live telemetry recency, not the stale HTTP-probe
    // status column (which never resets when a device drops offline).
    if (d.status === 'connecting') {
      busy++;
    } else if (d.last_seen && now - d.last_seen <= staleMs) {
      online++;
      // Telemetry is fresh — use its actual LED state.
      let on = false;
      if (d.last_telemetry_json) {
        try {
          on = JSON.parse(d.last_telemetry_json).led_state === 'on';
        } catch {
          on = false;
        }
      }
      if (on) onCount++; else offCount++;
    } else {
      offline++;
      offCount++; // offline devices are never "on"
    }
  }
  const allOn = onCount > 0 && offCount === 0;
  const allOff = offCount > 0 && onCount === 0;
  return { total: devices.length, online, offline, busy, allOn, allOff, mixed: !allOn && !allOff && devices.length > 0 };
}

module.exports = { findAll, findById, create, update, remove, devicesInRoom, aggregateStatus, mapRoom };