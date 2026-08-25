const { Pool } = require('pg');

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is not set — see README.md for how to create a Supabase project and set it in .env');
}

// This app shares a Supabase project/database with the (closed) sma-booking-backend system.
// Everything lives in its own Postgres schema so table names (branches/hotels/employees etc.)
// never collide with — or get mixed up with — that system's existing tables in `public`.
const SCHEMA = 'housing_planner';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function init() {
  await pool.query(`CREATE SCHEMA IF NOT EXISTS ${SCHEMA};`);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS ${SCHEMA}.branches (
      code TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      district TEXT DEFAULT '',
      province TEXT DEFAULT '',
      lat DOUBLE PRECISION NOT NULL,
      lng DOUBLE PRECISION NOT NULL,
      status TEXT
    );

    CREATE TABLE IF NOT EXISTS ${SCHEMA}.hotels (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      price DOUBLE PRECISION DEFAULT 0,
      district TEXT DEFAULT '',
      province TEXT DEFAULT '',
      lat DOUBLE PRECISION NOT NULL,
      lng DOUBLE PRECISION NOT NULL
    );

    CREATE TABLE IF NOT EXISTS ${SCHEMA}.employees (
      id SERIAL PRIMARY KEY,
      code TEXT,
      name TEXT NOT NULL,
      team TEXT DEFAULT '',
      nickname TEXT,
      gender TEXT,
      area_incharge TEXT,
      phone TEXT,
      home_lat DOUBLE PRECISION,
      home_lng DOUBLE PRECISION
    );

    CREATE TABLE IF NOT EXISTS ${SCHEMA}.schedule_items (
      id TEXT PRIMARY KEY,
      team TEXT NOT NULL,
      branches JSONB NOT NULL,
      work_start TEXT NOT NULL,
      work_end TEXT NOT NULL,
      stay_start TEXT NOT NULL,
      stay_end TEXT NOT NULL,
      male INTEGER,
      female INTEGER,
      job_type TEXT,
      needs_burmese BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMPTZ DEFAULT now()
    );
  `);
}

module.exports = { pool, init, SCHEMA };
