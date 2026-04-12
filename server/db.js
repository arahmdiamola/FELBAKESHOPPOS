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
        lastSeen TEXT
      );

      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        role TEXT NOT NULL,
        pin TEXT NOT NULL,
        branchId TEXT,
        image TEXT,
        FOREIGN KEY (branchId) REFERENCES branches(id)
      );

      CREATE TABLE IF NOT EXISTS categories (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        emoji TEXT
      );

      CREATE TABLE IF NOT EXISTS products (
        id TEXT PRIMARY KEY,
        branchId TEXT NOT NULL,
        name TEXT NOT NULL,
        categoryId TEXT,
        price REAL NOT NULL,
        costPrice REAL DEFAULT 0,
        stock REAL DEFAULT 0,
        unit TEXT DEFAULT 'pc',
        reorderPoint REAL DEFAULT 0,
        emoji TEXT,
        image TEXT,
        isTopSelling INTEGER DEFAULT 0,
        FOREIGN KEY (branchId) REFERENCES branches(id)
      );

      CREATE TABLE IF NOT EXISTS transactions (
        id TEXT PRIMARY KEY,
        branchId TEXT NOT NULL,
        receiptNumber TEXT NOT NULL,
        subtotal REAL NOT NULL,
        discount REAL DEFAULT 0,
        tax REAL DEFAULT 0,
        total REAL NOT NULL,
        paymentMethod TEXT NOT NULL,
        amountPaid REAL NOT NULL,
        "change" REAL DEFAULT 0,
        customerId TEXT,
        customerName TEXT,
        cashierId TEXT,
        cashierName TEXT,
        date TEXT NOT NULL,
        status TEXT DEFAULT 'completed',
        notes TEXT,
        FOREIGN KEY (branchId) REFERENCES branches(id)
      );

      CREATE TABLE IF NOT EXISTS transaction_items (
        id TEXT PRIMARY KEY,
        transactionId TEXT NOT NULL,
        productId TEXT NOT NULL,
        name TEXT NOT NULL,
        price REAL NOT NULL,
        quantity REAL NOT NULL,
        unit TEXT,
        discount REAL DEFAULT 0,
        total REAL NOT NULL,
        FOREIGN KEY (transactionId) REFERENCES transactions(id)
      );

      CREATE TABLE IF NOT EXISTS customers (
        id TEXT PRIMARY KEY,
        branchId TEXT NOT NULL,
        name TEXT NOT NULL,
        phone TEXT,
        email TEXT,
        address TEXT,
        totalSpent REAL DEFAULT 0,
        visits INTEGER DEFAULT 0,
        balance REAL DEFAULT 0,
        FOREIGN KEY (branchId) REFERENCES branches(id)
      );

      CREATE TABLE IF NOT EXISTS expenses (
        id TEXT PRIMARY KEY,
        branchId TEXT NOT NULL,
        category TEXT NOT NULL,
        description TEXT,
        amount REAL NOT NULL,
        date TEXT NOT NULL,
        addedBy TEXT,
        FOREIGN KEY (branchId) REFERENCES branches(id)
      );

      CREATE TABLE IF NOT EXISTS preorders (
        id TEXT PRIMARY KEY,
        branchId TEXT NOT NULL,
        customerName TEXT NOT NULL,
        customerPhone TEXT NOT NULL,
        items TEXT NOT NULL,
        totalPrice REAL NOT NULL,
        deposit REAL DEFAULT 0,
        status TEXT DEFAULT 'pending',
        dueDate TEXT NOT NULL,
        notes TEXT,
        quantity REAL DEFAULT 1,
        createdAt TEXT NOT NULL,
        FOREIGN KEY (branchId) REFERENCES branches(id)
      );

      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT
      );

      CREATE TABLE IF NOT EXISTS system_logs (
        id TEXT PRIMARY KEY,
        timestamp TEXT NOT NULL,
        userId TEXT,
        userName TEXT,
        action TEXT NOT NULL,
        details TEXT,
        branchId TEXT
      );

      CREATE TABLE IF NOT EXISTS raw_materials (
        id TEXT PRIMARY KEY,
        branchId TEXT NOT NULL,
        name TEXT NOT NULL,
        stock REAL DEFAULT 0,
        unit TEXT DEFAULT 'kg',
        reorderPoint REAL DEFAULT 0,
        emoji TEXT,
        FOREIGN KEY (branchId) REFERENCES branches(id)
      );

      CREATE TABLE IF NOT EXISTS production_logs (
        id TEXT PRIMARY KEY,
        branchId TEXT NOT NULL,
        userId TEXT NOT NULL,
        userName TEXT,
        productId TEXT,
        productName TEXT,
        quantityProduced REAL DEFAULT 0,
        date TEXT NOT NULL,
        notes TEXT,
        FOREIGN KEY (branchId) REFERENCES branches(id)
      );

      CREATE TABLE IF NOT EXISTS production_log_items (
        id TEXT PRIMARY KEY,
        productionLogId TEXT NOT NULL,
        materialId TEXT NOT NULL,
        materialName TEXT,
        quantityUsed REAL NOT NULL,
        unit TEXT,
        FOREIGN KEY (productionLogId) REFERENCES production_logs(id)
      );

      CREATE TABLE IF NOT EXISTS branch_sessions (
        branchId TEXT NOT NULL,
        userId TEXT NOT NULL,
        lastSeen TEXT NOT NULL,
        PRIMARY KEY (branchId, userId),
        FOREIGN KEY (branchId) REFERENCES branches(id)
      );

      -- Basic Performance Indexes
      CREATE INDEX IF NOT EXISTS idx_transactions_branch_date ON transactions(branchId, date);
      CREATE INDEX IF NOT EXISTS idx_logs_branch_time ON system_logs(branchId, timestamp);
      CREATE INDEX IF NOT EXISTS idx_sessions_branch ON branch_sessions(branchId);
    `);

    // 2. Safely add columns if they don't exist (Migrations)
    // Postgres doesn't support ADD COLUMN IF NOT EXISTS in all versions, 
    // but Render should. We use try/catch per block just in case.
    const migrations = [
      "ALTER TABLE users ADD COLUMN IF NOT EXISTS image TEXT",
      "ALTER TABLE products ADD COLUMN IF NOT EXISTS image TEXT",
      "ALTER TABLE products ADD COLUMN IF NOT EXISTS isTopSelling INTEGER DEFAULT 0",
      "ALTER TABLE products ADD COLUMN IF NOT EXISTS costPrice REAL DEFAULT 0",
      "ALTER TABLE preorders ADD COLUMN IF NOT EXISTS quantity REAL DEFAULT 1",
      "ALTER TABLE branches ADD COLUMN IF NOT EXISTS lastSeen TEXT",
       "ALTER TABLE raw_materials ADD COLUMN IF NOT EXISTS image TEXT",
      "ALTER TABLE production_logs ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'completed'",
      "ALTER TABLE production_logs ADD COLUMN IF NOT EXISTS estimatedYield REAL DEFAULT 0",
      "ALTER TABLE production_log_items ADD COLUMN IF NOT EXISTS costPrice REAL DEFAULT 0"
    ];

    for (const sql of migrations) {
      try { await db.run(sql); } catch (e) {}
    }

    // 3. System Admin Guarantee
    const devExists = await db.get("SELECT id FROM users WHERE id = 'dev-001'");
    if (!devExists) {
      await db.run(
        "INSERT INTO users (id, name, role, pin, branchId) VALUES (?, ?, ?, ?, ?)",
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
        "INSERT INTO products (id, branchId, name, categoryId, price, costPrice, stock, reorderPoint, emoji) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
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
    console.log("Database perfectly connected and synced!");
    return db;
  } catch (e) {
    console.error("Database initialization failed:", e);
    throw e;
  }
}
