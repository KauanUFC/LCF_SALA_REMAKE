'use strict';

const { getDb } = require('./connection');

const DEFAULT_PREFS = {
  theme: 'dark',
  brightness_unit: 'percent',
  default_view: 'dashboard',
  notify_offline: 1,
  offline_threshold_minutes: 10,
  notify_updates: 1,
  notify_failures: 1,
};

function mapPrefs(row) {
  if (!row) return null;
  return {
    theme: row.theme,
    brightnessUnit: row.brightness_unit,
    defaultView: row.default_view,
    notifyOffline: !!row.notify_offline,
    offlineThresholdMinutes: row.offline_threshold_minutes,
    notifyUpdates: !!row.notify_updates,
    notifyFailures: !!row.notify_failures,
  };
}

// Ensure row exists (id = 1) and return it.
function get() {
  const row = getDb().prepare('SELECT * FROM app_preferences WHERE id = 1').get();
  if (row) return mapPrefs(row);
  getDb()
    .prepare(
      `INSERT INTO app_preferences (id, theme, brightness_unit, default_view, notify_offline, offline_threshold_minutes, notify_updates, notify_failures)
       VALUES (1, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      DEFAULT_PREFS.theme,
      DEFAULT_PREFS.brightness_unit,
      DEFAULT_PREFS.default_view,
      DEFAULT_PREFS.notify_offline,
      DEFAULT_PREFS.offline_threshold_minutes,
      DEFAULT_PREFS.notify_updates,
      DEFAULT_PREFS.notify_failures,
    );
  return mapPrefs(getDb().prepare('SELECT * FROM app_preferences WHERE id = 1').get());
}

const ALLOWED = {
  theme: 'theme',
  brightnessUnit: 'brightness_unit',
  defaultView: 'default_view',
  notifyOffline: 'notify_offline',
  offlineThresholdMinutes: 'offline_threshold_minutes',
  notifyUpdates: 'notify_updates',
  notifyFailures: 'notify_failures',
};

function update(fields) {
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
    values.push(1);
    getDb().prepare(`UPDATE app_preferences SET ${setClauses.join(', ')} WHERE id = ?`).run(...values);
  }
  return get();
}

module.exports = { get, update, DEFAULT_PREFS };