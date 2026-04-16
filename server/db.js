import { pgAdapter, isProduction } from './pg-adapter.js';
import { v4 as uuidv4 } from 'uuid';

/**
 * PRODUCTION DATABASE CORE - STABLE v2
 * This file handles table initialization and index management.
 * Legacy migration and emergency repair logic have been purged.
 */

export async function initDb() {
  const db = pgAdapter;

  try {
    console.log("Initializing Production Database...");

    // 1. Core Tables Initialization
    await db.exec(`
      CREATE TABLE IF NOT EXISTS branches (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        address TEXT,
        last_seen TEXT
      );

      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        role TEXT NOT NULL,
        pin TEXT NOT NULL,
        branch_id TEXT,
        image TEXT,
        FOREIGN KEY (branch_id) REFERENCES branches(id)
      );

      CREATE TABLE IF NOT EXISTS categories (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        emoji TEXT
      );

      CREATE TABLE IF NOT EXISTS products (
        id TEXT PRIMARY KEY,
        branch_id TEXT NOT NULL,
        name TEXT NOT NULL,
        category_id TEXT,
        price REAL NOT NULL,
        cost_price REAL DEFAULT 0,
        stock REAL DEFAULT 0,
        unit TEXT DEFAULT 'pc',
        reorder_point REAL DEFAULT 0,
        emoji TEXT,
        image TEXT,
        is_top_selling INTEGER DEFAULT 0,
        FOREIGN KEY (branch_id) REFERENCES branches(id)
      );

      CREATE TABLE IF NOT EXISTS transactions (
        id TEXT PRIMARY KEY,
        branch_id TEXT NOT NULL,
        receipt_number TEXT NOT NULL,
        subtotal REAL NOT NULL,
        discount REAL DEFAULT 0,
        tax REAL DEFAULT 0,
        total REAL NOT NULL,
        payment_method TEXT NOT NULL,
        amount_paid REAL NOT NULL,
        "change" REAL DEFAULT 0,
        customer_id TEXT,
        customer_name TEXT,
        cashier_id TEXT,
        cashier_name TEXT,
        date TEXT NOT NULL,
        status TEXT DEFAULT 'completed',
        notes TEXT,
        FOREIGN KEY (branch_id) REFERENCES branches(id)
      );

      CREATE TABLE IF NOT EXISTS transaction_items (
        id TEXT PRIMARY KEY,
        transaction_id TEXT NOT NULL,
        product_id TEXT NOT NULL,
        name TEXT NOT NULL,
        price REAL NOT NULL,
        quantity REAL NOT NULL,
        unit TEXT,
        discount REAL DEFAULT 0,
        total REAL NOT NULL,
        FOREIGN KEY (transaction_id) REFERENCES transactions(id)
      );

      CREATE TABLE IF NOT EXISTS customers (
        id TEXT PRIMARY KEY,
        branch_id TEXT NOT NULL,
        name TEXT NOT NULL,
        phone TEXT,
        email TEXT,
        address TEXT,
        total_spent REAL DEFAULT 0,
        visits INTEGER DEFAULT 0,
        balance REAL DEFAULT 0,
        FOREIGN KEY (branch_id) REFERENCES branches(id)
      );

      CREATE TABLE IF NOT EXISTS expenses (
        id TEXT PRIMARY KEY,
        branch_id TEXT NOT NULL,
        category TEXT NOT NULL,
        description TEXT,
        amount REAL NOT NULL,
        date TEXT NOT NULL,
        added_by TEXT,
        FOREIGN KEY (branch_id) REFERENCES branches(id)
      );

      CREATE TABLE IF NOT EXISTS preorders (
        id TEXT PRIMARY KEY,
        branch_id TEXT NOT NULL,
        customer_name TEXT NOT NULL,
        customer_phone TEXT NOT NULL,
        items TEXT NOT NULL,
        total_price REAL NOT NULL,
        deposit REAL DEFAULT 0,
        status TEXT DEFAULT 'pending',
        due_date TEXT NOT NULL,
        notes TEXT,
        quantity REAL DEFAULT 1,
        created_at TEXT NOT NULL,
        FOREIGN KEY (branch_id) REFERENCES branches(id)
      );

      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT
      );

      CREATE TABLE IF NOT EXISTS system_logs (
        id TEXT PRIMARY KEY,
        timestamp TEXT NOT NULL,
        user_id TEXT,
        user_name TEXT,
        action TEXT NOT NULL,
        details TEXT,
        branch_id TEXT
      );

      CREATE TABLE IF NOT EXISTS raw_materials (
        id TEXT PRIMARY KEY,
        branch_id TEXT NOT NULL,
        name TEXT NOT NULL,
        stock REAL DEFAULT 0,
        unit TEXT DEFAULT 'kg',
        reorder_point REAL DEFAULT 0,
        emoji TEXT,
        cost_price REAL DEFAULT 0,
        FOREIGN KEY (branch_id) REFERENCES branches(id)
      );

      CREATE TABLE IF NOT EXISTS branch_sessions (
        branch_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        last_seen TEXT NOT NULL,
        PRIMARY KEY (branch_id, user_id),
        FOREIGN KEY (branch_id) REFERENCES branches(id)
      );

      CREATE TABLE IF NOT EXISTS production_logs_v2 (
        id TEXT PRIMARY KEY,
        branch_id TEXT,
        user_id TEXT,
        user_name TEXT,
        product_id TEXT,
        product_name TEXT,
        quantity_produced REAL DEFAULT 0,
        estimated_yield REAL DEFAULT 0,
        date TEXT,
        notes TEXT,
        status TEXT,
        unit TEXT,
        estimated_ready_time TEXT
      );

      CREATE TABLE IF NOT EXISTS production_log_items_v2 (
        id TEXT PRIMARY KEY,
        production_log_id TEXT NOT NULL,
        material_id TEXT NOT NULL,
        material_name TEXT NOT NULL,
        quantity_used REAL NOT NULL,
        unit TEXT,
        cost_price REAL DEFAULT 0
      );
    `);

    // 2. Production Health Checks (Ensuring critical columns exist)
    const productionHealing = [
      { t: 'production_logs_v2', c: 'estimated_ready_time', type: 'TEXT' },
      { t: 'production_logs_v2', c: 'unit', type: 'TEXT' }
    ];

    for (const heal of productionHealing) {
      try {
        await db.run(`ALTER TABLE ${heal.t} ADD COLUMN ${heal.c} ${heal.type}`);
      } catch (e) { /* Already exists */ }
    }

    // 4. System Developer & Licensing Defaults
    const devExists = await db.get("SELECT id FROM users WHERE id = 'dev-001'");
    if (!devExists) {
      await db.run(
        "INSERT INTO users (id, name, role, pin, branch_id) VALUES (?, ?, ?, ?, ?)",
        ["dev-001", "System Developer", "system_admin", "9999", null]
      );
    }

    // Initialize License Features if not set (Default: Everything enabled for legacy apps, 
    // but gating logic will now check this key)
    const licenseExists = await db.get("SELECT key FROM settings WHERE key = 'license_features'");
    if (!licenseExists) {
      const defaultFeatures = [
        'module_pos', 
        'module_dashboard', 
        'module_mission_control', 
        'module_analytics', 
        'module_bakery', 
        'module_products',
        'module_preorders',
        'module_customers',
        'module_expenses',
        'module_data_reset'
      ];
      await db.run("INSERT INTO settings (key, value) VALUES (?, ?)", ['license_features', JSON.stringify(defaultFeatures)]);
    }

     // 4. Performance Indexes
     try {
       await db.exec(`
         CREATE INDEX IF NOT EXISTS idx_transactions_branch_date ON transactions(branch_id, date);
         CREATE INDEX IF NOT EXISTS idx_transactions_date_only ON transactions(date);
         CREATE INDEX IF NOT EXISTS idx_transaction_items_tx ON transaction_items(transaction_id);
         CREATE INDEX IF NOT EXISTS idx_logs_branch_time ON system_logs(branch_id, timestamp);
         CREATE INDEX IF NOT EXISTS idx_logs_timestamp_only ON system_logs(timestamp);
         CREATE INDEX IF NOT EXISTS idx_sessions_branch ON branch_sessions(branch_id);
         CREATE INDEX IF NOT EXISTS idx_prod_logs_branch ON production_logs_v2(branch_id);
         CREATE INDEX IF NOT EXISTS idx_prod_logs_date ON production_logs_v2(date);
         CREATE INDEX IF NOT EXISTS idx_prod_logs_status ON production_logs_v2(status);
         CREATE INDEX IF NOT EXISTS idx_prod_items_log ON production_log_items_v2(production_log_id);
       `);
     } catch (e) {
      console.warn("[Index Initialization Notice]", e.message);
    }

    console.log("✅ Database Engine: READY");
    return db;
  } catch (e) {
    console.error("❌ CRITICAL: Database initialization failed:", e.message);
    throw e;
  }
}

/**
 * SELECTIVE SYSTEM RESET
 * Purges operational data (Sales, Logs, Expenses, etc.)
 * Preserves structural data (Users, Branches, Products, Settings)
 */
export async function resetOperationalData() {
  const db = pgAdapter;
  console.log("🧹 Initializing Selective System Reset...");
  
  return await db.transaction(async (tx) => {
    // 1. Wipe Transactional operational data (Deep layers first)
    await tx.run("DELETE FROM transaction_items");
    await tx.run("DELETE FROM transactions");
    await tx.run("DELETE FROM production_log_items_v2");
    await tx.run("DELETE FROM production_logs_v2");
    await tx.run("DELETE FROM preorders");
    await tx.run("DELETE FROM expenses");
    await tx.run("DELETE FROM system_logs");
    await tx.run("DELETE FROM branch_sessions");
    
    // 2. Wipe Operational CRM data
    await tx.run("DELETE FROM customers");
    
    // 3. Reset Inventory counters to 0 (Keep the items, but reset the counts)
    await tx.run("UPDATE products SET stock = 0");
    await tx.run("UPDATE raw_materials SET stock = 0");

    console.log("✨ Selective Reset Successful. Users and Structural data preserved.");
    return { success: true };
  });
}
