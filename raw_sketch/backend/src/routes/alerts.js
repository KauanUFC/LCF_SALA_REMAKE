'use strict';

const { Router } = require('express');

function alertsRoutes(alertsService) {
  const router = Router();

  router.get('/api/alerts', (req, res) => {
    res.json(alertsService.list());
  });

  router.get('/api/alerts/idle', (req, res) => {
    res.json(alertsService.idleReport());
  });

  return router;
}

module.exports = { alertsRoutes };