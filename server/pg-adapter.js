import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const { Pool } = pg;

// Parse the connection string securely
export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false } // Required for Supabase/Neon
});

/**
 * Helper to convert array of sqlite ? parameters into postgres $1, $2 params
 */
const preparePostgresSql = (sql) => {
  let i = 1;
  return sql.replace(/\?/g, () => `$${i++}`);
};

/**
 * SQLite Adapter wrapper mirroring sqlite driver API
 */
export const pgAdapter = {
  exec: async (sql) => {
    // Some basic commands like BEGIN TRANSACTION aren't strictly necessary with individual pool queries,
    // but the pool can technically execute them anyway. 
    return pool.query(sql);
  },
  run: async (sql, params = []) => {
    const pgSql = preparePostgresSql(sql);
    return pool.query(pgSql, params);
  },
  all: async (sql, params = []) => {
    const pgSql = preparePostgresSql(sql);
    const { rows } = await pool.query(pgSql, params);
    return rows;
  },
  get: async (sql, params = []) => {
    const pgSql = preparePostgresSql(sql);
    const { rows } = await pool.query(pgSql, params);
    return rows[0] || null;
  }
};
