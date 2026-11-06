'use strict';

// Single source of truth for MQTT topic construction.
// The firmware publishes and subscribes to the following layout:
//   {prefix}/{mac}/telemetry      -> device telemetry JSON
//   {prefix}/{mac}/cmd/{command}  -> command input from backend (published by us)

const { env } = require('./env');

function deviceBase(mac) {
  return `${env.MQTT_PREFIX}/${mac}`;
}

function telemetryTopic(mac) {
  return `${env.MQTT_PREFIX}/${mac}/telemetry`;
}

function statusTopic(mac) {
  return `${env.MQTT_PREFIX}/${mac}/status`;
}

function commandTopic(mac, commandId) {
  return `${env.MQTT_PREFIX}/${mac}/cmd/${commandId}`;
}

// Subscriptions for all devices (wildcard MAC segment).
function telemetryWildcard() {
  return `${env.MQTT_PREFIX}/+/telemetry`;
}

function statusWildcard() {
  return `${env.MQTT_PREFIX}/+/status`;
}

// Parses "{prefix}/{mac}/{suffix}" into its segments.
function parseTopic(topic) {
  const prefix = env.MQTT_PREFIX + '/';
  if (!topic.startsWith(prefix)) return null;
  const rest = topic.slice(prefix.length);
  const parts = rest.split('/');
  if (parts.length < 2) return null;
  return { mac: parts[0], suffix: parts.slice(1) };
}

module.exports = {
  deviceBase,
  telemetryTopic,
  statusTopic,
  commandTopic,
  telemetryWildcard,
  statusWildcard,
  parseTopic,
};