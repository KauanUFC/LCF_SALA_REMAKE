'use strict';

const { getDb } = require('./connection');

function mapConfig(row) {
  if (!row) return null;
  return {
    deviceId: row.device_id,
    pwmFrequency: row.pwm_frequency,
    pwmChannel: row.pwm_channel,
    ledCount: row.led_count,
    colorTempMin: row.color_temp_min,
    colorTempMax: row.color_temp_max,
    supportsBrightness: !!row.supports_brightness,
    supportsColor: !!row.supports_color,
    supportsEffects: !!row.supports_effects,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// Capability defaults per device type.
function defaultsForType(deviceType) {
  switch (deviceType) {
    case 'dimmable': return { supports_brightness: 1, supports_color: 0, supports_effects: 0 };
    case 'rgb': return { supports_brightness: 1, supports_color: 1, supports_effects: 0 };
    case 'strip': return { supports_brightness: 1, supports_color: 1, supports_effects: 1 };
    default: return { supports_brightness: 0, supports_color: 0, supports_effects: 0 };
  }
}

// Ensure a config row exists for the device, then return it.
function ensureForDevice(device) {
  const existing = getDb().prepare('SELECT * FROM device_config WHERE device_id = ?').get(device.id);
  if (existing) return mapConfig(existing);

  const now = Date.now();
  const d = defaultsForType(device.deviceType);
  getDb()
    .prepare(
      `INSERT INTO device_config
         (device_id, pwm_frequency, pwm_channel, led_count, color_temp_min, color_temp_max,
          supports_brightness, supports_color, supports_effects, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      device.id, 5000, 0, null, 2700, 6500,
      d.supports_brightness, d.supports_color, d.supports_effects, now, now,
    );
  return getDb().prepare('SELECT * FROM device_config WHERE device_id = ?').get(device.id);
}

function getForDevice(deviceId) {
  const row = getDb().prepare('SELECT * FROM device_config WHERE device_id = ?').get(deviceId);
  return row ? mapConfig(row) : null;
}

const ALLOWED = {
  pwmFrequency: 'pwm_frequency',
  pwmChannel: 'pwm_channel',
  ledCount: 'led_count',
  colorTempMin: 'color_temp_min',
  colorTempMax: 'color_temp_max',
  supportsBrightness: 'supports_brightness',
  supportsColor: 'supports_color',
  supportsEffects: 'supports_effects',
};

function updateForDevice(deviceId, fields) {
  const setClauses = [];
  const values = [];
  for (const [key, col] of Object.entries(ALLOWED)) {
    if (fields[key] !== undefined && fields[key] !== null) {
      setClauses.push(`${col} = ?`);
      let v = fields[key];
      if (typeof v === 'boolean') v = v ? 1 : 0;
      values.push(v);
    }
  }
  if (setClauses.length > 0) {
    setClauses.push('updated_at = ?');
    values.push(Date.now());
    values.push(deviceId);
    getDb().prepare(`UPDATE device_config SET ${setClauses.join(', ')} WHERE device_id = ?`).run(...values);
  }
  return getForDevice(deviceId);
}

module.exports = { getForDevice, ensureForDevice, updateForDevice, defaultsForType };