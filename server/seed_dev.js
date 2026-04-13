import { pgAdapter } from './pg-adapter.js';
import { v4 as uuidv4 } from 'uuid';
import { initDb } from './db.js';

async function seed() {
  // SAFETY GUARD: Never run this on a live database
  if (process.env.DATABASE_URL) {
    console.error("❌ CRITICAL ERROR: DATABASE_URL detected!");
    console.error("This is a LOCAL SEED script. It is forbidden to run this against the live database.");
    console.error("Please unset your DATABASE_URL or remove it from .env before running this script.");
    process.exit(1);
  }

  console.log("🌱 Starting Local Development Seeding...");
  
  // Ensure DB is initialized (tables created)
  const db = await initDb();

  // Clear existing mock data gracefully
  const tables = ['transaction_items', 'transactions', 'branch_sessions', 'products', 'categories', 'users', 'branches', 'customers', 'expenses', 'preorders', 'system_logs', 'raw_materials', 'production_log_items', 'production_logs'];
  for (const table of tables) {
    await db.run(`DELETE FROM ${table}`);
  }

  // 1. Branches
  const branches = [
    { id: uuidv4(), name: 'Main Bakery HQ', address: '123 Bakers St, City' },
    { id: uuidv4(), name: 'Highway Branch', address: '456 Express Rd, Suburb' },
    { id: uuidv4(), name: 'Mall Kiosk', address: 'Level 1, Grand Mall' }
  ];

  for (const b of branches) {
    await db.run("INSERT INTO branches (id, name, address) VALUES (?, ?, ?)", [b.id, b.name, b.address]);
  }
  console.log("✅ Seeded 3 Branches");

  // 2. Users
  const users = [
    { id: 'dev-001', name: "Local Admin", role: "system_admin", pin: "9999", branch_id: null },
    { id: uuidv4(), name: "HQ Manager", role: "manager", pin: "1234", branch_id: branches[0].id },
    { id: uuidv4(), name: "Cashier One", role: "cashier", pin: "1111", branch_id: branches[1].id },
    { id: uuidv4(), name: "Cashier Two", role: "cashier", pin: "2222", branch_id: branches[1].id }
  ];

  for (const u of users) {
    await db.run(
      "INSERT INTO users (id, name, role, pin, branch_id) VALUES (?, ?, ?, ?, ?)",
      [u.id, u.name, u.role, u.pin, u.branch_id]
    );
  }
  console.log("✅ Seeded 4 Test Users");

  // 3. Categories
  const categories = [
    { id: uuidv4(), name: "Breads", emoji: "🍞" },
    { id: uuidv4(), name: "Cakes", emoji: "🎂" },
    { id: uuidv4(), name: "Pastries", emoji: "🥐" }
  ];
  for (const c of categories) {
    await db.run("INSERT INTO categories (id, name, emoji) VALUES (?, ?, ?)", [c.id, c.name, c.emoji]);
  }

  // 4. Products
  const products = [
    { id: uuidv4(), name: "Pandesal", cat: categories[0].id, p: 5, c: 2, e: "🥯" },
    { id: uuidv4(), name: "Loaf Bread", cat: categories[0].id, p: 60, c: 35, e: "🍞" },
    { id: uuidv4(), name: "Chocolate Cake", cat: categories[1].id, p: 500, c: 250, e: "🎂" },
    { id: uuidv4(), name: "Croissant", cat: categories[2].id, p: 45, c: 20, e: "🥐" }
  ];

  for (const b of branches) {
    for (const p of products) {
      await db.run(
        "INSERT INTO products (id, branch_id, name, category_id, price, cost_price, stock, emoji) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        [uuidv4(), b.id, p.name, p.cat, p.p, p.c, 100, p.e]
      );
    }
  }
  console.log("✅ Seeded Products for all branches");

  console.log("🎉 Local Seeding Complete! Ready for safe testing.");
}

seed().catch(err => {
  console.error("❌ Seeding Failed:", err);
  process.exit(1);
});
