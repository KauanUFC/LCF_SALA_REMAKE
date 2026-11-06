'use strict';

const { env } = require('../config/env');
const { logger } = require('../lib/logger');
const deviceRepo = require('../db/device-repo');
const roomRepo = require('../db/room-repo');
const deviceConfigRepo = require('../db/device-config-repo');

const DEFAULT_COMMANDS = [{ id: 'led', label: 'LED', type: 'binary', actions: ['on', 'off'] }];

function isValidIp(ip) {
  return (
    typeof ip === 'string' &&
    /^(?:(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\.){3}(?:25[0-5]|2[0-4]\d|[01]?\d\d?)$/.test(ip)
  );
}

async function fetchJson(url, timeoutMs) {
  const res = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

class DeviceService {
  constructor(sse) {
    this.sse = sse;
    this.discoveryBuffer = new Map();
    this.discoveryActive = false;
  }

  list(roomId) {
    return deviceRepo.findAll(roomId);
  }

  get(id) {
    return deviceRepo.findById(id);
  }

  add({ name, ip, roomId, deviceType, mac }) {
    if (!isValidIp(ip) && !(ip || '').includes('.local')) {
      const err = new Error('Invalid IP address');
      err.statusCode = 400;
      throw err;
    }
    const device = deviceRepo.create({
      name,
      ip,
      roomId: roomId || null,
      deviceType: deviceType || 'relay',
      mac,
      commands: JSON.parse(JSON.stringify(DEFAULT_COMMANDS)),
    });
    deviceConfigRepo.ensureForDevice(device);
    this.broadcastStatus(device);
    this._probeOne(device.id);
    return device;
  }

  async retry(id) {
    const device = deviceRepo.findById(id);
    if (!device) return null;
    deviceRepo.updateFields(id, { status: 'connecting', error: null });
    this.broadcastStatus(deviceRepo.findById(id));
    await this._probeOne(id);
    return deviceRepo.findById(id);
  }

  update(id, fields) {
    const device = deviceRepo.findById(id);
    if (!device) return null;
    const updated = deviceRepo.updateFields(id, fields);
    this.broadcastStatus(updated);
    return updated;
  }

  remove(id) {
    if (!deviceRepo.findById(id)) return null;
    deviceRepo.remove(id);
    this.sse.broadcast({ type: 'remove', deviceId: String(id) });
    return true;
  }

  probe() {
    deviceRepo
      .findAll()
      .filter((d) => d.status === 'connecting')
      .forEach((d) => this._probeOne(d.id));
  }

  async _probeOne(id) {
    const device = deviceRepo.findById(id);
    if (!device) return;

    try {
      const info = await fetchJson(`http://${device.ip}/api/device`, env.PROBE_TIMEOUT_MS);
      let commands = null;
      try {
        const caps = await fetchJson(`http://${device.ip}/api/capabilities`, env.PROBE_TIMEOUT_MS);
        if (Array.isArray(caps.commands) && caps.commands.length > 0) commands = caps.commands;
      } catch {
        // capabilities are optional; keep defaults
      }

      const updated = deviceRepo.updateStatus(id, {
        status: 'connected',
        error: null,
        mac: info.mac || null,
        deviceId: info.device_id || null,
        commands: commands || JSON.parse(JSON.stringify(DEFAULT_COMMANDS)),
      });
      this.broadcastStatus(updated);
      logger.info(`Device connected: ${updated.name} @ ${updated.ip} (${updated.mac || 'n/a'})`);
    } catch (err) {
      const failed = deviceRepo.updateStatus(id, {
        status: 'error',
        error: err.message || 'Connection failed',
      });
      this.broadcastStatus(failed);
      logger.info(`Device failed: ${failed.name} @ ${failed.ip} — ${failed.error}`);
    }
  }

  startDiscovery(timeoutMs = 10000) {
    this.discoveryBuffer.clear();
    this.discoveryActive = true;
    logger.info('Discovery started — watching for new MACs on MQTT');

    return new Promise((resolve) => {
      setTimeout(() => {
        this.discoveryActive = false;
        const found = Array.from(this.discoveryBuffer.values());
        this.discoveryBuffer.clear();
        logger.info(`Discovery finished — ${found.length} device(s) found`);
        resolve(found);
      }, timeoutMs);
    });
  }

  handleTelemetry(mac, payload, retained = false) {
    const device = deviceRepo.findByMac(mac);

    if (device) {
      // Retained messages (delivered on subscribe) are stale — store the data
      // for display but don't reset last_seen so the staleness clock stays intact.
      if (retained) {
        deviceRepo.updateFields(device.id, { last_telemetry_json: JSON.stringify(payload) });
      } else {
        deviceRepo.touchTelemetry(device.id, payload);
      }
      const latest = deviceRepo.findById(device.id);
      if (latest) {
        this.sse.broadcast({ type: 'telemetry', deviceId: String(device.id), data: payload });
      }
      // During a discovery scan, also report already-registered devices so the
      // user can see which ones are already known (flagged, not re-added).
      if (this.discoveryActive && !this.discoveryBuffer.has(mac)) {
        this.discoveryBuffer.set(mac, {
          mac,
          name: device.name,
          ip: device.ip || payload.ip || 'unknown',
          deviceId: device.deviceId || payload.device_id || null,
          alreadyAdded: true,
        });
      }
      return;
    }

    if (this.discoveryActive && !this.discoveryBuffer.has(mac)) {
      const discovered = {
        mac,
        name: `ESP32 (${mac})`,
        ip: payload.ip || 'unknown',
        deviceId: payload.device_id || null,
      };
      this.discoveryBuffer.set(mac, discovered);
      logger.info(`Discovered new device during scan: ${mac}`);
    }
  }

  broadcastStatus(device) {
    if (!device) return;
    this.sse.broadcast({
      type: 'status',
      deviceId: String(device.id),
      data: {
        id: device.id,
        roomId: device.roomId,
        name: device.name,
        mac: device.mac,
        deviceId: device.deviceId,
        deviceType: device.deviceType,
        ip: device.ip,
        status: device.status,
        error: device.error,
        commandMode: device.commandMode,
        commands: device.commands,
        createdAt: device.createdAt,
      },
    });
  }

  replay(res) {
    for (const d of deviceRepo.findAll()) {
      const status = {
        type: 'status',
        deviceId: String(d.id),
        data: {
          id: d.id,
          roomId: d.roomId,
          name: d.name,
          mac: d.mac,
          deviceId: d.deviceId,
          deviceType: d.deviceType,
          ip: d.ip,
          status: d.status,
          error: d.error,
          commandMode: d.commandMode,
          commands: d.commands,
          createdAt: d.createdAt,
        },
      };
      res.write(`event: device_update\ndata: ${JSON.stringify(status)}\n\n`);
      if (d.lastTelemetry) {
        const tel = {
          type: 'telemetry',
          deviceId: String(d.id),
          data: d.lastTelemetry,
        };
        res.write(`event: device_update\ndata: ${JSON.stringify(tel)}\n\n`);
      }
    }
  }
}

module.exports = { DeviceService, DEFAULT_COMMANDS };