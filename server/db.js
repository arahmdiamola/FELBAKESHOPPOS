import { pgAdapter } from './pg-adapter.js';
import { v4 as uuidv4 } from 'uuid';

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
      stock INTEGER DEFAULT 0,
      unit TEXT DEFAULT 'pc',
      reorderPoint INTEGER DEFAULT 0,
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

  // Ensure newer columns exist for existing databases (Migrations)
  try {
    await db.run("ALTER TABLE users ADD COLUMN IF NOT EXISTS image TEXT");
    await db.run("ALTER TABLE products ADD COLUMN IF NOT EXISTS image TEXT");
    await db.run("ALTER TABLE products ADD COLUMN IF NOT EXISTS isTopSelling INTEGER DEFAULT 0");
    await db.run("ALTER TABLE products ADD COLUMN IF NOT EXISTS costPrice REAL DEFAULT 0");
  } catch (err) {
    console.log("Migration info (safe to ignore if columns exist):", err.message);
  }

  // Automatically Seed 5 Realistic Branches, 20 Products, Users if database is entirely empty
  const branchCount = await db.get("SELECT COUNT(*) as count FROM branches");
  if (branchCount.count == 0) { // Handles PG string zero '0' loosely
    console.log("Empty Database Detected! Initializing FULL Realistic Seeder...");

    const branches = [
      { id: uuidv4(), name: 'Makati Branch', address: 'Ayala Ave, Makati' },
      { id: uuidv4(), name: 'BGC Branch', address: 'High Street, Taguig' },
      { id: uuidv4(), name: 'QC Branch', address: 'Trinoma, Quezon City' },
      { id: uuidv4(), name: 'Manila Branch', address: 'Ermita, Manila' },
      { id: uuidv4(), name: 'Alabang Branch', address: 'Festival Mall, Muntinlupa' }
    ];

    for (const b of branches) {
      await db.run("INSERT INTO branches (id, name, address) VALUES (?, ?, ?)", [b.id, b.name, b.address]);
    }

    // Role mapping
    const users = [
      { id: uuidv4(), name: "Global Owner", role: "system_admin", pin: "0000", branchId: null },
      { id: uuidv4(), name: "Regional Manager", role: "manager", pin: "8888", branchId: branches[0].id },
      { id: uuidv4(), name: "Makati Cashier", role: "cashier", pin: "1111", branchId: branches[0].id },
      { id: uuidv4(), name: "BGC Cashier", role: "cashier", pin: "2222", branchId: branches[1].id },
      { id: uuidv4(), name: "QC Cashier", role: "cashier", pin: "3333", branchId: branches[2].id },
      { id: uuidv4(), name: "Manila Cashier", role: "cashier", pin: "4444", branchId: branches[3].id },
      { id: uuidv4(), name: "Alabang Cashier", role: "cashier", pin: "5555", branchId: branches[4].id }
    ];
    for (const u of users) {
      await db.run("INSERT INTO users (id, name, role, pin, branchId) VALUES (?, ?, ?, ?, ?)", [u.id, u.name, u.role, u.pin, u.branchId]);
    }

    const categories = [
      { id: uuidv4(), name: "Breads", emoji: "🍞" },
      { id: uuidv4(), name: "Cakes", emoji: "🎂" },
      { id: uuidv4(), name: "Pastries", emoji: "🥐" },
      { id: uuidv4(), name: "Beverages", emoji: "🥤" }
    ];
    for (const c of categories) {
      await db.run("INSERT INTO categories (id, name, emoji) VALUES (?, ?, ?)", [c.id, c.name, c.emoji]);
    }

    const productData = [
      { name: "Classic Sourdough", cat: categories[0].id, p: 180, c: 90, e: "🍞" },
      { name: "French Baguette", cat: categories[0].id, p: 90, c: 40, e: "🥖" },
      { name: "Ube Pandesal", cat: categories[0].id, p: 120, c: 60, e: "🥯" },
      { name: "Premium White Loaf", cat: categories[0].id, p: 85, c: 40, e: "🥪" },
      { name: "Whole Wheat Bread", cat: categories[0].id, p: 110, c: 55, e: "🍞" },
      { name: "Red Velvet Cake", cat: categories[1].id, p: 1200, c: 500, e: "🎂" },
      { name: "Chocolate Fudge", cat: categories[1].id, p: 150, c: 60, e: "🍰" },
      { name: "Strawberry Shortcake", cat: categories[1].id, p: 1100, c: 450, e: "🍓" },
      { name: "Burnt Cheesecake", cat: categories[1].id, p: 950, c: 400, e: "🧀" },
      { name: "Carrot Walnut Cake", cat: categories[1].id, p: 850, c: 350, e: "🥕" },
      { name: "Butter Croissant", cat: categories[2].id, p: 95, c: 45, e: "🥐" },
      { name: "Pain au Chocolat", cat: categories[2].id, p: 120, c: 55, e: "🍫" },
      { name: "Cream Cheese Danish", cat: categories[2].id, p: 110, c: 50, e: "🥮" },
      { name: "Cinnamon Roll", cat: categories[2].id, p: 85, c: 35, e: "🍥" },
      { name: "Blueberry Muffin", cat: categories[2].id, p: 75, c: 30, e: "🧁" },
      { name: "Caramel Macchiato", cat: categories[3].id, p: 160, c: 60, e: "🥤" },
      { name: "Hot Spanish Latte", cat: categories[3].id, p: 140, c: 50, e: "☕" },
      { name: "Matcha Latte", cat: categories[3].id, p: 170, c: 65, e: "🍵" },
      { name: "Grapefruit Juice", cat: categories[3].id, p: 130, c: 50, e: "🍹" },
      { name: "Bottled Water", cat: categories[3].id, p: 40, c: 15, e: "💧" }
    ];

    let pCount = 0;
    for (const b of branches) {
      for (const p of productData) {
        // Randomly assign top selling status (1=Best Seller, 2=Hot Item, 3=Popular, 0=Normal)
        const isTopSelling = Math.random() > 0.8 ? Math.floor(Math.random() * 3) + 1 : 0;
        await db.run(
          "INSERT INTO products (id, branchId, name, categoryId, price, costPrice, stock, reorderPoint, emoji, isTopSelling) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
          [uuidv4(), b.id, p.name, p.cat, p.p, p.c, 50, 10, p.e, isTopSelling]
        );
        pCount++;
      }
    }

    // Seed Default Settings
    const settingsCheck = await db.get("SELECT COUNT(*) as count FROM settings");
    if (settingsCheck.count == 0) {
      const defaultSettings = [
        ['storeName', 'FEL Bakeshop'],
        ['storeLogo', '/logo.png'],
        ['storeAddress', 'Brgy. San Jose, Quezon City'],
        ['storePhone', '0917-123-4567'],
        ['receiptFooter', 'Thank you for choosing FEL Bakeshop! 🧁']
      ];
      for (const [key, value] of defaultSettings) {
        await db.run("INSERT INTO settings (key, value) VALUES (?, ?)", [key, value]);
      }
    }

    console.log(`✅ Fully Seeded Postgres! Successfully injected 5 Branches, 7 Users, and ${pCount} Products.`);
  }

  return db;
}
