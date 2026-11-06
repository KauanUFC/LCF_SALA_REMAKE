'use strict';

const { Router } = require('express');

function sceneRoutes(sceneService) {
  const router = Router();

  router.get('/api/scenes', (req, res) => {
    res.json(sceneService.list());
  });

  // body: { name, roomId?, settings?: [{deviceId, power, brightness?, colorHex?, colorTemp?}] }
  //   OR   { name, roomId?, fromCurrent: true, deviceIds?: [] }  (snapshot current states)
  router.post('/api/scenes', (req, res) => {
    const { name, roomId, settings, fromCurrent, deviceIds } = req.body || {};
    if (!name) return res.status(400).json({ error: 'name is required' });

    try {
      let scene;
      if (fromCurrent) {
        scene = sceneService.snapshotFrom({ name, roomId, deviceIds });
      } else {
        scene = sceneService.create({ name, roomId, settings });
      }
      res.status(201).json(scene);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  router.get('/api/scenes/:id', (req, res) => {
    const scene = sceneService.get(Number(req.params.id));
    if (!scene) return res.status(404).json({ error: 'Scene not found' });
    res.json(scene);
  });

  // body: { name?, roomId?, settings? }
  router.put('/api/scenes/:id', (req, res) => {
    const { name, roomId, settings } = req.body || {};
    const scene = sceneService.update(Number(req.params.id), { name, roomId, settings });
    if (!scene) return res.status(404).json({ error: 'Scene not found' });
    res.json(scene);
  });

  // body: { sortOrder }
  router.put('/api/scenes/:id/reorder', (req, res) => {
    const { sortOrder } = req.body || {};
    if (sortOrder === undefined) return res.status(400).json({ error: 'sortOrder required' });
    const scene = sceneService.reorder(Number(req.params.id), sortOrder);
    if (!scene) return res.status(404).json({ error: 'Scene not found' });
    res.json(scene);
  });

  router.post('/api/scenes/:id/apply', async (req, res) => {
    try {
      const result = await sceneService.apply(Number(req.params.id));
      if (!result) return res.status(404).json({ error: 'Scene not found' });
      res.json(result);
    } catch (err) {
      res.status(502).json({ error: err.message });
    }
  });

  router.delete('/api/scenes/:id', (req, res) => {
    const scene = sceneService.get(Number(req.params.id));
    if (!scene) return res.status(404).json({ error: 'Scene not found' });
    sceneService.remove(Number(req.params.id));
    res.json({ success: true });
  });

  return router;
}

module.exports = { sceneRoutes };