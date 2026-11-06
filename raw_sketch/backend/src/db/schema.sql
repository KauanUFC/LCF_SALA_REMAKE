-- LCFLIGHT backend schema v4 — Phase 1: Rooms/Device Types, Phase 2: Schedules + Scenes
-- On startup, if DB_SCHEMA_VERSION < 4, old tables are dropped and recreated.

PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

-- ====================================================================
-- ACTIVE TABLES
-- ====================================================================

CREATE TABLE IF NOT EXISTS schema_version (
  version INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS rooms (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  name       TEXT NOT NULL UNIQUE,
  icon       TEXT NOT NULL DEFAULT '💡',
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS devices (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  room_id             INTEGER REFERENCES rooms(id) ON DELETE SET NULL,
  name                TEXT NOT NULL,
  mac                 TEXT,
  device_id           TEXT,
  device_type         TEXT NOT NULL DEFAULT 'relay',
  connection_method   TEXT NOT NULL DEFAULT 'http',
  ip                  TEXT,
  mqtt_topic          TEXT,
  status              TEXT NOT NULL DEFAULT 'connecting',
  error               TEXT,
  command_mode        TEXT NOT NULL DEFAULT 'http',
  commands_json       TEXT NOT NULL DEFAULT '[]',
  last_telemetry_json TEXT,
  last_seen           INTEGER,
  created_at          INTEGER NOT NULL,
  updated_at          INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS device_config (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  device_id           INTEGER NOT NULL UNIQUE REFERENCES devices(id) ON DELETE CASCADE,
  pwm_frequency       INTEGER,
  pwm_channel         INTEGER,
  led_count           INTEGER,
  color_temp_min      INTEGER,
  color_temp_max      INTEGER,
  supports_brightness BOOLEAN NOT NULL DEFAULT 0,
  supports_color      BOOLEAN NOT NULL DEFAULT 0,
  supports_effects    BOOLEAN NOT NULL DEFAULT 0,
  created_at          INTEGER NOT NULL,
  updated_at          INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS app_preferences (
  id                        INTEGER PRIMARY KEY,
  theme                     TEXT NOT NULL DEFAULT 'dark',
  brightness_unit           TEXT NOT NULL DEFAULT 'percent',
  default_view              TEXT NOT NULL DEFAULT 'dashboard',
  notify_offline            BOOLEAN NOT NULL DEFAULT 1,
  offline_threshold_minutes INTEGER NOT NULL DEFAULT 10,
  notify_updates            BOOLEAN NOT NULL DEFAULT 1,
  notify_failures           BOOLEAN NOT NULL DEFAULT 1
);

-- Schedules (Phase 2)
CREATE TABLE IF NOT EXISTS schedules (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  name            TEXT NOT NULL,
  room_id         INTEGER REFERENCES rooms(id) ON DELETE CASCADE,
  action          TEXT NOT NULL,
  trigger_time    TEXT NOT NULL,
  scope           TEXT NOT NULL DEFAULT 'room',
  repeat_days     TEXT,
  state           TEXT,
  brightness      INTEGER,
  enabled         BOOLEAN NOT NULL DEFAULT 1,
  last_run        INTEGER,
  last_run_status TEXT,
  created_at      INTEGER NOT NULL,
  updated_at      INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS schedule_devices (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  schedule_id INTEGER NOT NULL REFERENCES schedules(id) ON DELETE CASCADE,
  device_id   INTEGER NOT NULL REFERENCES devices(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_schedules_room ON schedules (room_id);
CREATE INDEX IF NOT EXISTS idx_schedule_devices_schedule ON schedule_devices (schedule_id);

-- ====================================================================
-- RESERVED TABLES — commented for later (enable by uncommenting)
-- ====================================================================

-- Scenes (Phase 2)
CREATE TABLE IF NOT EXISTS scenes (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  name       TEXT NOT NULL,
  room_id    INTEGER REFERENCES rooms(id) ON DELETE CASCADE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS scene_settings (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  scene_id    INTEGER NOT NULL REFERENCES scenes(id) ON DELETE CASCADE,
  device_id   INTEGER NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
  power       BOOLEAN NOT NULL,
  brightness  INTEGER,
  color_hex   TEXT,
  color_temp  INTEGER,
  created_at  INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_scenes_room ON scenes (room_id);
CREATE INDEX IF NOT EXISTS idx_scene_settings_scene ON scene_settings (scene_id);