'use strict';

const { Router } = require('express');

function commandRoutes(deviceService, commandService) {
  const router = Router();

  router.post('/api/devices/:id/command', async (req, res) => {
    const device = deviceService.get(req.params.id);
    if (!device) return res.status(404).json({ error: 'Device not found' });

    const { commandId, action } = req.body || {};
    if (!commandId || !action) {
      return res.status(400).json({ error: 'commandId and action required' });
    }

    try {
      const result = await commandService.execute(device, commandId, action);
      res.json(result);
    } catch (err) {
      res.status(err.statusCode || 502).json({ error: err.message });
    }
  });

  return router;
}

module.exports = { commandRoutes };