'use strict';

const { Router } = require('express');
const prefsRepo = require('../db/prefs-repo');

function prefsRoutes() {
  const router = Router();

  router.get('/api/preferences', (req, res) => {
    res.json(prefsRepo.get());
  });

  router.put('/api/preferences', (req, res) => {
    const prefs = prefsRepo.update(req.body || {});
    res.json(prefs);
  });

  return router;
}

module.exports = { prefsRoutes };