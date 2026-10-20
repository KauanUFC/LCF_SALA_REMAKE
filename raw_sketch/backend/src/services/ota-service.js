'use strict';

const { env } = require('../config/env');
const { logger } = require('../lib/logger');

/**
 * Forwards a firmware .bin to the ESP32's OTA endpoint
 * (http://{ip}:{OTA_PORT}/update) as a Basic-auth multipart/form-data POST.
 */
class OtaService {
  async upload(device, file) {
    if (!device || !device.ip) {
      const err = new Error('No target device specified or device not connected');
      err.statusCode = 400;
      throw err;
    }

    const ext = file.originalname.toLowerCase().slice(-4);
    if (ext !== '.bin') {
      const err = new Error('File must be a .bin firmware');
      err.statusCode = 400;
      throw err;
    }

    const otaUrl = `http://${device.ip}:${env.OTA_PORT}/update`;
    const auth = Buffer.from(`${env.OTA_USER}:${env.OTA_PASS}`).toString('base64');
    const boundary = '----OTAFormBoundary' + Date.now();

    const bodyParts = [
      Buffer.from(
        `--${boundary}\r\nContent-Disposition: form-data; name="firmware"; filename="firmware.bin"\r\nContent-Type: application/octet-stream\r\n\r\n`
      ),
      file.buffer,
      Buffer.from(`\r\n--${boundary}--\r\n`),
    ];
    const body = Buffer.concat(bodyParts);

    try {
      const res = await fetch(otaUrl, {
        method: 'POST',
        headers: {
          'Content-Type': `multipart/form-data; boundary=${boundary}`,
          'Content-Length': body.length.toString(),
          Authorization: `Basic ${auth}`,
        },
        body,
        signal: AbortSignal.timeout(60000),
      });

      const text = (await res.text()).trim();
      logger.info(`OTA response for ${device.name} (${res.status}): ${text}`);
      return { success: res.ok, status: res.status, message: text };
    } catch (error) {
      const wrapped = new Error(`OTA upload failed: ${error.message}`);
      wrapped.statusCode = 502;
      logger.error(`OTA upload error for ${device.name}: ${error.message}`);
      throw wrapped;
    }
  }
}

module.exports = { OtaService };