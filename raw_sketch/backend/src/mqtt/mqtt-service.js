'use strict';

const mqtt = require('mqtt');
const { env } = require('../config/env');
const topics = require('../config/topics');
const { logger } = require('../lib/logger');

class MqttService {
  constructor() {
    this.client = null;
    this.connected = false;
  }

  connect() {
    const url = env.MQTT_BROKER_URL;
    const options = {};
    if (env.MQTT_USER) options.username = env.MQTT_USER;
    if (env.MQTT_PASS) options.password = env.MQTT_PASS;

    this.client = mqtt.connect(url, options);

    this.client.on('connect', () => {
      this.connected = true;
      const telemetry = topics.telemetryWildcard();
      this.client.subscribe(telemetry);
      logger.info(`MQTT connected to ${url}, subscribed to ${telemetry}`);
    });

    this.client.on('error', (err) => {
      logger.error(`MQTT error: ${err.message}`);
    });

    this.client.on('offline', () => {
      this.connected = false;
      logger.info('MQTT offline');
    });

    this.client.on('reconnect', () => {
      logger.info('MQTT reconnecting...');
    });

    this.client.on('message', (topic, message) => {
      this.handleMessage(topic, message);
    });
  }

  handleMessage(topic, message) {
    let payload;
    try {
      payload = JSON.parse(message.toString());
    } catch {
      return;
    }

    const parsed = topics.parseTopic(topic);
    if (!parsed) return;

    const suffix = parsed.suffix.join('/');
    if (suffix === 'telemetry') {
      this.topicHandlers?.telemetry?.(parsed.mac, payload);
    }
  }

  on(handlers) {
    this.topicHandlers = handlers;
  }

  publishCommand(mac, commandId, action) {
    if (!this.client || !this.connected) return false;
    const topic = topics.commandTopic(mac, commandId);
    const payload = JSON.stringify({ [commandId]: action });
    this.client.publish(topic, payload);
    return true;
  }

  disconnect() {
    if (this.client) {
      this.client.end(true);
      this.client = null;
      this.connected = false;
    }
  }
}

module.exports = { MqttService };