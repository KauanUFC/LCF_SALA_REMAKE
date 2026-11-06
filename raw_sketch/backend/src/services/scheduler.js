'use strict';

const { env } = require('../config/env');
const { logger } = require('../lib/logger');

/**
 * Built-in in-process scheduler. Runs every SCHEDULER_TICK_MS, checks for
 * schedules whose trigger_time matches the current HH:MM, and executes them
 * at most once per minute (dedup by last-executed minute).
 */
class Scheduler {
  constructor(scheduleService) {
    this.scheduleService = scheduleService;
    this.timer = null;
    this.lastMinute = -1;
  }

  start() {
    if (this.timer) return;
    if (!env.SCHEDULER_ENABLED) {
      logger.info('Scheduler disabled (SCHEDULER_ENABLED=0)');
      return;
    }
    logger.info(`Scheduler started (tick ${env.SCHEDULER_TICK_MS}ms)`);
    this.timer = setInterval(() => this.tick(), env.SCHEDULER_TICK_MS);
  }

  stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
      logger.info('Scheduler stopped');
    }
  }

  tick() {
    const now = new Date();
    const minute = now.getHours() * 60 + now.getMinutes();
    if (minute === this.lastMinute) return;
    this.lastMinute = minute;

    const due = this.scheduleService.dueSchedules(now);
    Promise.allSettled(due.map((s) => this.scheduleService.execute(s)));
  }
}

module.exports = { Scheduler };