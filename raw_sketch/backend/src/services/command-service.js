'use strict';

const { env } = require('../config/env');

/**
 * Routes a high-level command to a device using either HTTP or MQTT,
 * depending on the device's configured commandMode.
 *
 * - HTTP: GET http://{ip}/{commandId}/{action}
 * - MQTT: publish {prefix}/{mac}/cmd/{commandId} {"<commandId>":"<action>"}
 */
class CommandService {
  constructor(mqttService) {
    this.mqtt = mqttService;
  }

  async execute(device, commandId, action) {
    if (!device || !commandId || !action) {
      const err = new Error('commandId and action required');
      err.statusCode = 400;
      throw err;
    }

    if (device.commandMode === 'mqtt') {
      if (!device.mac) throw new Error('MAC not yet discovered');
      const topic = this.mqtt.publishCommand(device.mac, commandId, action);
      return { commandId, action, mode: 'mqtt', topic };
    }

    // HTTP mode
    try {
      const url = `http://${device.ip}/${commandId}/${action}`;
      const res = await fetch(url, { signal: AbortSignal.timeout(env.COMMAND_TIMEOUT_MS) });
      const data = await res.json();
      return { commandId, action, mode: 'http', response: data };
    } catch (error) {
      const wrapped = new Error(`Command failed: ${error.message}`);
      wrapped.statusCode = 502;
      throw wrapped;
    }
  }
}

module.exports = { CommandService };