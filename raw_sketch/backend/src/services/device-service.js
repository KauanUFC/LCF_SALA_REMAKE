'use strict';

const { env } = require('../config/env');
const { eventBus } = require('../lib/event-bus');
const { logger } = require('../lib/logger');
const deviceRepo = require('../db/device-repo');

const DEFAULT_COMMANDS = [{ id: 'led', label: 'LED', type: 'binary', actions: ['on', 'off'] }];

function isValidIp(ip) {
  return (
    typeof ip === 'string' &&
    /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(ip)
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

  list() {
    return deviceRepo.findAll();
  }

  get(id) {
    return deviceRepo.findById(id);
  }

  add({ name, description, ip }) {
    if (!isValidIp(ip) && !String(ip || '').includes('.local')) {
      const err = new Error('Invalid IP address');
      err.statusCode = 400;
      throw err;
    }
    const device = deviceRepo.create({ name, description, ip, commands: DEFAULT_COMMANDS });
    this.broadcastStatus(device);
    this._probeOne(device.id);
    return device;
  }

  retry(id) {
    const device = deviceRepo.findById(id);
    if (!device) return null;
    this._probeOne(id);
    return deviceRepo.findById(id);
  }

  updateMode(id, mode) {
    const device = deviceRepo.findById(id);
    if (!device) return null;
    const updated = deviceRepo.updateCommandMode(id, mode);
    this.broadcastStatus(updated);
    return updated;
  }

  remove(id) {
    if (!deviceRepo.findById(id)) return null;
    deviceRepo.remove(id);
    this.sse.broadcast({ type: 'remove', deviceId: id });
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
        commands: commands || DEFAULT_COMMANDS,
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

  handleTelemetry(mac, payload) {
    const device = deviceRepo.findByMac(mac);

    if (device) {
      deviceRepo.touchTelemetry(device.id, payload);
      const latest = deviceRepo.findById(device.id);
      if (latest) {
        this.sse.broadcast({ type: 'telemetry', deviceId: device.id, data: payload });
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
      deviceId: device.id,
      data: {
        status: device.status,
        name: device.name,
        description: device.description,
        ip: device.ip,
        mac: device.mac,
        deviceId: device.deviceId,
        commands: device.commands,
        commandMode: device.commandMode,
        error: device.error,
      },
    });
  }

  replay(res) {
    for (const d of deviceRepo.findAll()) {
      const status = {
        type: 'status',
        deviceId: d.id,
        data: {
          status: d.status,
          name: d.name,
          description: d.description,
          ip: d.ip,
          mac: d.mac,
          deviceId: d.deviceId,
          commands: d.commands,
          commandMode: d.commandMode,
          error: d.error,
        },
      };
      res.write(`event: device_update\ndata: ${JSON.stringify(status)}\n\n`);
      if (d.lastTelemetry) {
        const tel = {
          type: 'telemetry',
          deviceId: d.id,
          data: d.lastTelemetry,
        };
        res.write(`event: device_update\ndata: ${JSON.stringify(tel)}\n\n`);
      }
    }
  }
}

module.exports = { DeviceService, DEFAULT_COMMANDS };