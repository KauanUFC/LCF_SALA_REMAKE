'use strict';

const { Router } = require('express');

function roomRoutes(roomService) {
  const router = Router();

  router.get('/api/rooms', (req, res) => {
    res.json(roomService.list(req.query.search));
  });

  router.post('/api/rooms', (req, res) => {
    const { name, icon } = req.body || {};
    if (!name || !String(name).trim()) {
      return res.status(400).json({ error: 'name is required' });
    }
    try {
      const room = roomService.create({ name: String(name).trim(), icon });
      res.status(201).json(room);
    } catch (err) {
      res.status(err.statusCode || 400).json({ error: err.message });
    }
  });

  router.get('/api/rooms/:id', (req, res) => {
    const room = roomService.get(Number(req.params.id));
    if (!room) return res.status(404).json({ error: 'Room not found' });
    res.json(room);
  });

  router.put('/api/rooms/:id', (req, res) => {
    const { name, icon } = req.body || {};
    if (name !== undefined && !String(name).trim()) {
      return res.status(400).json({ error: 'name cannot be empty' });
    }
    const fields = {};
    if (name !== undefined) fields.name = String(name).trim();
    if (icon !== undefined) fields.icon = icon;
    try {
      const room = roomService.update(Number(req.params.id), fields);
      if (!room) return res.status(404).json({ error: 'Room not found' });
      res.json(room);
    } catch (err) {
      res.status(err.statusCode || 400).json({ error: err.message });
    }
  });

  router.delete('/api/rooms/:id', (req, res) => {
    const room = roomService.get(Number(req.params.id));
    if (!room) return res.status(404).json({ error: 'Room not found' });
    roomService.remove(Number(req.params.id));
    res.json({ success: true });
  });

  router.post('/api/rooms/:id/toggle', async (req, res) => {
    const room = roomService.get(Number(req.params.id));
    if (!room) return res.status(404).json({ error: 'Room not found' });
    try {
      const result = await roomService.toggleRoom(Number(req.params.id));
      res.json(result);
    } catch (err) {
      res.status(502).json({ error: err.message });
    }
  });

  router.post('/api/rooms/:id/brightness', async (req, res) => {
    const { brightness } = req.body || {};
    if (brightness === undefined) return res.status(400).json({ error: 'brightness required' });
    const room = roomService.get(Number(req.params.id));
    if (!room) return res.status(404).json({ error: 'Room not found' });
    try {
      const result = await roomService.setRoomBrightness(Number(req.params.id), brightness);
      res.json(result);
    } catch (err) {
      res.status(502).json({ error: err.message });
    }
  });

  return router;
}

module.exports = { roomRoutes };