import { pgAdapter } from './pg-adapter.js';

export async function initDb() {
  const db = pgAdapter;

  await db.exec(`
    CREATE TABLE IF NOT EXISTS branches (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      address TEXT
    );

    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      role TEXT NOT NULL,
      pin TEXT NOT NULL,
      branchId TEXT,
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
      stock INTEGER DEFAULT 0,
      unit TEXT DEFAULT 'pc',
      reorderPoint INTEGER DEFAULT 0,
      emoji TEXT,
      image TEXT,
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
      change REAL DEFAULT 0,
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
      quantity INTEGER NOT NULL,
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
      items TEXT NOT NULL, -- JSON stringified array of items
      totalPrice REAL NOT NULL,
      deposit REAL DEFAULT 0,
      status TEXT DEFAULT 'pending',
      dueDate TEXT NOT NULL,
      notes TEXT,
      createdAt TEXT NOT NULL,
      FOREIGN KEY (branchId) REFERENCES branches(id)
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT
    );
  `);

  // Seed default branches and system admin if empty
  const branchCount = await db.get("SELECT COUNT(*) as count FROM branches");
  if (branchCount.count === 0) {
    const branch1Id = uuidv4();
    const branch2Id = uuidv4();
    
    await db.run("INSERT INTO branches (id, name, address) VALUES (?, ?, ?)", [branch1Id, "Main Branch", "Quezon City"]);
    await db.run("INSERT INTO branches (id, name, address) VALUES (?, ?, ?)", [branch2Id, "Makati Branch", "Makati City"]);
    
    // Default Owner (no branch restriction)
    await db.run("INSERT INTO users (id, name, role, pin, branchId) VALUES (?, ?, ?, ?, ?)", [uuidv4(), "Owner Global", "system_admin", "0000", null]);
    // Default Admin for Main Branch
    await db.run("INSERT INTO users (id, name, role, pin, branchId) VALUES (?, ?, ?, ?, ?)", [uuidv4(), "Admin QC", "admin", "1234", branch1Id]);
    // Default Manager for Makati Branch
    await db.run("INSERT INTO users (id, name, role, pin, branchId) VALUES (?, ?, ?, ?, ?)", [uuidv4(), "Manager Makati", "manager", "5678", branch2Id]);

    // Categories
    const catId1 = uuidv4();
    const catId2 = uuidv4();
    await db.run("INSERT INTO categories (id, name, emoji) VALUES (?, ?, ?)", [catId1, "Breads", "🍞"]);
    await db.run("INSERT INTO categories (id, name, emoji) VALUES (?, ?, ?)", [catId2, "Cakes", "🎂"]);

    // Seeds products for branch 1
    await db.run("INSERT INTO products (id, branchId, name, categoryId, price, stock, emoji) VALUES (?, ?, ?, ?, ?, ?, ?)", [uuidv4(), branch1Id, "QC Pandesal", catId1, 5, 200, "🍞"]);
    await db.run("INSERT INTO products (id, branchId, name, categoryId, price, stock, emoji) VALUES (?, ?, ?, ?, ?, ?, ?)", [uuidv4(), branch1Id, "QC Chocolate Cake", catId2, 500, 10, "🎂"]);
    
    // Seeds products for branch 2
    await db.run("INSERT INTO products (id, branchId, name, categoryId, price, stock, emoji) VALUES (?, ?, ?, ?, ?, ?, ?)", [uuidv4(), branch2Id, "Makati Sour Dough", catId1, 150, 20, "🥖"]);

    console.log("Database initialized and seeded with 2 branches.");
  }

  return db;
}
