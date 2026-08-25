const path = require('path');
const fs = require('fs');
const { DatabaseSync } = require('node:sqlite');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, '..', 'data', 'app.sqlite');
fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
const db = new DatabaseSync(DB_PATH);
db.exec('PRAGMA journal_mode = WAL;');
db.exec('PRAGMA foreign_keys = ON;');

db.exec(`
CREATE TABLE IF NOT EXISTS branches (
  code TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  district TEXT DEFAULT '',
  province TEXT DEFAULT '',
  lat REAL NOT NULL,
  lng REAL NOT NULL,
  status TEXT
);

CREATE TABLE IF NOT EXISTS hotels (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  price REAL DEFAULT 0,
  district TEXT DEFAULT '',
  province TEXT DEFAULT '',
  lat REAL NOT NULL,
  lng REAL NOT NULL
);

CREATE TABLE IF NOT EXISTS employees (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT,
  name TEXT NOT NULL,
  team TEXT DEFAULT '',
  nickname TEXT,
  gender TEXT,
  area_incharge TEXT,
  phone TEXT,
  home_lat REAL,
  home_lng REAL
);

CREATE TABLE IF NOT EXISTS schedule_items (
  id TEXT PRIMARY KEY,
  team TEXT NOT NULL,
  branches TEXT NOT NULL, -- JSON array of branch codes
  work_start TEXT NOT NULL,
  work_end TEXT NOT NULL,
  stay_start TEXT NOT NULL,
  stay_end TEXT NOT NULL,
  male INTEGER,
  female INTEGER,
  job_type TEXT,
  needs_burmese INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS meta (
  key TEXT PRIMARY KEY,
  value TEXT
);
`);

module.exports = db;
