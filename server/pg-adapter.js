import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const { Pool } = pg;

// Parse the connection string securely
export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }, 
  max: 10, // Reduced from 20 to accommodate multiple instances during Render deployments
  idleTimeoutMillis: 10000, // Faster release of idle connections
  connectionTimeoutMillis: 5000, 
});

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

/**
 * SQLite Adapter wrapper mirroring sqlite driver API
 */
export const pgAdapter = {
  exec: async (sql) => {
    return pool.query(sql);
  },
  run: async (sql, params = []) => {
    const pgSql = preparePostgresSql(sql);
    return pool.query(pgSql, params);
  },
  all: async (sql, params = []) => {
    const pgSql = preparePostgresSql(sql);
    const { rows } = await pool.query(pgSql, params);
    return rows.map(row => camelize(row));
  },
  allRaw: async (sql, params = []) => {
    const pgSql = preparePostgresSql(sql);
    const { rows } = await pool.query(pgSql, params);
    return rows;
  },
  get: async (sql, params = []) => {
    const pgSql = preparePostgresSql(sql);
    const { rows } = await pool.query(pgSql, params);
    return rows[0] ? camelize(rows[0]) : null;
  },
  transaction: async (callback) => {
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
  }
};
