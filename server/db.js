import { pgAdapter } from './pg-adapter.js';
import { v4 as uuidv4 } from 'uuid';

export async function initDb() {
  const db = pgAdapter;

  try {
    // 1. Core Tables
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

    // 2. Column Renaming Migration (camelCase -> snake_case)
    const renames = [
      ['branches', 'branchId', 'id'], // accidental rename prevention
      ['users', 'branchId', 'branch_id'],
      ['products', 'branchId', 'branch_id'],
      ['products', 'categoryId', 'category_id'],
      ['products', 'costPrice', 'cost_price'],
      ['products', 'reorderPoint', 'reorder_point'],
      ['products', 'isTopSelling', 'is_top_selling'],
      ['transactions', 'branchId', 'branch_id'],
      ['transactions', 'receiptNumber', 'receipt_number'],
      ['transactions', 'paymentMethod', 'payment_method'],
      ['transactions', 'amountPaid', 'amount_paid'],
      ['transactions', 'customerId', 'customer_id'],
      ['transactions', 'customerName', 'customer_name'],
      ['transactions', 'cashierId', 'cashier_id'],
      ['transactions', 'cashierName', 'cashier_name'],
      ['transaction_items', 'transactionId', 'transaction_id'],
      ['transaction_items', 'productId', 'product_id'],
      ['customers', 'branchId', 'branch_id'],
      ['customers', 'totalSpent', 'total_spent'],
      ['expenses', 'branchId', 'branch_id'],
      ['expenses', 'addedBy', 'added_by'],
      ['preorders', 'branchId', 'branch_id'],
      ['preorders', 'customerName', 'customer_name'],
      ['preorders', 'customerPhone', 'customer_phone'],
      ['preorders', 'totalPrice', 'total_price'],
      ['preorders', 'dueDate', 'due_date'],
      ['preorders', 'createdAt', 'created_at'],
      ['system_logs', 'userId', 'user_id'],
      ['system_logs', 'userName', 'user_name'],
      ['system_logs', 'branchId', 'branch_id'],
      ['raw_materials', 'branchId', 'branch_id'],
      ['raw_materials', 'reorderPoint', 'reorder_point'],
      ['raw_materials', 'costPrice', 'cost_price'],
      ['production_logs', 'branchId', 'branch_id'],
      ['production_logs', 'userId', 'user_id'],
      ['production_logs', 'userName', 'user_name'],
      ['production_logs', 'productId', 'product_id'],
      ['production_logs', 'productName', 'product_name'],
      ['production_logs', 'quantityProduced', 'quantity_produced'],
      ['production_logs', 'estimatedYield', 'estimated_yield'],
      ['production_log_items', 'productionLogId', 'production_log_id'],
      ['production_log_items', 'materialId', 'material_id'],
      ['production_log_items', 'materialName', 'material_name'],
      ['production_log_items', 'quantityUsed', 'quantity_used'],
      ['production_log_items', 'costPrice', 'cost_price'],
      ['branch_sessions', 'branchId', 'branch_id'],
      ['branch_sessions', 'userId', 'user_id'],
      ['branch_sessions', 'lastSeen', 'last_seen']
    ];

    for (const [table, oldCol, newCol] of renames) {
      try {
        // Postgres syntax for rename
        await db.run(`ALTER TABLE ${table} RENAME COLUMN "${oldCol}" TO "${newCol}"`);
        console.log(`Migrated ${table}.${oldCol} -> ${newCol}`);
      } catch (e) {
        // Ignore if column doesn't exist or already renamed
      }
    }

    // 3. Optional: Add missing columns if they don't exist
    const migrations = [
      "ALTER TABLE users ADD COLUMN IF NOT EXISTS image TEXT",
      "ALTER TABLE products ADD COLUMN IF NOT EXISTS image TEXT",
      "ALTER TABLE products ADD COLUMN IF NOT EXISTS is_top_selling INTEGER DEFAULT 0",
      "ALTER TABLE products ADD COLUMN IF NOT EXISTS cost_price REAL DEFAULT 0",
      "ALTER TABLE preorders ADD COLUMN IF NOT EXISTS quantity REAL DEFAULT 1",
      "ALTER TABLE branches ADD COLUMN IF NOT EXISTS last_seen TEXT",
      "ALTER TABLE raw_materials ADD COLUMN IF NOT EXISTS image TEXT",
      "ALTER TABLE raw_materials ADD COLUMN IF NOT EXISTS cost_price REAL DEFAULT 0",
      "ALTER TABLE production_logs ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'completed'",
      "ALTER TABLE production_logs ADD COLUMN IF NOT EXISTS estimated_yield REAL DEFAULT 0",
      "ALTER TABLE production_log_items ADD COLUMN IF NOT EXISTS cost_price REAL DEFAULT 0"
    ];

    for (const sql of migrations) {
      try { await db.run(sql); } catch (e) {}
    }

    // 3. System Admin Guarantee
    const devExists = await db.get("SELECT id FROM users WHERE id = 'dev-001'");
    if (!devExists) {
      await db.run(
        "INSERT INTO users (id, name, role, pin, branch_id) VALUES (?, ?, ?, ?, ?)",
        ["dev-001", "System Developer", "system_admin", "9999", null]
      );
    }

    // 4. Fresh Database Seeding (Optional)
    const branchCountResult = await db.get("SELECT COUNT(*) as count FROM branches");
    if (parseInt(branchCountResult?.count || '0') === 0) {
      console.log("Empty Database! Seeding defaults...");
      
      const bId = uuidv4();
      await db.run("INSERT INTO branches (id, name, address) VALUES (?, ?, ?)", [bId, 'Main Branch', 'City Center']);
      
      const cId = uuidv4();
      await db.run("INSERT INTO categories (id, name, emoji) VALUES (?, ?, ?)", [cId, 'Breads', '🍞']);
      
      await db.run(
        "INSERT INTO products (id, branch_id, name, category_id, price, cost_price, stock, reorder_point, emoji) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
        [uuidv4(), bId, 'Classic Sourdough', cId, 180, 90, 50, 10, '🍞']
      );

      const defaultSettings = [
        ['storeName', 'FEL Bakeshop'],
        ['storeLogo', '/logo.png'],
        ['storeAddress', 'Brgy. San Jose, Quezon City'],
        ['storePhone', '0917-123-4567'],
        ['receiptFooter', 'Thank you for choosing FEL Bakeshop! 🧁'],
        ['branchGoal', '25000']
      ];
      for (const [key, value] of defaultSettings) {
        await db.run("INSERT INTO settings (key, value) VALUES (?, ?)", [key, value]);
      }
    }
    // 5. Basic Performance Indexes (Moved here to ensure columns exist)
    await db.exec(`
      CREATE INDEX IF NOT EXISTS idx_transactions_branch_date ON transactions(branch_id, date);
      CREATE INDEX IF NOT EXISTS idx_logs_branch_time ON system_logs(branch_id, timestamp);
      CREATE INDEX IF NOT EXISTS idx_sessions_branch ON branch_sessions(branch_id);
    `);

    console.log("Database perfectly connected and synced!");
    return db;
  } catch (e) {
    console.error("Database initialization failed:", e);
    throw e;
  }
}
