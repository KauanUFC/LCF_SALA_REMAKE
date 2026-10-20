'use strict';

const { Router } = require('express');
const multer = require('multer');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 4 * 1024 * 1024 },
});

function otaRoutes(deviceService, otaService) {
  const router = Router();

  router.post('/api/ota/upload', upload.single('firmware'), async (req, res) => {
    if (!req.file) {
      return res.status(400).json({ error: 'No firmware file provided' });
    }

    const deviceId = req.query.deviceId;
    const device = deviceId ? deviceService.get(deviceId) : null;
    if (!device) {
      return res.status(400).json({ error: 'No target device specified or device not connected' });
    }

    try {
      const result = await otaService.upload(device, req.file);
      res.json(result);
    } catch (err) {
      res.status(err.statusCode || 502).json({ error: err.message });
    }
  });

  return router;
}

module.exports = { otaRoutes };