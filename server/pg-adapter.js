import pg from 'pg';
import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const { Pool } = pg;
export const isProduction = !!process.env.DATABASE_URL;

let pool = null;
let sqliteDb = null;

if (isProduction) {
  console.log('[Database] Mode: POSTGRES (Production)');
  pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }, 
    max: 10,
    idleTimeoutMillis: 10000,
    connectionTimeoutMillis: 5000, 
  });
} else {
  console.log('[Database] Mode: SQLITE (Local Development)');
}

/**
 * Helper to convert array of sqlite ? parameters into postgres $1, $2 params
 */
const preparePostgresSql = (sql) => {
  let i = 1;
  return sql.replace(/\?/g, () => `$${i++}`);
};

const camelize = (obj) => {
  if (!obj || typeof obj !== 'object' || obj instanceof Date) return obj;
  if (Array.isArray(obj)) return obj.map(v => camelize(v));
  
  const newObj = {};
  for (let key in obj) {
    const camelKey = key.replace(/([-_][a-z])/ig, ($1) => {
      return $1.toUpperCase()
        .replace('-', '')
        .replace('_', '');
    });
    newObj[camelKey] = camelize(obj[key]);
  }
  return newObj;
};

async function getSqliteDb() {
  if (sqliteDb) return sqliteDb;
  sqliteDb = await open({
    filename: path.join(__dirname, 'dev.db'),
    driver: sqlite3.Database
  });
  return sqliteDb;
}

/**
 * Universal Database Adapter (Postgres <-> SQLite)
 */
export const pgAdapter = {
  exec: async (sql) => {
    if (isProduction) {
      return pool.query(sql);
    } else {
      const db = await getSqliteDb();
      return db.exec(sql);
    }
  },
  run: async (sql, params = []) => {
    if (isProduction) {
      const pgSql = preparePostgresSql(sql);
      return pool.query(pgSql, params);
    } else {
      const db = await getSqliteDb();
      return db.run(sql, params);
    }
  },
  all: async (sql, params = []) => {
    if (isProduction) {
      const pgSql = preparePostgresSql(sql);
      const { rows } = await pool.query(pgSql, params);
      return rows.map(row => camelize(row));
    } else {
      const db = await getSqliteDb();
      const rows = await db.all(sql, params);
      return rows.map(row => camelize(row));
    }
  },
  allRaw: async (sql, params = []) => {
    if (isProduction) {
      const pgSql = preparePostgresSql(sql);
      const { rows } = await pool.query(pgSql, params);
      return rows;
    } else {
      const db = await getSqliteDb();
      return db.all(sql, params);
    }
  },
  get: async (sql, params = []) => {
    if (isProduction) {
      const pgSql = preparePostgresSql(sql);
      const { rows } = await pool.query(pgSql, params);
      return rows[0] ? camelize(rows[0]) : null;
    } else {
      const db = await getSqliteDb();
      const row = await db.get(sql, params);
      return row ? camelize(row) : null;
    }
  },
  transaction: async (callback) => {
    if (isProduction) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const tx = {
          run: (sql, params = []) => client.query(preparePostgresSql(sql), params),
          all: async (sql, params = []) => {
            const { rows } = await client.query(preparePostgresSql(sql), params);
            return rows.map(row => camelize(row));
          },
          get: async (sql, params = []) => {
            const { rows } = await client.query(preparePostgresSql(sql), params);
            return rows[0] ? camelize(rows[0]) : null;
          }
        };
        const result = await callback(tx);
        await client.query('COMMIT');
        return result;
      } catch (e) {
        await client.query('ROLLBACK');
        throw e;
      } finally {
        client.release();
      }
    } else {
      const db = await getSqliteDb();
      try {
        await db.run('BEGIN TRANSACTION');
        const tx = {
          run: (sql, params = []) => db.run(sql, params),
          all: (sql, params = []) => db.all(sql, params),
          get: (sql, params = []) => db.get(sql, params)
        };
        const result = await callback(tx);
        await db.run('COMMIT');
        return result;
      } catch (err) {
        await db.run('ROLLBACK');
        throw err;
      }
    }
  }
};
