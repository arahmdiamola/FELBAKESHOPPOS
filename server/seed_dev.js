import dotenv from 'dotenv';
dotenv.config();
import { pgAdapter as db } from './pg-adapter.js';
import { initDb } from './db.js';
import { v4 as uuidv4 } from 'uuid';

async function seed() {
  console.log("🌱 Starting Local Development Seeding...");
  
  // Ensure DB is initialized (tables created)
  await initDb();

  // Clear existing local data (order matters for FK constraints)
  console.log("🧹 Cleaning old data...");
  await db.exec("DELETE FROM transaction_items");
  await db.exec("DELETE FROM transactions");
  await db.exec("DELETE FROM production_log_items");
  await db.exec("DELETE FROM production_logs");
  await db.exec("DELETE FROM preorders");
  await db.exec("DELETE FROM expenses");
  await db.exec("DELETE FROM customers");
  await db.exec("DELETE FROM raw_materials");
  await db.exec("DELETE FROM system_logs");
  await db.exec("DELETE FROM branch_sessions");
  await db.exec("DELETE FROM users");
  await db.exec("DELETE FROM products");
  await db.exec("DELETE FROM categories");
  await db.exec("DELETE FROM branches");

  const branches = [
    { id: uuidv4(), name: 'Main Bakery HQ', address: 'Baguio City' },
    { id: uuidv4(), name: 'Highway Branch', address: 'Kennon Road' },
    { id: uuidv4(), name: 'Market Annex', address: 'Public Market' }
  ];

  for (const b of branches) {
    await db.run("INSERT INTO branches (id, name, address) VALUES (?, ?, ?)", [b.id, b.name, b.address]);
  }
  console.log(`✅ Seeded ${branches.length} Branches`);

  const users = [
    { id: 'dev-admin', name: "Local Admin", role: "system_admin", pin: "9999", branchId: null },
    { id: uuidv4(), name: "HQ Manager", role: "manager", pin: "1234", branchId: branches[0].id },
    { id: uuidv4(), name: "Cashier One", role: "cashier", pin: "1111", branchId: branches[0].id },
    { id: uuidv4(), name: "Cashier Two", role: "cashier", pin: "2222", branchId: branches[1].id }
  ];

  for (const u of users) {
    await db.run("INSERT INTO users (id, name, role, pin, branch_id) VALUES (?, ?, ?, ?, ?)", [u.id, u.name, u.role, u.pin, u.branchId]);
  }
  console.log("✅ Seeded Admin & Staff");

  const categories = [
    { id: uuidv4(), name: "Breads", emoji: "🍞" },
    { id: uuidv4(), name: "Pastries", emoji: "🥐" },
    { id: uuidv4(), name: "Cakes", emoji: "🎂" }
  ];
  for (const c of categories) {
    await db.run("INSERT INTO categories (id, name, emoji) VALUES (?, ?, ?)", [c.id, c.name, c.emoji]);
  }

  // Create some products for Main HQ
  const products = [
    { name: "Pandesal (10pcs)", price: 50, cat: categories[0].id, stock: 100, emoji: "🥖" },
    { name: "Ensaymada", price: 35, cat: categories[1].id, stock: 50, emoji: "🥯" },
    { name: "Spanish Bread", price: 15, cat: categories[0].id, stock: 80, emoji: "🥐" },
    { name: "Chocolate Cake Slice", price: 85, cat: categories[2].id, stock: 20, emoji: "🍰" }
  ];

  for (const p of products) {
    await db.run(
      "INSERT INTO products (id, branch_id, name, category_id, price, stock, emoji) VALUES (?, ?, ?, ?, ?, ?, ?)",
      [uuidv4(), branches[0].id, p.name, p.cat, p.price, p.stock, p.emoji]
    );
  }
  console.log("✅ Seeded Sample Products");

  // Create a sample transaction for the dashboard to show revenue
  const transId = uuidv4();
  const now = new Date().toISOString();
  await db.run(
    "INSERT INTO transactions (id, branch_id, receipt_number, subtotal, total, payment_method, amount_paid, date, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
    [transId, branches[0].id, 'REC-001', 135, 135, 'cash', 200, now, 'completed']
  );
  
  console.log("🌟 Seeding complete! You can now run the dashboard locally.");
}

seed().catch(err => {
  console.error("❌ Seeding failed:", err);
  process.exit(1);
});
