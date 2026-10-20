'use strict';

const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');

const { env } = require('../config/env');

let db = null;

function initDatabase() {
  if (db) return db;

  const dir = path.dirname(env.DB_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  db = new Database(env.DB_PATH);
  db.pragma('foreign_keys = ON');

  const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  db.exec(schema);

  return db;
}

function closeDatabase() {
  if (db) {
    db.close();
    db = null;
  }
}

function getDb() {
  if (!db) throw new Error('Database not initialized');
  return db;
}

module.exports = { initDatabase, closeDatabase, getDb };