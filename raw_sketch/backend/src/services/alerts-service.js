'use strict';

const deviceRepo = require('../db/device-repo');
const prefsRepo = require('../db/prefs-repo');

/**
 * Computed alerts derived from the device registry.
 * Types: "offline" (device stopped reporting), "error", "connecting".
 */
class AlertsService {
  list() {
    const prefs = prefsRepo.get();
    const thresholdMin = prefs.offlineThresholdMinutes || 10;
    const thresholdMs = thresholdMin * 60 * 1000;
    const now = Date.now();
    const alerts = [];

    for (const d of deviceRepo.findAll()) {
      if (d.status === 'error') {
        alerts.push({
          id: `err-${d.id}`,
          type: 'error',
          deviceId: d.id,
          title: `${d.name} — Error`,
          message: d.error || 'Connection error',
          timestamp: now,
        });
        continue;
      }
      if (d.status === 'connecting') {
        alerts.push({
          id: `conn-${d.id}`,
          type: 'warning',
          deviceId: d.id,
          title: `${d.name} — Connecting`,
          message: 'Device is still connecting, awaiting probe...',
          timestamp: now,
        });
        continue;
      }
      // connected but no recent telemetry → offline (gated by notifyOffline pref)
      if (prefs.notifyOffline && d.lastTelemetryTs && now - d.lastTelemetryTs > thresholdMs) {
        alerts.push({
          id: `off-${d.id}`,
          type: 'error',
          deviceId: d.id,
          title: `${d.name} — Offline`,
          message: `No telemetry for ${thresholdMin} minute(s)`,
          timestamp: now,
        });
      }
    }

    return alerts;
  }

  // Helper for the frontend: per-device idle information.
  idleReport() {
    const now = Date.now();
    return deviceRepo.findAll().map((d) => ({
      id: d.id,
      name: d.name,
      status: d.status,
      lastSeen: d.lastTelemetryTs,
      idleMs: d.lastTelemetryTs ? now - d.lastTelemetryTs : null,
    }));
  }
}

module.exports = { AlertsService };