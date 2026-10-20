'use strict';

const { resolve } = require('path');

function intOr(name, fallback) {
  const raw = process.env[name];
  if (raw === undefined || raw === '') return fallback;
  const value = parseInt(raw, 10);
  if (Number.isNaN(value)) {
    throw new Error(`Invalid integer in env ${name}: "${raw}"`);
  }
  return value;
}

function str(name, fallback = '') {
  const raw = process.env[name];
  return raw === undefined ? fallback : raw;
}

const env = {
  PORT: intOr('PORT', 3000),
  NODE_ENV: str('NODE_ENV', 'development'),

  DB_PATH: resolve(str('DB_PATH', './data/lcflight.db')),

  MQTT_BROKER_URL: str('MQTT_BROKER_URL', 'mqtt://broker.hivemq.com:1883'),
  MQTT_USER: str('MQTT_USER'),
  MQTT_PASS: str('MQTT_PASS'),
  MQTT_PREFIX: str('MQTT_PREFIX', 'esp32'),

  OTA_PORT: intOr('OTA_PORT', 8266),
  OTA_USER: str('OTA_USER', 'admin'),
  OTA_PASS: str('OTA_PASS'),

  PROBE_TIMEOUT_MS: intOr('PROBE_TIMEOUT_MS', 3000),
  COMMAND_TIMEOUT_MS: intOr('COMMAND_TIMEOUT_MS', 3000),
  SSE_HEARTBEAT_MS: intOr('SSE_HEARTBEAT_MS', 15000),

  TELEMETRY_RETENTION_PER_DEVICE: intOr('TELEMETRY_RETENTION_PER_DEVICE', 200),

  FRONTEND_DIR: resolve(str('FRONTEND_DIR', '../frontend/dist')),
};

module.exports = { env };