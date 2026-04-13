import dotenv from 'dotenv';
dotenv.config();

import pg from 'pg';
import { v4 as uuidv4 } from 'uuid';

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function seed() {
  console.log("Seeding Live Supabase Database...");
  
  // Clear any existing mock data gracefully
  await pool.query("DELETE FROM users");
  await pool.query("DELETE FROM products");
  await pool.query("DELETE FROM categories");
  await pool.query("DELETE FROM branches");

  const branches = [
    { id: uuidv4(), name: 'Makati Branch', address: 'Ayala Ave, Makati' },
    { id: uuidv4(), name: 'BGC Branch', address: 'High Street, Taguig' },
    { id: uuidv4(), name: 'QC Branch', address: 'Trinoma, Quezon City' },
    { id: uuidv4(), name: 'Manila Branch', address: 'Ermita, Manila' },
    { id: uuidv4(), name: 'Alabang Branch', address: 'Festival Mall, Muntinlupa' }
  ];

  for (const b of branches) {
    await pool.query("INSERT INTO branches (id, name, address) VALUES ($1, $2, $3)", [b.id, b.name, b.address]);
  }
  console.log("✅ Seeded 5 Branches");

  // USERS
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
    await pool.query("INSERT INTO users (id, name, role, pin, branch_id) VALUES ($1, $2, $3, $4, $5)", [u.id, u.name, u.role, u.pin, u.branchId]);
  }
  console.log("✅ Seeded 7 Users (1 Admin, 1 Manager, 5 Cashiers)");

  const categories = [
    { id: uuidv4(), name: "Breads", emoji: "🍞" },
    { id: uuidv4(), name: "Cakes", emoji: "🎂" },
    { id: uuidv4(), name: "Pastries", emoji: "🥐" },
    { id: uuidv4(), name: "Beverages", emoji: "🥤" }
  ];
  for (const c of categories) {
    await pool.query("INSERT INTO categories (id, name, emoji) VALUES ($1, $2, $3)", [c.id, c.name, c.emoji]);
  }
  console.log("✅ Seeded 4 Categories");

  const productData = [
    { name: "Classic Sourdough", cat: categories[0].id, p: 180, c: 90, e: "🍞" },
    { name: "French Baguette", cat: categories[0].id, p: 90, c: 40, e: "🥖" },
    { name: "Ube Pandesal (Pack of 10)", cat: categories[0].id, p: 120, c: 60, e: "🥯" },
    { name: "Premium White Loaf", cat: categories[0].id, p: 85, c: 40, e: "🥪" },
    { name: "Whole Wheat Bread", cat: categories[0].id, p: 110, c: 55, e: "🍞" },
    { name: "Red Velvet Cake (Whole)", cat: categories[1].id, p: 1200, c: 500, e: "🎂" },
    { name: "Chocolate Fudge Cake (Slice)", cat: categories[1].id, p: 150, c: 60, e: "🍰" },
    { name: "Strawberry Shortcake", cat: categories[1].id, p: 1100, c: 450, e: "🍓" },
    { name: "Basque Burnt Cheesecake", cat: categories[1].id, p: 950, c: 400, e: "🧀" },
    { name: "Carrot Walnut Cake", cat: categories[1].id, p: 850, c: 350, e: "🥕" },
    { name: "Butter Croissant", cat: categories[2].id, p: 95, c: 45, e: "🥐" },
    { name: "Pain au Chocolat", cat: categories[2].id, p: 120, c: 55, e: "🍫" },
    { name: "Cream Cheese Danishes", cat: categories[2].id, p: 110, c: 50, e: "🥮" },
    { name: "Cinnamon Roll", cat: categories[2].id, p: 85, c: 35, e: "🍥" },
    { name: "Blueberry Muffin", cat: categories[2].id, p: 75, c: 30, e: "🧁" },
    { name: "Iced Caramel Macchiato", cat: categories[3].id, p: 160, c: 60, e: "🥤" },
    { name: "Hot Spanish Latte", cat: categories[3].id, p: 140, c: 50, e: "☕" },
    { name: "Matcha Latte", cat: categories[3].id, p: 170, c: 65, e: "🍵" },
    { name: "Fresh Grapefruit Juice", cat: categories[3].id, p: 130, c: 50, e: "🍹" },
    { name: "Bottled Spring Water", cat: categories[3].id, p: 40, c: 15, e: "💧" }
  ];

  // We assign these 20 products uniquely across ALL branches so each branch has 20 products!
  let pCount = 0;
  for (const b of branches) {
    for (const p of productData) {
      await pool.query(
        "INSERT INTO products (id, branch_id, name, category_id, price, cost_price, stock, reorder_point, emoji) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)",
        [uuidv4(), b.id, p.name, p.cat, p.p, p.c, 50, 10, p.e]
      );
      pCount++;
    }
  }
  console.log(`✅ Seeded ${pCount} Products Total Across All Branches!`);
  
  console.log("Successfully seeded to Live Supabase Postgres!");
  pool.end();
}

seed().catch(console.error);
