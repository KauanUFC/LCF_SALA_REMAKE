'use strict';

const { env } = require('../config/env');
const { logger } = require('../lib/logger');

function formatSse(event) {
  return `event: device_update\ndata: ${JSON.stringify(event)}\n\n`;
}

class SseService {
  constructor() {
    this.clients = new Set();
    this.heartbeat = null;
  }

  addClient(res) {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'Access-Control-Allow-Origin': '*',
    });

    this.clients.add(res);
    res.on('close', () => this.clients.delete(res));

    if (!this.heartbeat) {
      this.heartbeat = setInterval(() => this.broadcastComment(), env.SSE_HEARTBEAT_MS);
    }

    return () => this.clients.delete(res);
  }

  broadcastComment() {
    for (const res of this.clients) {
      try {
        res.write(': heartbeat\n\n');
      } catch {
        this.clients.delete(res);
      }
    }
  }

  broadcast(event) {
    const msg = formatSse(event);
    let active = 0;
    for (const res of this.clients) {
      try {
        res.write(msg);
        active++;
      } catch {
        this.clients.delete(res);
      }
    }
    logger.debug(`SSE broadcast #${active} ${event.type} [${event.deviceId}]`);
  }

  close() {
    if (this.heartbeat) {
      clearInterval(this.heartbeat);
      this.heartbeat = null;
    }
    for (const res of this.clients) {
      try {
        res.end();
      } catch {
        // ignore
      }
    }
    this.clients.clear();
  }
}

module.exports = { SseService };