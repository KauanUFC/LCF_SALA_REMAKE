'use strict';

const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');

const { env } = require('../config/env');

const CURRENT_VERSION = 5;

let db = null;

function initDatabase() {
  if (db) return db;

  const dir = path.dirname(env.DB_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const isNew = !fs.existsSync(env.DB_PATH);
  db = new Database(env.DB_PATH);
  db.pragma('foreign_keys = ON');

  let existingVersion = 0;
  if (!isNew) {
    try {
      const row = db.prepare('SELECT version FROM schema_version').get();
      if (row) existingVersion = row.version;
    } catch {
      existingVersion = 0;
    }
  }

  if (existingVersion < CURRENT_VERSION) {
    // Drop all tables and recreate from schema.sql (dev-rebuild accepted per project).
    const tables = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table'")
      .all()
      .filter((r) => r.name !== 'sqlite_sequence');
    for (const t of tables) {
      db.prepare(`DROP TABLE IF EXISTS "${t.name}"`).run();
    }

    const schemaRaw = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
    db.exec(schemaRaw);
    db.prepare('INSERT INTO schema_version (version) VALUES (?)').run(CURRENT_VERSION);
  }

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