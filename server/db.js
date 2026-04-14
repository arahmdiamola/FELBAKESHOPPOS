import { pgAdapter, isProduction } from './pg-adapter.js';
import { v4 as uuidv4 } from 'uuid';

async function syncColumnData(db, table, oldCol, newCol) {
  try {
    const cols = await db.all(`
      SELECT column_name FROM information_schema.columns 
      WHERE table_name = $1 AND table_schema = 'public'
    `, [table]);
    const names = cols.map(c => c.column_name);

    const oldExists = names.find(n => n.toLowerCase() === oldCol.toLowerCase());
    if (oldExists && names.includes(newCol)) {
      console.log(`[Data Rescue] Syncing ${table}.${oldExists} -> ${newCol}...`);
      await db.run(`UPDATE ${table} SET "${newCol}" = "${oldExists}" WHERE ("${newCol}" IS NULL OR "${newCol}" = 0 OR "${newCol}" = '')`);
    }
  } catch (e) {
    console.warn(`[Sync Warning] Failed to sync ${table}.${oldCol}:`, e.message);
  }
}

async function relaxAllConstraints(db, table) {
  try {
    console.log(`[Sanitizer] Scanning ${table} for restricted gates...`);
    const restrictedCols = await db.all(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = $1 
      AND is_nullable = 'NO' 
      AND column_name != 'id'
      AND table_schema = 'public'
    `, [table]);

    for (const colObj of restrictedCols) {
      const col = colObj.column_name;
      console.log(`[Sanitizer] Opening gate: ${table}.${col} (DROP NOT NULL)`);
      try {
        await db.run(`ALTER TABLE ${table} ALTER COLUMN "${col}" DROP NOT NULL`);
      } catch (e) {
        console.error(`[Sanitizer] Failed to open ${col}:`, e.message);
      }
    }
  } catch (err) {
    console.error(`[Sanitizer] Scanner failed for ${table}:`, err.message);
  }
}

async function bridgeLegacyData(db, legacyTable, targetTable, columnMap = {}) {
  try {
    const tables = await db.all("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'");
    const tableNames = tables.map(t => t.table_name);

    if (!tableNames.includes(legacyTable) || !tableNames.includes(targetTable)) return;

    const targetCount = await db.get(`SELECT count(*) FROM ${targetTable}`);
    const legacyCount = await db.get(`SELECT count(*) FROM ${legacyTable}`);

    if (parseInt(targetCount.count) === 0 && parseInt(legacyCount.count) > 0) {
      console.log(`[Legacy Bridge] Restoring data: ${legacyTable} -> ${targetTable} (${legacyCount.count} records)`);
      const colsRes = await db.all("SELECT column_name FROM information_schema.columns WHERE table_name = $1", [targetTable]);
      const targetCols = colsRes.map(c => c.column_name);
      const legacyData = await db.all(`SELECT * FROM ${legacyTable}`);
      
      for (const row of legacyData) {
        const insertObj = {};
        for (const legacyKey in row) {
          const targetKey = columnMap[legacyKey] || targetCols.find(tc => tc === legacyKey.toLowerCase() || tc === legacyKey.replace(/([A-Z])/g, '_$1').toLowerCase());
          if (targetKey && targetCols.includes(targetKey)) {
            insertObj[targetKey] = row[legacyKey];
          }
        }
        const keys = Object.keys(insertObj);
        if (keys.length === 0) continue;
        const placeholders = keys.map((_, i) => `$${i + 1}`).join(', ');
        const sql = `INSERT INTO ${targetTable} ("${keys.join('", "')}") VALUES (${placeholders})`;
        await db.run(sql, Object.values(insertObj));
      }
      console.log(`[Legacy Bridge] Successfully restored ${targetTable}`);
    }
  } catch (e) {
    console.warn(`[Bridge Error] Failed to bridge ${legacyTable} to ${targetTable}:`, e.message);
  }
}

async function robustColumnRepair(db, table, oldColVariants, newColName, isNotNull = false) {
  try {
    const columnsRes = await db.all(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = $1 AND table_schema = 'public'
    `, [table]);
    const cols = columnsRes.map(c => c.columnName || c.column_name);

    const match = oldColVariants.find(v => cols.includes(v.toLowerCase()));
    if (!match && !cols.includes(newColName)) return;

    if (match && match !== newColName) {
      console.log(`--- ROBUST REPAIR: ${table}.${match} -> ${newColName} ---`);
      
      // 1. Drop constraints that might block the drop
      try { await db.run(`ALTER TABLE ${table} DROP CONSTRAINT IF EXISTS "${table}_${match}_fkey"`); } catch (e) {}
      
      // 2. Ensure new column exists
      if (!cols.includes(newColName)) {
        await db.run(`ALTER TABLE ${table} ADD COLUMN "${newColName}" TEXT`);
      }
      
      // 3. Migrate data
      await db.run(`UPDATE ${table} SET "${newColName}" = "${match}" WHERE "${newColName}" IS NULL AND "${match}" IS NOT NULL`);
      
      // 4. Drop legacy column
      try { await db.run(`ALTER TABLE ${table} DROP COLUMN "${match}"`); } catch (e) {}
      
      // 5. Enforce NOT NULL if requested
      if (isNotNull) {
        await db.run(`ALTER TABLE ${table} ALTER COLUMN "${newColName}" SET NOT NULL`);
      }
      console.log(`--- ${table}.${newColName} standardizing complete ---`);
    }
  } catch (err) {
    console.warn(`[Repair Notice] Skipping ${table}.${newColName} robust repair:`, err.message);
  }
}

