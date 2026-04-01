import pg from 'pg';
import { env } from '../config/env.js';

const { Pool } = pg;

const useSsl = env.databaseUrl.includes('render.com') || env.databaseUrl.includes('dpg-');

export const pool = new Pool({
  connectionString: env.databaseUrl,
  ssl: useSsl ? { rejectUnauthorized: false } : false
});

export async function query(text, params = []) {
  const result = await pool.query(text, params);
  return result;
}

export async function getClient() {
  return pool.connect();
}

export async function testConnection() {
  await query('SELECT 1');
  return true;
}
