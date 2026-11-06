'use strict';

const sceneRepo = require('../db/scene-repo');
const deviceRepo = require('../db/device-repo');
const roomRepo = require('../db/room-repo');
const { logger } = require('../lib/logger');

class SceneService {
  constructor(commandService) {
    this.commandService = commandService;
  }

  list() {
    return sceneRepo.findAll().map((s) => ({
      ...s,
      settings: sceneRepo.settingsForScene(s.id),
    }));
  }

  get(id) {
    const scene = sceneRepo.findById(id);
    if (!scene) return null;
    return { ...scene, settings: sceneRepo.settingsForScene(id) };
  }

  create({ name, roomId, settings }) {
    const scene = sceneRepo.create({ name, roomId });
    sceneRepo.replaceSettings(scene.id, settings || []);
    logger.info(`Scene created: ${scene.name} (id=${scene.id})`);
    return this.get(scene.id);
  }

  // Snapshot the current states of every device in a room (or specific devices).
  snapshotFrom({ name, roomId, deviceIds }) {
    let devices = [];
    if (deviceIds && deviceIds.length > 0) {
      devices = deviceIds.map((id) => deviceRepo.findById(id)).filter(Boolean);
    } else if (roomId != null) {
      devices = deviceRepo.findAll(roomId);
    }

    const settings = devices
      .filter((d) => d.lastTelemetry)
      .map((d) => {
        const t = d.lastTelemetry || {};
        return {
          deviceId: d.id,
          power: t.led_state === 'on',
          brightness: typeof t.brightness === 'number' ? t.brightness : (t.led_state === 'on' ? 100 : 0),
          colorHex: t.color_hex || null,
          colorTemp: typeof t.color_temp === 'number' ? t.color_temp : null,
        };
      });

    return this.create({ name, roomId, settings });
  }

  update(id, { name, roomId, settings }) {
    const scene = sceneRepo.findById(id);
    if (!scene) return null;
    sceneRepo.update(id, { name, roomId });
    if (settings !== undefined) sceneRepo.replaceSettings(id, settings);
    return this.get(id);
  }

  remove(id) {
    sceneRepo.remove(id);
    logger.info(`Scene removed: id=${id}`);
  }

  reorder(id, sortOrder) {
    return sceneRepo.reorder(id, sortOrder);
  }

  async apply(id) {
    const scene = this.get(id);
    if (!scene) return null;
    const settings = scene.settings || [];
    if (settings.length === 0) return { status: 'ok', applied: 0 };

    let applied = 0;
    for (const s of settings) {
      const device = deviceRepo.findById(s.deviceId);
      if (!device) continue;
      try {
        await this.applyToDevice(device, s);
        applied++;
      } catch {
        // Skip devices that fail; continue with the rest.
      }
    }
    logger.info(`Scene applied: "${scene.name}" (${applied}/${settings.length})`);
    return { status: 'ok', applied, total: settings.length };
  }

  async applyToDevice(device, setting) {
    if (device.deviceType === 'dimmable' || device.deviceType === 'rgb' || device.deviceType === 'strip') {
      const value = setting.power ? (setting.brightness || 100) : 0;
      await this.commandService.execute(device, 'led', value > 0 ? 'on' : 'off', String(value));
    } else {
      await this.commandService.execute(device, 'led', setting.power ? 'on' : 'off');
    }
  }
}

module.exports = { SceneService };