'use strict';

const { env } = require('../config/env');

const levels = { debug: 10, info: 20, warn: 30, error: 40 };
const threshold = env.NODE_ENV === 'test' || env.NODE_ENV === 'production' ? 20 : 10;

function ts() {
  return new Date().toISOString();
}

function log(level, args) {
  if (levels[level] < threshold) return;
  const raw = args.map((a) =>
    typeof a === 'object' && a !== null ? JSON.stringify(a) : String(a)
  );
  console[level === 'debug' ? 'log' : level](`[${ts()}] [${level.toUpperCase()}] ${raw.join(' ')}`);
}

const logger = {
  debug: (...args) => log('debug', args),
  info: (...args) => log('info', args),
  warn: (...args) => log('warn', args),
  error: (...args) => log('error', args),
};

module.exports = { logger };