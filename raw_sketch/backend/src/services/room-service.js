'use strict';

const roomRepo = require('../db/room-repo');
const deviceRepo = require('../db/device-repo');
const { logger } = require('../lib/logger');

class RoomService {
  constructor(sse, commandService) {
    this.sse = sse;
    this.commandService = commandService;
  }

  list(search) {
    const rooms = roomRepo.findAll(search);
    return rooms.map((r) => ({
      ...r,
      devices: deviceRepo.findAll(r.id),
      aggregate: roomRepo.aggregateStatus(r.id),
    }));
  }

  get(id) {
    const room = roomRepo.findById(id);
    if (!room) return null;
    return {
      ...room,
      devices: deviceRepo.findAll(id),
      aggregate: roomRepo.aggregateStatus(id),
    };
  }

  create({ name, icon }) {
    const room = roomRepo.create({ name, icon });
    logger.info(`Room created: ${room.name} (id=${room.id})`);
    return room;
  }

  update(id, fields) {
    const updated = roomRepo.update(id, fields);
    if (updated) logger.info(`Room updated: ${updated.name}`);
    return updated;
  }

  remove(id) {
    roomRepo.remove(id);
    logger.info(`Room removed: id=${id}`);
  }

  async toggleRoom(id) {
    const devices = deviceRepo.findAll(id);
    if (devices.length === 0) return { toggled: 0 };

    // Determine target state: if any is off, turn all on; else turn all off.
    const anyOff = devices.some((d) => {
      if (!d.lastTelemetry) return true;
      return d.lastTelemetry.led_state !== 'on';
    });
    const target = anyOff ? 'on' : 'off';

    let toggled = 0;
    for (const device of devices) {
      try {
        await this.commandService.execute(device, 'led', target);
        toggled++;
      } catch (err) {
        logger.warn(`Room toggle failed for ${device.name}: ${err.message}`);
      }
    }
    return { toggled, target };
  }

  async setRoomBrightness(id, brightness) {
    const devices = deviceRepo.findAll(id);
    const dimmable = devices.filter((d) => d.deviceType === 'dimmable' || d.deviceType === 'rgb' || d.deviceType === 'strip');
    let applied = 0;
    for (const device of dimmable) {
      try {
        if (brightness > 0) {
          await this.commandService.execute(device, 'led', 'on', String(brightness));
        } else {
          await this.commandService.execute(device, 'led', 'off');
        }
        applied++;
      } catch (err) {
        logger.warn(`Room brightness failed for ${device.name}: ${err.message}`);
      }
    }
    return { applicable: dimmable.length, applied, brightness };
  }
}

module.exports = { RoomService };