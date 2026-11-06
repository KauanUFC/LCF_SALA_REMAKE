'use strict';

const { Router } = require('express');

function isValidTime(value) {
  return /^\d{2}:\d{2}$/.test(value) && Number(value.slice(0, 2)) <= 23 && Number(value.slice(3, 5)) <= 59;
}

function scheduleRoutes(scheduleService) {
  const router = Router();

  router.get('/api/schedules', (req, res) => {
    res.json(scheduleService.list());
  });

  router.post('/api/schedules', async (req, res) => {
    const {
      name, roomId, action, triggerTime, scope,
      repeatDays, state, brightness, enabled, deviceIds,
    } = req.body || {};

    if (!name || !action || !triggerTime) {
      return res.status(400).json({ error: 'name, action and triggerTime are required' });
    }
    if (!isValidTime(triggerTime)) {
      return res.status(400).json({ error: 'triggerTime must be a valid HH:MM' });
    }
    if (action !== 'power' && action !== 'brightness') {
      return res.status(400).json({ error: 'action must be "power" or "brightness"' });
    }

    try {
      const schedule = await scheduleService.create(
        { name, roomId, action, triggerTime, scope, repeatDays, state, brightness, enabled },
        deviceIds || [],
      );
      res.status(201).json(schedule);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  router.get('/api/schedules/:id', (req, res) => {
    const s = scheduleService.get(Number(req.params.id));
    if (!s) return res.status(404).json({ error: 'Schedule not found' });
    res.json(s);
  });

  router.put('/api/schedules/:id', async (req, res) => {
    const id = Number(req.params.id);
    if (!scheduleService.get(id)) return res.status(404).json({ error: 'Schedule not found' });

    const { triggerTime } = req.body || {};
    if (triggerTime && !isValidTime(triggerTime)) {
      return res.status(400).json({ error: 'triggerTime must be a valid HH:MM' });
    }

    const {
      name, roomId, action, scope, repeatDays, state, brightness, enabled, deviceIds,
    } = req.body || {};
    const fields = { name, roomId, action, scope, repeatDays, state, brightness, enabled };

    try {
      const schedule = await scheduleService.update(id, fields, deviceIds);
      res.json(schedule);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  router.delete('/api/schedules/:id', (req, res) => {
    const id = Number(req.params.id);
    if (!scheduleService.get(id)) return res.status(404).json({ error: 'Schedule not found' });
    scheduleService.remove(id);
    res.json({ success: true });
  });

  router.post('/api/schedules/:id/toggle', (req, res) => {
    const updated = scheduleService.toggle(Number(req.params.id));
    if (!updated) return res.status(404).json({ error: 'Schedule not found' });
    res.json(updated);
  });

  return router;
}

module.exports = { scheduleRoutes };