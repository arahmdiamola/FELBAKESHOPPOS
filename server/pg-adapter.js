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
 * Helper to convert snake_case or lowercase keys from Postgres into camelCase
 */
const camelize = (obj) => {
  if (!obj || typeof obj !== 'object') return obj;
  const newObj = {};
  for (let key in obj) {
    // Specifically handle our camelCase fields that Postgres lowercases
    const camelKey = key.toLowerCase()
      .replace('categoryid', 'categoryId')
      .replace('branchid', 'branchId')
      .replace('costprice', 'costPrice')
      .replace('reorderpoint', 'reorderPoint')
      .replace('istopselling', 'isTopSelling')
      .replace('receiptnumber', 'receiptNumber')
      .replace('paymentmethod', 'paymentMethod')
      .replace('amountpaid', 'amountPaid')
      .replace('customerid', 'customerId')
      .replace('customername', 'customerName')
      .replace('cashierid', 'cashierId')
      .replace('cashiername', 'cashierName')
      .replace('transactionid', 'transactionId')
      .replace('productid', 'productId');
    newObj[camelKey] = obj[key];
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
  get: async (sql, params = []) => {
    const pgSql = preparePostgresSql(sql);
    const { rows } = await pool.query(pgSql, params);
    return rows[0] ? camelize(rows[0]) : null;
  }
};
