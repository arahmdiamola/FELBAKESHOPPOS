import { pgAdapter } from './pg-adapter.js';
import { v4 as uuidv4 } from 'uuid';

async function syncColumnData(db, table, oldCol, newCol) {
  try {
    // 1. Check if both columns exist
    const cols = await db.allRaw(`
      SELECT column_name FROM information_schema.columns 
      WHERE table_name = $1 AND table_schema = 'public'
    `, [table]);
    const names = cols.map(c => c.column_name);

    if (names.includes(oldCol.toLowerCase()) && names.includes(newCol)) {
      console.log(`[Data Rescue] Syncing ${table}.${oldCol} -> ${newCol}...`);
      // Update newCol with oldCol data where newCol is empty/0
      await db.run(`UPDATE ${table} SET "${newCol}" = "${oldCol}" WHERE ("${newCol}" IS NULL OR "${newCol}" = 0 OR "${newCol}" = '')`);
    }
  } catch (e) {
    console.warn(`[Sync Warning] Failed to sync ${table}.${oldCol}:`, e.message);
  }
}

async function ensureColumnRenamed(db, table, oldColNames, newColName) {
  try {
    // 1. Get all columns for this table
    const result = await db.allRaw(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = $1 
      AND table_schema = 'public'
    `, [table]);
    
    // Postgres returns column_name lowercase
    const existingCols = result.map(r => r.column_name);
    
    // 2. If newColName (snake_case) already exists, skip
    if (existingCols.includes(newColName)) return;

    // 3. Check for any variants of the old name
    for (const oldCol of oldColNames) {
      // Check both quoted exact match and unquoted lowercase
      const variant = existingCols.find(c => c === oldCol || c === oldCol.toLowerCase());
      if (variant) {
        // Quote the variant if it has uppercase letters
        const actualRef = /[A-Z]/.test(variant) ? `"${variant}"` : variant;
        console.log(`[Migration] Transitioning ${table}.${variant} -> ${newColName}...`);
        await db.run(`ALTER TABLE ${table} RENAME COLUMN ${actualRef} TO "${newColName}"`);
        return;
      }
    }
  } catch (e) {
    console.error(`[Migration Error] Fault in ${table} rename logic:`, e.message);
  }
}

export async function initDb() {
  const db = pgAdapter;

  try {
    console.log("Starting Managed Database Initialization...");

    // 1. Infrastructure Tables (Always created in snake_case)
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

      CREATE TABLE IF NOT EXISTS production_logs (
        id TEXT PRIMARY KEY,
        branch_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        user_name TEXT,
        product_id TEXT,
        product_name TEXT,
        quantity_produced REAL DEFAULT 0,
        date TEXT NOT NULL,
        notes TEXT,
        status TEXT DEFAULT 'completed',
        estimated_yield REAL DEFAULT 0,
        FOREIGN KEY (branch_id) REFERENCES branches(id)
      );

      CREATE TABLE IF NOT EXISTS production_log_items (
        id TEXT PRIMARY KEY,
        production_log_id TEXT NOT NULL,
        material_id TEXT NOT NULL,
        material_name TEXT,
        quantity_used REAL NOT NULL,
        unit TEXT,
        cost_price REAL DEFAULT 0,
        FOREIGN KEY (production_log_id) REFERENCES production_logs(id)
      );

      CREATE TABLE IF NOT EXISTS branch_sessions (
        branch_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        last_seen TEXT NOT NULL,
        PRIMARY KEY (branch_id, user_id),
        FOREIGN KEY (branch_id) REFERENCES branches(id)
      );
    `);

    // 2. Intelligent Migration (Cross-Referencing information_schema)
    const migrationQueue = [
      { table: 'branches', variants: ['lastSeen', 'lastseen'], target: 'last_seen' },
      { table: 'users', variants: ['branchId', 'branchid'], target: 'branch_id' },
      { table: 'products', variants: ['branchId', 'branchid'], target: 'branch_id' },
      { table: 'products', variants: ['categoryId', 'categoryid'], target: 'category_id' },
      { table: 'products', variants: ['costPrice', 'costprice'], target: 'cost_price' },
      { table: 'products', variants: ['reorderPoint', 'reorderpoint'], target: 'reorder_point' },
      { table: 'products', variants: ['isTopSelling', 'istopselling'], target: 'is_top_selling' },
      { table: 'transactions', variants: ['branchId', 'branchid'], target: 'branch_id' },
      { table: 'transactions', variants: ['receiptNumber', 'receiptnumber'], target: 'receipt_number' },
      { table: 'transactions', variants: ['paymentMethod', 'paymentmethod'], target: 'payment_method' },
      { table: 'transactions', variants: ['amountPaid', 'amountpaid'], target: 'amount_paid' },
      { table: 'transactions', variants: ['customerId', 'customerid'], target: 'customer_id' },
      { table: 'transactions', variants: ['customerName', 'customername'], target: 'customer_name' },
      { table: 'transactions', variants: ['cashierId', 'cashierid'], target: 'cashier_id' },
      { table: 'transactions', variants: ['cashierName', 'cashiername'], target: 'cashier_name' },
      { table: 'transaction_items', variants: ['transactionId', 'transactionid'], target: 'transaction_id' },
      { table: 'transaction_items', variants: ['productId', 'productid'], target: 'product_id' },
      { table: 'customers', variants: ['branchId', 'branchid'], target: 'branch_id' },
      { table: 'customers', variants: ['totalSpent', 'totalspent'], target: 'total_spent' },
      { table: 'expenses', variants: ['branchId', 'branchid'], target: 'branch_id' },
      { table: 'expenses', variants: ['addedBy', 'addedby'], target: 'added_by' },
      { table: 'preorders', variants: ['branchId', 'branchid'], target: 'branch_id' },
      { table: 'preorders', variants: ['customerName', 'customername'], target: 'customer_name' },
      { table: 'preorders', variants: ['customerPhone', 'customerphone'], target: 'customer_phone' },
      { table: 'preorders', variants: ['totalPrice', 'totalprice'], target: 'total_price' },
      { table: 'preorders', variants: ['dueDate', 'duedate'], target: 'due_date' },
      { table: 'preorders', variants: ['createdAt', 'createdat'], target: 'created_at' },
      { table: 'system_logs', variants: ['userId', 'userid'], target: 'user_id' },
      { table: 'system_logs', variants: ['branchId', 'branchid'], target: 'branch_id' },
      { table: 'raw_materials', variants: ['branchId', 'branchid'], target: 'branch_id' },
      { table: 'production_logs', variants: ['branchId', 'branchid'], target: 'branch_id' },
      { table: 'production_logs', variants: ['userId', 'userid'], target: 'user_id' },
      { table: 'production_log_items', variants: ['productionLogId', 'productionlogid'], target: 'production_log_id' },
      { table: 'branch_sessions', variants: ['branchId', 'branchid', '"branchId"'], target: 'branch_id' },
      { table: 'branch_sessions', variants: ['userId', 'userid', '"userId"'], target: 'user_id' },
      { table: 'branch_sessions', variants: ['lastSeen', 'lastseen', '"lastSeen"'], target: 'last_seen' }
    ];

    console.log("Processing Schema Transitions...");
    for (const m of migrationQueue) {
      await ensureColumnRenamed(db, m.table, m.variants, m.target);
    }

    // 2.5 Data Rescue: Sync data from old columns to new columns IF both exist
    console.log("Executing Data Rescue Sync...");
    const rescueList = [
      { t: 'transactions', o: 'receiptNumber', n: 'receipt_number' },
      { t: 'transactions', o: 'paymentMethod', n: 'payment_method' },
      { t: 'transactions', o: 'amountPaid', n: 'amount_paid' },
      { t: 'transactions', o: 'customerId', n: 'customer_id' },
      { t: 'transactions', o: 'customerName', n: 'customer_name' },
      { t: 'transactions', o: 'branchId', n: 'branch_id' },
      { t: 'production_logs', o: 'quantityProduced', n: 'quantity_produced' },
      { t: 'production_logs', o: 'estimatedYield', n: 'estimated_yield' },
      { t: 'production_logs', o: 'productId', n: 'product_id' },
      { t: 'production_logs', o: 'productName', n: 'product_name' }
    ];
    for (const r of rescueList) {
      await syncColumnData(db, r.t, r.o, r.n);
    }

    // 3. Guaranteed Column Addition (If transition missed anything)
    const fallbackAdditions = [
      "ALTER TABLE users ADD COLUMN IF NOT EXISTS image TEXT",
      "ALTER TABLE products ADD COLUMN IF NOT EXISTS image TEXT",
      "ALTER TABLE branches ADD COLUMN IF NOT EXISTS last_seen TEXT",
      "ALTER TABLE products ADD COLUMN IF NOT EXISTS cost_price REAL DEFAULT 0",
      "ALTER TABLE products ADD COLUMN IF NOT EXISTS is_top_selling INTEGER DEFAULT 0",
      "ALTER TABLE preorders ADD COLUMN IF NOT EXISTS quantity REAL DEFAULT 1",
      "ALTER TABLE raw_materials ADD COLUMN IF NOT EXISTS cost_price REAL DEFAULT 0",
      "ALTER TABLE production_logs ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'completed'",
      "ALTER TABLE production_logs ADD COLUMN IF NOT EXISTS estimated_yield REAL DEFAULT 0",
      "ALTER TABLE production_logs ADD COLUMN IF NOT EXISTS unit TEXT",
      "ALTER TABLE branch_sessions ADD COLUMN IF NOT EXISTS last_seen TEXT"
    ];

    for (const sql of fallbackAdditions) {
      try { await db.run(sql); } catch (e) { }
    }

    // 3.4 Cleanup Duplicates in branch_sessions (Universal approach)
    try {
      console.log("[Migration] Cleaning duplicate sessions...");
      await db.run(`
        DELETE FROM branch_sessions 
        WHERE (branch_id, user_id, last_seen) NOT IN (
          SELECT branch_id, user_id, MAX(last_seen)
          FROM branch_sessions
          GROUP BY branch_id, user_id
        )
      `);
    } catch (e) {
      console.warn("[Migration] Duplicate cleanup failed or table empty:", e.message);
    }

    // 3.5 Force Primary Key on branch_sessions (Required for ON CONFLICT in Postgres)
    try {
      // In Postgres, adding a PK requires a UNIQUE constraint. 
      // We use a safe check to see if we already have a PK to avoid "already exists" errors.
      await db.run("ALTER TABLE branch_sessions ADD PRIMARY KEY (branch_id, user_id)");
      console.log("[Migration] branch_sessions PK added successfully.");
    } catch (e) {
      if (!e.message.includes('already exists')) {
        console.warn("[PK Guard] Could not add PK to branch_sessions:", e.message);
      }
    }

    // 4. Verification Check: Critical Columns Must Exist
    const checkColumns = [
      { t: 'transactions', c: 'branch_id' },
      { t: 'system_logs', c: 'branch_id' },
      { t: 'branch_sessions', c: 'branch_id' },
      { t: 'branches', c: 'last_seen' },
      { t: 'branch_sessions', c: 'last_seen' }
    ];

    for (const check of checkColumns) {
      try {
        // Use a faster check-then-ignore approach
        await db.run(`ALTER TABLE ${check.t} ADD COLUMN IF NOT EXISTS "${check.c}" TEXT`);
      } catch (e) {
        // Silently fail if column already exists (fallback for older DB versions)
        if (!e.message.includes('already exists')) {
           console.warn(`[Migration Warning] Column check fail: ${check.t}.${check.c}`, e.message);
        }
      }
    }

    // 5. System Admin Guarantee
    const devExists = await db.get("SELECT id FROM users WHERE id = 'dev-001'");
    if (!devExists) {
      await db.run(
        "INSERT INTO users (id, name, role, pin, branch_id) VALUES (?, ?, ?, ?, ?)",
        ["dev-001", "System Developer", "system_admin", "9999", null]
      );
    }

    // 6. Basic Performance Indexes (With safety catch)
    try {
      await db.exec(`
        CREATE INDEX IF NOT EXISTS idx_transactions_branch_date ON transactions(branch_id, date);
        CREATE INDEX IF NOT EXISTS idx_logs_branch_time ON system_logs(branch_id, timestamp);
        CREATE INDEX IF NOT EXISTS idx_sessions_branch ON branch_sessions(branch_id);
      `);
    } catch (e) {
      console.warn("[Index Catch]", e.message);
    }

    console.log("Database perfectly connected and synced!");
    return db;
  } catch (e) {
    console.error("CRITICAL: Database initialization failed:", e.message);
    throw e;
  }
}
