'use strict';

const { Router } = require('express');

function infoRoutes() {
  const router = Router();

  router.get('/api/info', (req, res) => {
    res.json({
      version: '2.0.0',
      backend: 'Express 5 + MQTT + SQLite',
      firmware: 'ESP32-C3 (Arduino)',
      protocol: 'HTTP + MQTT + SSE',
    });
  });

  return router;
}

module.exports = { infoRoutes };