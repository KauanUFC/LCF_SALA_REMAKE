'use strict';

const path = require('path');
const fs = require('fs');
const express = require('express');

const { env } = require('./config/env');
const { logger } = require('./lib/logger');
const { MqttService } = require('./mqtt/mqtt-service');
const { SseService } = require('./services/sse-service');
const { DeviceService } = require('./services/device-service');
const { RoomService } = require('./services/room-service');
const { CommandService } = require('./services/command-service');
const { OtaService } = require('./services/ota-service');
const { ScheduleService } = require('./services/schedule-service');
const { Scheduler } = require('./services/scheduler');
const { SceneService } = require('./services/scene-service');
const { AlertsService } = require('./services/alerts-service');

const { infoRoutes } = require('./routes/info');
const { brokerRoutes } = require('./routes/broker');
const { deviceRoutes } = require('./routes/devices');
const { roomRoutes } = require('./routes/rooms');
const { commandRoutes } = require('./routes/commands');
const { otaRoutes } = require('./routes/ota');
const { scheduleRoutes } = require('./routes/schedules');
const { sceneRoutes } = require('./routes/scenes');
const { prefsRoutes } = require('./routes/prefs');
const { alertsRoutes } = require('./routes/alerts');
const { eventsRoutes } = require('./routes/events');

function createApp() {
  const app = express();
  app.use(express.json());

  // Services
  const mqttService = new MqttService();
  const sseService = new SseService();
  const commandService = new CommandService(mqttService);
  const deviceService = new DeviceService(sseService);
  const roomService = new RoomService(sseService, commandService);
  const otaService = new OtaService();
  const scheduleService = new ScheduleService(commandService);
  const scheduler = new Scheduler(scheduleService);
  const sceneService = new SceneService(commandService);
  const alertsService = new AlertsService();

  // Wire MQTT input to device service.
  mqttService.on({
    telemetry: (mac, payload, retained) => deviceService.handleTelemetry(mac, payload, retained),
  });

  // Routes
  app.use(infoRoutes());
  app.use(brokerRoutes(() => mqttService.connected));
  app.use(roomRoutes(roomService));
  app.use(deviceRoutes(deviceService, commandService));
  app.use(commandRoutes(deviceService, commandService));
  app.use(otaRoutes(deviceService, otaService));
  app.use(scheduleRoutes(scheduleService));
  app.use(sceneRoutes(sceneService));
  app.use(prefsRoutes());
  app.use(alertsRoutes(alertsService));
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

  return { app, services: { mqttService, sseService, deviceService, roomService, scheduleService, scheduler } };
}

module.exports = { createApp };