'use strict';

const { env } = require('../config/env');
const { logger } = require('../lib/logger');

// Small in-process event bus to decouple MQTT/device/services.
class EventBus {
  constructor() {
    this.handlers = new Map();
  }

  on(event, handler) {
    if (!this.handlers.has(event)) this.handlers.set(event, []);
    this.handlers.get(event).push(handler);
  }

  emit(event, ...args) {
    const list = this.handlers.get(event);
    if (!list) return;
    for (const fn of list) {
      try {
        fn(...args);
      } catch (err) {
        logger.error(`Event handler error for "${event}": ${err.message}`);
      }
    }
  }
}

module.exports = { eventBus: new EventBus() };