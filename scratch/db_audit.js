import { pgAdapter } from '../server/pg-adapter.js';

async function audit() {
  try {
    console.log("--- DATABASE AUDIT ---");
    const tables = await pgAdapter.allRaw("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'");
    console.log("Tables:", tables.map(t => t.table_name));

    for (const t of tables) {
      const cols = await pgAdapter.allRaw(`SELECT column_name FROM information_schema.columns WHERE table_name = '${t.table_name}'`);
      console.log(`Columns in ${t.table_name}:`, cols.map(c => c.column_name));
    }

    const txCount = await pgAdapter.get("SELECT COUNT(*) as count FROM transactions");
    console.log("Transaction Count:", txCount);
  } catch (e) {
    console.error("Audit Failed:", e);
  } finally {
    process.exit(0);
  }
}

audit();
