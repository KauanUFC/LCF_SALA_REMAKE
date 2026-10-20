'use strict';

const { Router } = require('express');

function deviceRoutes(deviceService) {
  const router = Router();

  router.post('/api/discover', async (req, res) => {
    try {
      const discovered = await deviceService.startDiscovery(10000);
      res.json({ discovered });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.get('/api/devices', (req, res) => {
    res.json(deviceService.list());
  });

  router.post('/api/devices', (req, res) => {
    const { name, description, ip } = req.body || {};
    if (!name || !ip) {
      return res.status(400).json({ error: 'name and ip are required' });
    }
    try {
      const device = deviceService.add({ name, description, ip });
      res.status(201).json(device);
    } catch (err) {
      res.status(err.statusCode || 400).json({ error: err.message });
    }
  });

  router.get('/api/devices/:id', (req, res) => {
    const device = deviceService.get(req.params.id);
    if (!device) return res.status(404).json({ error: 'Device not found' });
    res.json(device);
  });

  router.patch('/api/devices/:id', (req, res) => {
    const { commandMode } = req.body || {};
    if (commandMode && commandMode !== 'http' && commandMode !== 'mqtt') {
      return res.status(400).json({ error: 'commandMode must be "http" or "mqtt"' });
    }
    const device = deviceService.updateMode(req.params.id, commandMode);
    if (!device) return res.status(404).json({ error: 'Device not found' });
    res.json(device);
  });

  router.post('/api/devices/:id/retry', (req, res) => {
    const device = deviceService.retry(req.params.id);
    if (!device) return res.status(404).json({ error: 'Device not found' });
    res.json(device);
  });

  router.delete('/api/devices/:id', (req, res) => {
    const removed = deviceService.remove(req.params.id);
    if (!removed) return res.status(404).json({ error: 'Device not found' });
    res.json({ success: true });
  });

  return router;
}

module.exports = { deviceRoutes };