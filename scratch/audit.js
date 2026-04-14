import { pool } from '../server/pg-adapter.js';

async function run() {
  try {
    console.log('--- PROVEN DATA AUDIT START ---');
    const r = await pool.query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'");
    const names = r.rows.map(x => x.table_name);
    console.log('PRODUCTION TABLES:', names.filter(n => n.includes('production')));

    if (names.includes('production_logs_v2')) {
      const p2 = await pool.query("SELECT status, COUNT(*) FROM production_logs_v2 GROUP BY status");
      console.log('PRODUCTION_LOGS_V2 DATA:', p2.rows);
      
      const last = await pool.query("SELECT id, product_name, date, status FROM production_logs_v2 ORDER BY date DESC LIMIT 1");
      console.log('MOST RECENT RECORD:', last.rows[0]);
    }
    console.log('--- AUDIT COMPLETE ---');
  } catch (e) {
    console.error('AUDIT ERROR:', e.message);
  } finally {
    await pool.end();
  }
}
run();
