'use strict';

const { Router } = require('express');

function brokerRoutes(getMqttConnected) {
  const router = Router();

  router.get('/api/config', (req, res) => {
    res.json({ mqtt_connected: getMqttConnected() });
  });

  return router;
}

module.exports = { brokerRoutes };