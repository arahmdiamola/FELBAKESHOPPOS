import dotenv from 'dotenv';
dotenv.config();

import { pgAdapter, isProduction } from './pg-adapter.js';
import { v4 as uuidv4 } from 'uuid';

async function seed() {
  const db = pgAdapter;
  console.log("🚀 STARTING TRUE BULK HIGH-VOLUME STRESS TEST SEEDER...");
  console.log(`📡 Mode: ${isProduction ? 'PRODUCTION (Postgres)' : 'DEVELOPMENT (SQLite)'}`);
  
  try {
    // 1. Wipe old operational data
    console.log("🧹 Wiping old operational data...");
    await db.transaction(async (tx) => {
      await tx.run("DELETE FROM transaction_items");
      await tx.run("DELETE FROM transactions");
      await tx.run("DELETE FROM production_log_items_v2");
      await tx.run("DELETE FROM production_logs_v2");
      await tx.run("DELETE FROM preorders");
      await tx.run("DELETE FROM expenses");
      await tx.run("DELETE FROM system_logs");
      await tx.run("DELETE FROM branch_sessions");
      await tx.run("DELETE FROM customers");
    });
    console.log("✅ Operational tables cleared.");

    // 2. Ensure Structures
    const branches = await db.all("SELECT id, name FROM branches");
    const allProducts = await db.all("SELECT id, name, price, cost_price, branch_id FROM products");
    
    // 3. BULK GENERATION & INSERTION
    const TX_PER_BRANCH = 5000;
    const CHUNK_SIZE = 100; // Safe chunk size for SQL parameter limits
    const todayStr = '2026-04-16';
    
    console.log(`🏗️ Generating ${TX_PER_BRANCH * branches.length} Transactions using True Bulk Insert...`);

    for (const branch of branches) {
      const branchProducts = allProducts.filter(p => p.branchId === branch.id);
      if (branchProducts.length === 0) continue;

      console.log(`📍 Branch: ${branch.name}`);
      
      for (let chunkStart = 1; chunkStart <= TX_PER_BRANCH; chunkStart += CHUNK_SIZE) {
        const txRows = [];
        const itemRows = [];
        const currentChunkEnd = Math.min(chunkStart + CHUNK_SIZE - 1, TX_PER_BRANCH);

        for (let i = chunkStart; i <= currentChunkEnd; i++) {
          const txId = uuidv4();
          const receiptNum = `STRESS-${branch.name.slice(0,3).toUpperCase()}-${i.toString().padStart(5, '0')}`;
          
          const prod = branchProducts[Math.floor(Math.random() * branchProducts.length)];
          const qty = 1;
          const subtotal = prod.price * qty;
          const tax = subtotal * 0.12;
          const total = subtotal + tax;
          const timestamp = `${todayStr}T${Math.floor(Math.random()*12 + 8).toString().padStart(2, '0')}:${Math.floor(Math.random()*60).toString().padStart(2, '0')}:00Z`;

          txRows.push([
            txId, branch.id, receiptNum, subtotal, 0, tax, total, 'Cash', total, 0, 'Walk-in', timestamp, 'completed'
          ]);

          itemRows.push([
            uuidv4(), txId, prod.id, prod.name, prod.price, qty, subtotal
          ]);
        }

        // Bulk Insert Transactions
        if (txRows.length > 0) {
          const txSql = `INSERT INTO transactions (id, branch_id, receipt_number, subtotal, discount, tax, total, payment_method, amount_paid, "change", customer_name, date, status) VALUES ` + 
            txRows.map(() => `(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).join(', ');
          await db.run(txSql, txRows.flat());
        }

        // Bulk Insert Items
        if (itemRows.length > 0) {
          const itemSql = `INSERT INTO transaction_items (id, transaction_id, product_id, name, price, quantity, total) VALUES ` + 
            itemRows.map(() => `(?, ?, ?, ?, ?, ?, ?)`).join(', ');
          await db.run(itemSql, itemRows.flat());
        }

        process.stdout.write(`.`);
      }
      process.stdout.write(`\n   ✓ ${TX_PER_BRANCH} transactions created.\n`);
    }

    console.log("\n✨ STRESS TEST SEEDING COMPLETE!");
  } catch (e) {
    console.error("\n❌ SEEDING FAILED:", e);
  }
}

seed();
