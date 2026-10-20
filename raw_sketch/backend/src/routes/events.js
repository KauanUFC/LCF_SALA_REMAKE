'use strict';

const { Router } = require('express');

function eventsRoutes(sseService, deviceService) {
  const router = Router();

  router.get('/events', (req, res) => {
    sseService.addClient(res);
    // Replay current device states to the newly connected client.
    deviceService.replay(res);
  });

  return router;
}

module.exports = { eventsRoutes };