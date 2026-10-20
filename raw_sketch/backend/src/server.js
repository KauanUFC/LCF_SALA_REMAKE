'use strict';

const { env } = require('./config/env');
const { logger } = require('./lib/logger');
const { initDatabase, closeDatabase } = require('./db/connection');
const { createApp } = require('./app');

async function main() {
  initDatabase();

  const { app, services } = createApp();
  services.mqttService.connect();

  // Re-probe known devices kept in 'connecting' state from the previous run.
  services.deviceService.probe();

  const server = app.listen(env.PORT, '0.0.0.0', () => {
    logger.info(`LCFLIGHT backend listening on http://0.0.0.0:${env.PORT}`);
  });

  const shutdown = () => {
    logger.info('Shutting down...');
    server.close(() => {
      services.mqttService.disconnect();
      services.sseService.close();
      closeDatabase();
      process.exit(0);
    });
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((err) => {
  logger.error(`Failed to start server: ${err.message}`);
  process.exit(1);
});