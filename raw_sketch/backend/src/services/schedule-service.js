'use strict';

const scheduleRepo = require('../db/schedule-repo');
const deviceRepo = require('../db/device-repo');
const prefsRepo = require('../db/prefs-repo');
const { logger } = require('../lib/logger');

const WEEKDAYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

class ScheduleService {
  constructor(commandService) {
    this.commandService = commandService;
  }

  list() {
    return scheduleRepo.findAll();
  }

  get(id) {
    return scheduleRepo.findById(id);
  }

  async create(input, devices = []) {
    const schedule = scheduleRepo.create(input);
    if (input.scope === 'devices') {
      scheduleRepo.setDevices(schedule.id, devices);
    }
    logger.info(`Schedule created: ${schedule.name} @ ${schedule.triggerTime}`);
    return this.get(schedule.id);
  }

  async update(id, fields, devices) {
    const schedule = scheduleRepo.updateFields(id, fields);
    if (!schedule) return null;
    if (fields.scope === 'devices') {
      scheduleRepo.setDevices(id, devices || []);
    } else if (fields.scope === 'room') {
      // Moving a schedule to room scope clears any device links.
      scheduleRepo.setDevices(id, []);
    }
    return this.get(id);
  }

  remove(id) {
    scheduleRepo.remove(id);
    logger.info(`Schedule removed: id=${id}`);
  }

  toggle(id) {
    const s = scheduleRepo.findById(id);
    if (!s) return null;
    return scheduleRepo.updateFields(id, { enabled: !s.enabled });
  }

  // Return schedules whose trigger_time matches the given Date's HH:MM.
  dueSchedules(now = new Date()) {
    const hh = String(now.getHours()).padStart(2, '0');
    const mm = String(now.getMinutes()).padStart(2, '0');
    const timeStr = `${hh}:${mm}`;
    const today = now.getDay(); // 0=Sun..6=Sat

    return scheduleRepo.findAll().filter((s) => {
      if (!s.enabled) return false;
      if (s.triggerTime !== timeStr) return false;
      if (s.repeatDays && s.repeatDays.trim().length > 0) {
        const days = s.repeatDays
          .split(',')
          .map((d) => parseInt(d, 10))
          .filter((n) => !Number.isNaN(n));
        if (days.length > 0 && !days.includes(today)) return false;
      }
      return true;
    });
  }

  async execute(schedule) {
    const notifyFailures = prefsRepo.get().notifyFailures;
    try {
      const devices = await this.resolveTargetDevices(schedule);
      if (devices.length === 0) {
        logger.warn(`[Scheduler] "${schedule.name}" — no target devices`);
        if (notifyFailures) scheduleRepo.markRun(schedule.id, { status: 'failed' });
        return { status: 'failed', reason: 'no devices' };
      }

      const results = [];
      for (const device of devices) {
        if (schedule.action === 'brightness') {
          const value = schedule.brightness ?? 100;
          results.push(await this.commandService.execute(device, 'led', value > 0 ? 'on' : 'off', String(value)));
        } else {
          const state = schedule.state === 'off' ? 'off' : 'on';
          results.push(await this.commandService.execute(device, 'led', state));
        }
      }

      scheduleRepo.markRun(schedule.id, { status: 'ok' });
      logger.info(`[Scheduler] Executed "${schedule.name}" on ${results.length} device(s)`);
      return { status: 'ok', devices: devices.length };
    } catch (err) {
      if (notifyFailures) scheduleRepo.markRun(schedule.id, { status: 'failed' });
      logger.error(`[Scheduler] "${schedule.name}" failed: ${err.message}`);
      return { status: 'failed', reason: err.message };
    }
  }

  async resolveTargetDevices(schedule) {
    if (schedule.scope === 'devices') {
      const ids = scheduleRepo.devicesForSchedule(schedule.id);
      return ids.map((id) => deviceRepo.findById(id)).filter(Boolean);
    }
    // room scope
    if (schedule.roomId != null) {
      return deviceRepo.findAll(schedule.roomId);
    }
    return [];
  }

  // Parse repeatDays "1,3,5" -> Array<{value,label}> for the UI.
  parseRepeatDays(repeatDays) {
    if (!repeatDays) return [];
    return repeatDays
      .split(',')
      .map((n) => parseInt(n, 10))
      .filter((n) => !Number.isNaN(n) && n >= 0 && n <= 6)
      .map((n) => ({ value: n, label: WEEKDAYS[n] }));
  }

  WEEKDAYS() {
    return WEEKDAYS;
  }
}

module.exports = { ScheduleService };