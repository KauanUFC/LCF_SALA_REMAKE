'use strict';

const { getDb } = require('./connection');

function mapSchedule(row, deviceIds = []) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    roomId: row.room_id,
    action: row.action,
    triggerTime: row.trigger_time,
    scope: row.scope,
    repeatDays: row.repeat_days,
    state: row.state,
    brightness: row.brightness,
    enabled: !!row.enabled,
    lastRun: row.last_run,
    lastRunStatus: row.last_run_status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deviceIds,
  };
}

function findAll() {
  const rows = getDb().prepare('SELECT * FROM schedules ORDER BY trigger_time ASC, name ASC').all();
  return rows.map((row) => mapSchedule(row, devicesForSchedule(row.id)));
}

function findById(id) {
  const row = getDb().prepare('SELECT * FROM schedules WHERE id = ?').get(id);
  return mapSchedule(row, row ? devicesForSchedule(row.id) : []);
}

function create({ name, roomId, action, triggerTime, scope, repeatDays, state, brightness, enabled }) {
  const now = Date.now();
  const { lastInsertRowid } = getDb()
    .prepare(
      `INSERT INTO schedules
         (name, room_id, action, trigger_time, scope, repeat_days, state, brightness, enabled, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      name, roomId || null, action, triggerTime, scope || 'room',
      repeatDays || null, state || null, brightness ?? null,
      enabled === false ? 0 : 1, now, now,
    );
  return findById(lastInsertRowid);
}

function updateFields(id, fields) {
  const allowed = {
    name: 'name',
    roomId: 'room_id',
    action: 'action',
    triggerTime: 'trigger_time',
    scope: 'scope',
    repeatDays: 'repeat_days',
    state: 'state',
    brightness: 'brightness',
    enabled: 'enabled',
  };
  const setClauses = [];
  const values = [];
  for (const [key, col] of Object.entries(allowed)) {
    if (fields[key] !== undefined) {
      setClauses.push(`${col} = ?`);
      const v = fields[key];
      values.push(key === 'enabled' ? (v === false || v === 0 ? 0 : 1) : v ?? null);
    }
  }
  if (setClauses.length === 0) return findById(id);
  setClauses.push('updated_at = ?');
  values.push(Date.now());
  values.push(id);
  getDb().prepare(`UPDATE schedules SET ${setClauses.join(', ')} WHERE id = ?`).run(...values);
  return findById(id);
}

function remove(id) {
  getDb().prepare('DELETE FROM schedules WHERE id = ?').run(id);
}

function markRun(id, { status }) {
  getDb()
    .prepare('UPDATE schedules SET last_run = ?, last_run_status = ?, updated_at = ? WHERE id = ?')
    .run(Date.now(), status, Date.now(), id);
}

function setDevices(scheduleId, deviceIds) {
  getDb().prepare('DELETE FROM schedule_devices WHERE schedule_id = ?').run(scheduleId);
  const stmt = getDb().prepare('INSERT INTO schedule_devices (schedule_id, device_id) VALUES (?, ?)');
  for (const did of deviceIds || []) {
    stmt.run(scheduleId, did);
  }
}

function devicesForSchedule(scheduleId) {
  const rows = getDb().prepare('SELECT device_id FROM schedule_devices WHERE schedule_id = ?').all(scheduleId);
  return rows.map((r) => r.device_id);
}

module.exports = {
  findAll,
  findById,
  create,
  updateFields,
  remove,
  markRun,
  setDevices,
  devicesForSchedule,
};