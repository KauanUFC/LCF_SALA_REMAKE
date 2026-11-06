'use strict';

const { getDb } = require('./connection');

function mapDevice(row) {
  if (!row) return null;
  return {
    id: row.id,
    roomId: row.room_id,
    name: row.name,
    mac: row.mac,
    deviceId: row.device_id,
    deviceType: row.device_type,
    connectionMethod: row.connection_method,
    ip: row.ip,
    mqttTopic: row.mqtt_topic,
    status: row.status,
    error: row.error,
    commandMode: row.command_mode,
    commands: safeJson(row.commands_json, []),
    lastTelemetry: row.last_telemetry_json ? safeJson(row.last_telemetry_json, null) : null,
    lastTelemetryTs: row.last_seen || 0,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function safeJson(text, fallback) {
  try {
    return text ? JSON.parse(text) : fallback;
  } catch {
    return fallback;
  }
}

function findAll(roomId) {
  let rows;
  if (roomId === undefined) {
    rows = getDb().prepare('SELECT * FROM devices ORDER BY created_at ASC').all();
  } else {
    rows = getDb().prepare('SELECT * FROM devices WHERE room_id = ? ORDER BY created_at ASC').all(roomId);
  }
  return rows.map(mapDevice);
}

function findById(id) {
  const row = getDb().prepare('SELECT * FROM devices WHERE id = ?').get(id);
  return mapDevice(row);
}

function findByMac(mac) {
  const row = getDb().prepare('SELECT * FROM devices WHERE mac = ?').get(mac);
  return mapDevice(row);
}

function create({ name, ip, roomId, deviceType, commands, mac }) {
  const now = Date.now();
  const { lastInsertRowid } = getDb()
    .prepare(
      `INSERT INTO devices (room_id, name, mac, ip, device_type, status, commands_json, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, 'connecting', ?, ?, ?)`
    )
    .run(
      roomId || null,
      name,
      mac || null,
      ip || '',
      deviceType || 'relay',
      JSON.stringify(commands || []),
      now,
      now,
    );
  return findById(lastInsertRowid);
}

function updateFields(id, fields) {
  const setClauses = [];
  const values = [];
  for (const [col, val] of Object.entries(fields)) {
    if (val !== undefined) {
      setClauses.push(`${col} = ?`);
      values.push(typeof val === 'object' && val !== null ? JSON.stringify(val) : val);
    }
  }
  if (setClauses.length === 0) return findById(id);
  setClauses.push('updated_at = ?');
  values.push(Date.now());
  values.push(id);
  getDb().prepare(`UPDATE devices SET ${setClauses.join(', ')} WHERE id = ?`).run(...values);
  return findById(id);
}

function updateStatus(id, { status, error = null, mac = null, deviceId = null, commands = null }) {
  const fields = {};
  if (status !== undefined && status !== null) fields.status = status;
  if (error !== undefined && error !== null) fields.error = error;
  if (mac !== undefined && mac !== null) fields.mac = mac;
  if (deviceId !== undefined && deviceId !== null) fields.device_id = deviceId;
  if (commands !== undefined && commands !== null) fields.commands_json = commands;
  return updateFields(id, fields);
}

function updateCommandMode(id, mode) {
  return updateFields(id, { command_mode: mode });
}

function touchTelemetry(id, telemetry) {
  getDb()
    .prepare(
      `UPDATE devices
       SET last_telemetry_json = ?, last_seen = ?, updated_at = ?
       WHERE id = ?`
    )
    .run(JSON.stringify(telemetry), Date.now(), Date.now(), id);
}

function setOffline(id) {
  updateFields(id, { status: 'error', error: 'Device is not responding' });
}

function remove(id) {
  getDb().prepare('DELETE FROM devices WHERE id = ?').run(id);
}

// Reserved telemetry history (commented for later enablement — see schema.sql).
// function insertTelemetry(deviceId, payload) { ... }
// function telemetryHistory(deviceId, limit) { ... }

module.exports = {
  mapDevice,
  findAll,
  findById,
  findByMac,
  create,
  updateFields,
  updateStatus,
  updateCommandMode,
  touchTelemetry,
  setOffline,
  remove,
};