async function ensureColumnRenamed(db, table, oldColNames, newColName) {
  try {
    // 1. Get all columns for this table
    const result = await db.all(`
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

export async function fixBranchSessionsTable(db) {
  try {
    const columnsRes = await db.all(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'branch_sessions'
    `);
    const cols = columnsRes.map(c => c.columnName || c.column_name);

    if (cols.includes('branchid') || cols.includes('userid')) {
      console.log('--- PERFORMING ROBUST REPAIR ON branch_sessions ---');
      
      // 1. Drop existing constraints if they exist
      try { await db.run('ALTER TABLE branch_sessions DROP CONSTRAINT IF EXISTS branch_sessions_pkey'); } catch (e) {}
      try { await db.run('ALTER TABLE branch_sessions DROP CONSTRAINT IF EXISTS branch_sessions_branchid_fkey'); } catch (e) {}
      
      // 2. Ensure new columns exist
      if (!cols.includes('branch_id')) await db.run('ALTER TABLE branch_sessions ADD COLUMN branch_id UUID');
      if (!cols.includes('user_id')) await db.run('ALTER TABLE branch_sessions ADD COLUMN user_id UUID');
      
      // 3. Migrate data using name-matching
      if (cols.includes('branchid')) {
        await db.run('UPDATE branch_sessions SET branch_id = branchid WHERE branch_id IS NULL AND branchid IS NOT NULL');
      }
      if (cols.includes('userid')) {
        await db.run('UPDATE branch_sessions SET user_id = userid WHERE user_id IS NULL AND userid IS NOT NULL');
      }

      // 4. Drop old columns
      if (cols.includes('branchid')) await db.run('ALTER TABLE branch_sessions DROP COLUMN branchid');
      if (cols.includes('userid')) await db.run('ALTER TABLE branch_sessions DROP COLUMN userid');

      // 5. Cleanup NULLs (safety)
      await db.run('DELETE FROM branch_sessions WHERE branch_id IS NULL OR user_id IS NULL');

      // 6. Enforce NOT NULL
      await db.run('ALTER TABLE branch_sessions ALTER COLUMN branch_id SET NOT NULL');
      await db.run('ALTER TABLE branch_sessions ALTER COLUMN user_id SET NOT NULL');
      
      // 7. Restore Primary Key
      try {
        await db.run('ALTER TABLE branch_sessions ADD PRIMARY KEY (branch_id, user_id)');
        console.log('--- branch_sessions Repair Complete ---');
      } catch (e) {
        console.warn('[Fix Warning] branch_sessions PK restoral:', e.message);
      }
    }
  } catch (err) {
    console.warn('[Repair Failure] branch_sessions:', err.message);
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

    // --- REPAIR & MIGRATION LOGIC (Postgres Only) ---
    if (isProduction) {
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
      { table: 'production_log_items', variants: ['materialId', 'materialid'], target: 'material_id' },
      { table: 'production_log_items', variants: ['materialName', 'materialname'], target: 'material_name' },
      { table: 'production_log_items', variants: ['quantityUsed', 'quantityused'], target: 'quantity_used' },
      { table: 'production_log_items', variants: ['costPrice', 'costprice'], target: 'cost_price' },
      { table: 'production_logs', variants: ['productId', 'productid'], target: 'product_id' },
      { table: 'production_logs', variants: ['productName', 'productname'], target: 'product_name' },
      { table: 'production_logs', variants: ['quantityProduced', 'quantityproduced'], target: 'quantity_produced' },
      { table: 'production_logs', variants: ['estimatedYield', 'estimatedyield'], target: 'estimated_yield' },
      { table: 'raw_materials', variants: ['reorderPoint', 'reorderpoint'], target: 'reorder_point' },
      { table: 'branch_sessions', variants: ['branchId', 'branchid', '"branchId"'], target: 'branch_id' },
      { table: 'branch_sessions', variants: ['userId', 'userid', '"userId"'], target: 'user_id' },
      { table: 'branch_sessions', variants: ['lastSeen', 'lastseen', '"lastSeen"'], target: 'last_seen' }
    ];

    // 2. Final Standardization Run
    console.log('[Migration] Starting Global Casing Standardization...');
    for (const item of migrationQueue) {
      await ensureColumnRenamed(db, item.table, item.variants, item.target);
    }

    // 2.5 Universal Sanitation (v1.1.8 Master Key)
    console.log('[Migration] Activating Universal Schema Sanitizer...');
    await relaxAllConstraints(db, 'production_logs');
    await relaxAllConstraints(db, 'production_log_items');

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

    // 2.7 Bridged Restoration (Cross-Table Sync)
    console.log("Executing Legacy Table Bridging...");
    await bridgeLegacyData(db, 'cs_branches', 'branches');
    await bridgeLegacyData(db, 'cs_users', 'users');
    await bridgeLegacyData(db, 'cs_products', 'products', { 
      'costprice': 'cost_price', 
      'reorderpoint': 'reorder_point',
      'categoryid': 'category_id',
      'branchid': 'branch_id',
      'istopselling': 'is_top_selling'
    });
    await bridgeLegacyData(db, 'cs_transactions', 'transactions', {
      'receiptnumber': 'receipt_number',
      'paymentmethod': 'payment_method',
      'amountpaid': 'amount_paid',
      'branchid': 'branch_id',
      'cashierid': 'cashier_id',
      'cashiername': 'cashier_name',
      'customerid': 'customer_id',
      'customername': 'customer_name'
    });
    await bridgeLegacyData(db, 'cs_transaction_items', 'transaction_items', {
      'transactionid': 'transaction_id',
      'productid': 'product_id'
    });
    await bridgeLegacyData(db, 'cs_raw_materials', 'raw_materials');
    await bridgeLegacyData(db, 'cs_production_logs', 'production_logs');
    await bridgeLegacyData(db, 'cs_categories', 'categories');

    // 2.8 Repair Pulse table schema (Resolves 'branchid' not-null constraint error)
    await fixBranchSessionsTable(db);

    // 3. Guaranteed Column Addition (If transition missed anything)
    const fallbackAdditions = [
      "ALTER TABLE production_log_items ALTER COLUMN materialid DROP NOT NULL",
      "ALTER TABLE production_log_items ALTER COLUMN materialId DROP NOT NULL",
      "ALTER TABLE production_log_items ALTER COLUMN productionlogid DROP NOT NULL",
      "ALTER TABLE production_logs ALTER COLUMN productid DROP NOT NULL",
      "ALTER TABLE production_logs ALTER COLUMN userid DROP NOT NULL",
      "ALTER TABLE users ADD COLUMN IF NOT EXISTS image TEXT",
      "ALTER TABLE products ADD COLUMN IF NOT EXISTS image TEXT",
      "ALTER TABLE branches ADD COLUMN IF NOT EXISTS last_seen TEXT",
      "ALTER TABLE products ADD COLUMN IF NOT EXISTS cost_price REAL DEFAULT 0",
      "ALTER TABLE products ADD COLUMN IF NOT EXISTS is_top_selling INTEGER DEFAULT 0",
      "ALTER TABLE preorders ADD COLUMN IF NOT EXISTS quantity REAL DEFAULT 1",
      "ALTER TABLE raw_materials ADD COLUMN IF NOT EXISTS reorder_point REAL DEFAULT 0",
      "ALTER TABLE raw_materials ADD COLUMN IF NOT EXISTS cost_price REAL DEFAULT 0",
      "ALTER TABLE production_logs ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'completed'",
      "ALTER TABLE production_logs ADD COLUMN IF NOT EXISTS estimated_yield REAL DEFAULT 0",
      "ALTER TABLE production_logs ADD COLUMN IF NOT EXISTS unit TEXT",
      "ALTER TABLE production_logs ADD COLUMN IF NOT EXISTS user_name TEXT",
      "ALTER TABLE production_logs ADD COLUMN IF NOT EXISTS user_id TEXT",
      "ALTER TABLE production_logs ADD COLUMN IF NOT EXISTS product_id TEXT",
      "ALTER TABLE production_logs ADD COLUMN IF NOT EXISTS product_name TEXT",
      "ALTER TABLE production_logs ADD COLUMN IF NOT EXISTS branch_id TEXT",
      "ALTER TABLE production_logs ADD COLUMN IF NOT EXISTS quantity_produced REAL DEFAULT 0",
      "ALTER TABLE production_logs ADD COLUMN IF NOT EXISTS date TEXT",
      "ALTER TABLE production_logs ADD COLUMN IF NOT EXISTS notes TEXT",
      "ALTER TABLE production_log_items ADD COLUMN IF NOT EXISTS production_log_id TEXT",
      "ALTER TABLE production_log_items ADD COLUMN IF NOT EXISTS material_id TEXT",
      "ALTER TABLE production_log_items ADD COLUMN IF NOT EXISTS material_name TEXT",
      "ALTER TABLE production_log_items ADD COLUMN IF NOT EXISTS quantity_used REAL DEFAULT 0",
      "ALTER TABLE production_log_items ADD COLUMN IF NOT EXISTS unit TEXT",
      "ALTER TABLE production_log_items ADD COLUMN IF NOT EXISTS cost_price REAL DEFAULT 0",
      "ALTER TABLE branch_sessions ADD COLUMN IF NOT EXISTS last_seen TEXT"
    ];

    for (const sql of fallbackAdditions) {
      try { await db.run(sql); } catch (e) { }
    }

    // 3.2 Robust System-Wide Repair (Fixes 500 errors on checkout and heartbeat)
    console.log("Starting Critical Column Sanitization...");
    await robustColumnRepair(db, 'transactions', ['branchid'], 'branch_id', true);
    await robustColumnRepair(db, 'transactions', ['receiptnumber'], 'receipt_number', true);
    await robustColumnRepair(db, 'transactions', ['paymentmethod'], 'payment_method', true);
    await robustColumnRepair(db, 'products', ['branchid'], 'branch_id', true);
    await robustColumnRepair(db, 'products', ['categoryid'], 'category_id');
    await robustColumnRepair(db, 'system_logs', ['username'], 'user_name');
    await robustColumnRepair(db, 'production_logs', ['username'], 'user_name');
    await robustColumnRepair(db, 'production_log_items', ['materialname', 'materialName'], 'material_name');
    await robustColumnRepair(db, 'production_log_items', ['costprice', 'costPrice'], 'cost_price');
    await robustColumnRepair(db, 'production_logs', ['branchid', 'branchId'], 'branch_id');
    await robustColumnRepair(db, 'production_logs', ['userid', 'userId'], 'user_id');
    await robustColumnRepair(db, 'production_logs', ['username'], 'user_name');

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
        CREATE INDEX IF NOT EXISTS idx_transactions_date_only ON transactions(date);
        CREATE INDEX IF NOT EXISTS idx_logs_branch_time ON system_logs(branch_id, timestamp);
        CREATE INDEX IF NOT EXISTS idx_logs_timestamp_only ON system_logs(timestamp);
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
