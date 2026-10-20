'use strict';

const path = require('path');
const fs = require('fs');
const express = require('express');

const { env } = require('./config/env');
const { logger } = require('./lib/logger');
const { MqttService } = require('./mqtt/mqtt-service');
const { SseService } = require('./services/sse-service');
const { DeviceService } = require('./services/device-service');
const { CommandService } = require('./services/command-service');
const { OtaService } = require('./services/ota-service');

const { infoRoutes } = require('./routes/info');
const { brokerRoutes } = require('./routes/broker');
const { deviceRoutes } = require('./routes/devices');
const { commandRoutes } = require('./routes/commands');
const { otaRoutes } = require('./routes/ota');
const { eventsRoutes } = require('./routes/events');

function createApp() {
  const app = express();
  app.use(express.json());

  // Services
  const mqttService = new MqttService();
  const sseService = new SseService();
  const deviceService = new DeviceService(sseService);
  const commandService = new CommandService(mqttService);
  const otaService = new OtaService();

  // Wire MQTT input to device service.
  mqttService.on({
    telemetry: (mac, payload) => deviceService.handleTelemetry(mac, payload),
  });

  // Routes
  app.use(infoRoutes());
  app.use(brokerRoutes(() => mqttService.connected));
  app.use(deviceRoutes(deviceService));
  app.use(commandRoutes(deviceService, commandService));
  app.use(otaRoutes(deviceService, otaService));
  app.use(eventsRoutes(sseService, deviceService));

  // Serve compiled frontend when available (production mode).
  if (fs.existsSync(env.FRONTEND_DIR)) {
    app.use(express.static(env.FRONTEND_DIR));
    app.use((req, res, next) => {
      if (req.method !== 'GET' || req.path.startsWith('/api') || req.path.startsWith('/events')) {
        return next();
      }
      res.sendFile(path.join(env.FRONTEND_DIR, 'index.html'));
    });
    logger.info(`Serving frontend from ${env.FRONTEND_DIR}`);
  }

  // JSON 404 fallback for API paths.
  app.use('/api', (req, res) => {
    res.status(404).json({ error: 'Not found' });
  });

  // Central error handler.
  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    const status = err.statusCode || 500;
    logger.error(`${req.method} ${req.path} -> ${status}: ${err.message}`);
    if (!res.headersSent) {
      res.status(status).json({ error: err.message || 'Internal server error' });
    }
  });

  return { app, services: { mqttService, sseService, deviceService } };
}

module.exports = { createApp };