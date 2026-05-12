const { Pool } = require('pg');

const pool = new Pool({
  host:     process.env.DB_HOST,
  port:     Number(process.env.DB_PORT),
  database: process.env.DB_NAME,
  user:     process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  max:      20,          // max connections in pool
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// ── Log every query in development ──────────────────────────
pool.on('connect', (client) => {
  if (process.env.NODE_ENV === 'development') {
    console.log('[DB] New client connected to PostgreSQL pool');
  }
});

pool.on('error', (err) => {
  console.error('[DB] Unexpected error on idle client:', err.message);
  process.exit(1);
});

// ── Wrapper that logs SQL in development ────────────────────
const query = async (text, params) => {
  const start = Date.now();
  try {
    const result = await pool.query(text, params);
    const duration = Date.now() - start;
    if (process.env.NODE_ENV === 'development') {
      console.log(`[DB] Query executed in ${duration}ms | rows: ${result.rowCount}`);
      console.log(`[DB] SQL: ${text.replace(/\s+/g, ' ').trim().slice(0, 120)}`);
    }
    return result;
  } catch (err) {
    console.error('[DB] Query error:', err.message);
    console.error('[DB] Failed SQL:', text.replace(/\s+/g, ' ').trim().slice(0, 200));
    throw err;
  }
};

// ── For transactions ─────────────────────────────────────────
const getClient = () => pool.connect();

// ── Health check ─────────────────────────────────────────────
const testConnection = async () => {
  try {
    const res = await pool.query('SELECT NOW() AS now');
    console.log('[DB] PostgreSQL connected at', res.rows[0].now);
  } catch (err) {
    console.error('[DB] Connection failed:', err.message);
    process.exit(1);
  }
};

module.exports = { query, getClient, testConnection, pool };
