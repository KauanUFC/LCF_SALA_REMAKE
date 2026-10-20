-- LCFLIGHT backend schema
-- better-sqlite3 executes this file on startup (CREATE TABLE IF NOT EXISTS).

PRAGMA journal_mode = WAL;

CREATE TABLE IF NOT EXISTS devices (
  id               TEXT PRIMARY KEY,
  name             TEXT NOT NULL,
  description      TEXT NOT NULL DEFAULT '',
  ip               TEXT NOT NULL,
  mac              TEXT,
  device_id        TEXT,
  status           TEXT NOT NULL DEFAULT 'connecting',
  error            TEXT,
  command_mode     TEXT NOT NULL DEFAULT 'http',
  commands_json    TEXT NOT NULL DEFAULT '[]',
  last_telemetry_json TEXT,
  last_seen        INTEGER,
  created_at       INTEGER NOT NULL
);

-- [RESERVED] Telemetry history. Schema is defined for later use but is NOT
-- created yet. Uncomment the block below (and the insertion call inside
-- services/device-service.js) to enable persistence of every telemetry sample.
--
-- CREATE TABLE IF NOT EXISTS telemetry (
--   id            INTEGER PRIMARY KEY AUTOINCREMENT,
--   device_id     TEXT NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
--   payload_json  TEXT NOT NULL,
--   received_at   INTEGER NOT NULL
-- );
--
-- CREATE INDEX IF NOT EXISTS idx_telemetry_device_received
--   ON telemetry (device_id, received_at);