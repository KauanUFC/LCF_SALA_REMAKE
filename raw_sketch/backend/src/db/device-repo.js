'use strict';

const crypto = require('crypto');
const { getDb } = require('./connection');

// Serialize a device row into the public device object.
function mapDevice(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    ip: row.ip,
    mac: row.mac,
    deviceId: row.device_id,
    status: row.status,
    error: row.error,
    commandMode: row.command_mode,
    commands: safeJson(row.commands_json, []),
    lastTelemetry: row.last_telemetry_json ? safeJson(row.last_telemetry_json, null) : null,
    lastTelemetryTs: row.last_seen || 0,
    createdAt: row.created_at,
  };
}

function safeJson(text, fallback) {
  try {
    return text ? JSON.parse(text) : fallback;
  } catch {
    return fallback;
  }
}

function newId() {
  return 'dev_' + crypto.randomBytes(4).toString('hex');
}

function findAll() {
  const rows = getDb()
    .prepare('SELECT * FROM devices ORDER BY created_at ASC')
    .all();
  return rows.map(mapDevice);
}

function findById(id) {
  const row = getDb().prepare('SELECT * FROM devices WHERE id = ?').get(id);
  return mapDevice(row);
}

// Allow auto-discovery: if a telemetry/status message arrives for a MAC that is
// not yet registered (device was added while offline, or broker retained the
// topic before discovery), upsert a minimal device so MQTT data can still flow.
function findByMac(mac) {
  const row = getDb().prepare('SELECT * FROM devices WHERE mac = ?').get(mac);
  return mapDevice(row);
}

function create({ name, description, ip, commands = [] }) {
  const id = newId();
  const now = Date.now();
  getDb()
    .prepare(
      `INSERT INTO devices (id, name, description, ip, status, commands_json, created_at)
       VALUES (?, ?, ?, ?, 'connecting', ?, ?)`
    )
    .run(id, name, description || '', ip, JSON.stringify(commands), now);
  return findById(id);
}

function updateStatus(id, { status, error = null, mac = null, deviceId = null, commands = null }) {
  const fields = [];
  const values = [];
  const set = (column, value) => {
    if (value !== undefined && value !== null) {
      fields.push(`${column} = ?`);
      values.push(typeof value === 'object' ? JSON.stringify(value) : value);
    }
  };

  set('status', status);
  set('error', error);
  set('mac', mac);
  set('device_id', deviceId);
  set('commands_json', commands);

  if (fields.length === 0) return findById(id);

  values.push(id);
  getDb().prepare(`UPDATE devices SET ${fields.join(', ')} WHERE id = ?`).run(...values);
  return findById(id);
}

function updateCommandMode(id, mode) {
  getDb().prepare('UPDATE devices SET command_mode = ? WHERE id = ?').run(mode, id);
  return findById(id);
}

function touchTelemetry(id, telemetry) {
  getDb()
    .prepare(
      `UPDATE devices
       SET last_telemetry_json = ?, last_seen = ?
       WHERE id = ?`
    )
    .run(JSON.stringify(telemetry), Date.now(), id);
}

function setOffline(id) {
  getDb().prepare('UPDATE devices SET status = ?, error = ? WHERE id = ?').run('error', null, id);
}

function remove(id) {
  getDb().prepare('DELETE FROM devices WHERE id = ?').run(id);
}

// ---------------------------------------------------------------------------
// [RESERVED] Telemetry history — implementation kept for later enablement.
// Uncomment and call from services/device-service.js (onMessage telemetry)
// after enabling the telemetry table in db/schema.sql.
// ---------------------------------------------------------------------------
//
// function insertTelemetry(deviceId, payload) {
//   const { env } = require('../config/env');
//   getDb()
//     .prepare(
//       `INSERT INTO telemetry (device_id, payload_json, received_at)
//        VALUES (?, ?, ?)`
//     )
//     .run(deviceId, JSON.stringify(payload), Date.now());
//
//   pruneTelemetry(deviceId, env.TELEMETRY_RETENTION_PER_DEVICE);
// }
//
// function pruneTelemetry(deviceId, keep) {
//   getDb()
//     .prepare(
//       `DELETE FROM telemetry
//        WHERE device_id = ? AND id NOT IN (
//          SELECT id FROM telemetry
//          WHERE device_id = ?
//          ORDER BY received_at DESC
//          LIMIT ?
//        )`
//     )
//     .run(deviceId, deviceId, keep);
// }
//
// function telemetryHistory(deviceId, limit = 100) {
//   const rows = getDb()
//     .prepare(
//       `SELECT payload_json, received_at
//        FROM telemetry
//        WHERE device_id = ?
//        ORDER BY received_at DESC
//        LIMIT ?`
//     )
//     .all(deviceId, limit);
//   return rows.map((r) => ({ payload: safeJson(r.payload_json, null), receivedAt: r.received_at }));
// }
// ---------------------------------------------------------------------------

module.exports = {
  findAll,
  findById,
  findByMac,
  create,
  updateStatus,
  updateCommandMode,
  touchTelemetry,
  setOffline,
  remove,
  // Reserved for later:
  // insertTelemetry,
  // telemetryHistory,
};