import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import { v4 as uuidv4 } from 'uuid';

async function seed() {
  const db = await open({ filename: './server/bakery.db', driver: sqlite3.Database });
  const branches = await db.all('SELECT id, name FROM branches');
  
  console.log(`Found ${branches.length} branches. Seeding 500 products each...`);
  
  await db.exec("BEGIN TRANSACTION");
  let i = 1;
  const categories = ['cakes', 'breads', 'pastries', 'drinks'];
  const emojis = ['🥖', '🧁', '🍞', '🥤', '🍩', '🥐', '🍰', '🍪'];

  for (const branch of branches) {
    for (let j = 1; j <= 500; j++) {
       const catId = categories[Math.floor(Math.random() * categories.length)];
       const emoji = emojis[Math.floor(Math.random() * emojis.length)];
       const name = `Bulk Product ${j} - ${branch.name.split(' ')[0]}`;
       
       await db.run(
         "INSERT INTO products (id, branchId, name, categoryId, price, costPrice, stock, unit, reorderPoint, emoji, image) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
         [uuidv4(), branch.id, name, catId, Math.floor(Math.random() * 500) + 50, 50, 500, 'pcs', 10, emoji, null]
       );
    }
  }
  await db.exec("COMMIT");
  
  const count = await db.get("SELECT COUNT(*) as c FROM products");
  console.log(`Successfully seeded! Total products in database: ${count.c}`);
}

seed().catch(console.error);
