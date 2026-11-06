'use strict';

const { Router } = require('express');
const deviceConfigRepo = require('../db/device-config-repo');

function deviceRoutes(deviceService, commandService) {
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
    const roomId = req.query.room_id ? Number(req.query.room_id) : undefined;
    res.json(deviceService.list(roomId));
  });

  router.post('/api/devices', (req, res) => {
    const { name, ip, roomId, deviceType, mac } = req.body || {};
    if (!name || !ip) {
      return res.status(400).json({ error: 'name and ip are required' });
    }
    try {
      const device = deviceService.add({ name, ip, roomId, deviceType, mac });
      res.status(201).json(device);
    } catch (err) {
      res.status(err.statusCode || 400).json({ error: err.message });
    }
  });

  router.get('/api/devices/:id', (req, res) => {
    const device = deviceService.get(Number(req.params.id));
    if (!device) return res.status(404).json({ error: 'Device not found' });
    res.json(device);
  });

  router.put('/api/devices/:id', (req, res) => {
    const { name, roomId, deviceType } = req.body || {};
    const fields = {};
    if (name !== undefined) fields.name = name;
    if (roomId !== undefined) fields.room_id = roomId;
    if (deviceType !== undefined) fields.device_type = deviceType;
    const device = deviceService.update(Number(req.params.id), fields);
    if (!device) return res.status(404).json({ error: 'Device not found' });
    res.json(device);
  });

  router.patch('/api/devices/:id', (req, res) => {
    const { commandMode } = req.body || {};
    if (commandMode && commandMode !== 'http' && commandMode !== 'mqtt') {
      return res.status(400).json({ error: 'commandMode must be "http" or "mqtt"' });
    }
    const device = deviceService.update(Number(req.params.id), { command_mode: commandMode });
    if (!device) return res.status(404).json({ error: 'Device not found' });
    res.json(device);
  });

  router.post('/api/devices/:id/retry', async (req, res) => {
    const device = await deviceService.retry(Number(req.params.id));
    if (!device) return res.status(404).json({ error: 'Device not found' });
    res.json(device);
  });

  router.post('/api/devices/:id/restart', async (req, res) => {
    const device = deviceService.get(Number(req.params.id));
    if (!device) return res.status(404).json({ error: 'Device not found' });
    try {
      const result = await commandService.execute(device, 'restart', 'on');
      res.json({ success: true, result });
    } catch (err) {
      res.status(err.statusCode || 502).json({ error: err.message });
    }
  });

  router.delete('/api/devices/:id', (req, res) => {
    const removed = deviceService.remove(Number(req.params.id));
    if (!removed) return res.status(404).json({ error: 'Device not found' });
    res.json({ success: true });
  });

  // Device config (advanced settings)
  router.get('/api/devices/:id/config', (req, res) => {
    const device = deviceService.get(Number(req.params.id));
    if (!device) return res.status(404).json({ error: 'Device not found' });
    let config = deviceConfigRepo.getForDevice(device.id);
    if (!config) config = deviceConfigRepo.ensureForDevice(device);
    res.json(config);
  });

  router.put('/api/devices/:id/config', (req, res) => {
    const device = deviceService.get(Number(req.params.id));
    if (!device) return res.status(404).json({ error: 'Device not found' });
    deviceConfigRepo.ensureForDevice(device);
    const config = deviceConfigRepo.updateForDevice(device.id, req.body || {});
    res.json(config);
  });

  return router;
}

module.exports = { deviceRoutes };