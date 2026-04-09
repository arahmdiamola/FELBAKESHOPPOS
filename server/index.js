import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { initDb } from './db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' })); // High limit for base64 images

app.use((req, res, next) => {
  res.set('Cache-Control', 'no-store');
  next();
});

let db;

// Helper to append branch condition (strictly enforced by role)
const branchFilter = (req) => {
  const branchId = req.headers['x-branch-id'];
  const role = req.headers['x-user-role'];
  
  if (role === 'system_admin' && (!branchId || branchId === 'all')) {
    return "1=1"; // Global access only for system admins
  }
  if (!branchId || branchId === 'all') {
    return "branchId = 'UNASSIGNED_OR_LOCKED'"; // Lock out legacy/unassigned staff
  }
  return `branchId = '${branchId}'`;
};

// --- AUTH ---
app.post('/api/auth/login', async (req, res) => {
  const { id, pin } = req.body;
  try {
    const user = await db.get("SELECT * FROM users WHERE id = ? AND pin = ?", [id, pin]);
    if (user) {
      if (user.branchId) {
        const branch = await db.get("SELECT * FROM branches WHERE id = ?", [user.branchId]);
        user.branchName = branch?.name;
      }
      res.json(user);
    } else {
      res.status(401).json({ error: 'Invalid PIN' });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// --- BRANCHES ---
app.get('/api/branches', async (req, res) => {
  const branches = await db.all("SELECT * FROM branches");
  res.json(branches);
});

// --- USERS ---
app.get('/api/users', async (req, res) => {
  if (!req.headers['x-user-role'] || req.headers['x-user-role'] === 'system_admin') {
    const users = await db.all(`SELECT * FROM users`);
    return res.json(users);
  }
  const users = await db.all(`SELECT * FROM users WHERE ${branchFilter(req)}`);
  res.json(users);
});
app.post('/api/users', async (req, res) => {
  const { id, name, role, pin, branchId, image } = req.body;
  await db.run("INSERT INTO users (id, name, role, pin, branchId, image) VALUES (?, ?, ?, ?, ?, ?)", [id, name, role, pin, branchId, image]);
  res.json({ id });
});
app.put('/api/users/:id', async (req, res) => {
  const { name, role, branchId, image } = req.body;
  await db.run("UPDATE users SET name = ?, role = ?, branchId = ?, image = ? WHERE id = ?", [name, role, branchId, image, req.params.id]);
  res.json({ success: true });
});
app.put('/api/users/:id/pin', async (req, res) => {
  const { pin } = req.body;
  await db.run("UPDATE users SET pin = ? WHERE id = ?", [pin, req.params.id]);
  res.json({ success: true });
});
app.delete('/api/users/:id', async (req, res) => {
  await db.run("DELETE FROM users WHERE id = ?", [req.params.id]);
  res.json({ success: true });
});

// --- PRODUCTS & CATEGORIES ---
app.get('/api/categories', async (req, res) => {
  const categories = await db.all("SELECT * FROM categories");
  res.json(categories);
});
app.post('/api/categories', async (req, res) => {
  const { id, name, emoji } = req.body;
  await db.run("INSERT INTO categories (id, name, emoji) VALUES (?, ?, ?)", [id, name, emoji]);
  res.json({ success: true });
});

app.get('/api/products', async (req, res) => {
  const products = await db.all(`SELECT * FROM products WHERE ${branchFilter(req)}`);
  res.json(products);
});
app.post('/api/products', async (req, res) => {
  const { id, name, categoryId, price, costPrice, stock, unit, reorderPoint, emoji, image } = req.body;
  const branchId = req.headers['x-branch-id'] || req.body.branchId;
  await db.run(
    "INSERT INTO products (id, branchId, name, categoryId, price, costPrice, stock, unit, reorderPoint, emoji, image) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    [id, branchId, name, categoryId, price, costPrice, stock, unit, reorderPoint, emoji, image]
  );
  res.json({ success: true });
});
app.put('/api/products/:id', async (req, res) => {
  const p = req.body;
  await db.run(
    "UPDATE products SET name=?, categoryId=?, price=?, costPrice=?, stock=?, unit=?, reorderPoint=?, emoji=?, image=? WHERE id=?",
    [p.name, p.categoryId, p.price, p.costPrice, p.stock, p.unit, p.reorderPoint, p.emoji, p.image, req.params.id]
  );
  res.json({ success: true });
});
app.delete('/api/products/:id', async (req, res) => {
  await db.run("DELETE FROM products WHERE id = ?", [req.params.id]);
  res.json({ success: true });
});
app.post('/api/products/inventory', async (req, res) => {
  const items = req.body.items;
  const direction = req.body.direction; // 'deduct' or 'restore'
  for (const item of items) {
    if (direction === 'deduct') {
      await db.run("UPDATE products SET stock = MAX(0, stock - ?) WHERE id = ?", [item.quantity, item.productId]);
    } else {
      await db.run("UPDATE products SET stock = stock + ? WHERE id = ?", [item.quantity, item.productId]);
    }
  }
  res.json({ success: true });
});
app.put('/api/products/:id/adjust', async (req, res) => {
  const { quantity } = req.body;
  await db.run("UPDATE products SET stock = MAX(0, stock + ?) WHERE id = ?", [quantity, req.params.id]);
  res.json({ success: true });
});

// --- TRANSACTIONS ---
app.get('/api/transactions', async (req, res) => {
  const limit = req.query.limit ? `LIMIT ${req.query.limit}` : '';
  const txns = await db.all(`SELECT * FROM transactions WHERE ${branchFilter(req)} ORDER BY date DESC ${limit}`);
  for (const t of txns) {
    t.items = await db.all("SELECT * FROM transaction_items WHERE transactionId = ?", [t.id]);
  }
  res.json(txns);
});
app.post('/api/transactions', async (req, res) => {
  const t = req.body;
  const branchId = req.headers['x-branch-id'] || t.branchId;
  await db.run(
    "INSERT INTO transactions (id, branchId, receiptNumber, subtotal, discount, tax, total, paymentMethod, amountPaid, change, customerId, customerName, cashierId, cashierName, date, status, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    [t.id, branchId, t.receiptNumber, t.subtotal, t.discount, t.tax, t.total, t.paymentMethod, t.amountPaid, t.change, t.customerId, t.customerName, t.cashierId, t.cashierName, t.date, t.status, t.notes]
  );
  for (const i of t.items) {
    await db.run(
      "INSERT INTO transaction_items (id, transactionId, productId, name, price, quantity, unit, discount, total) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
      [i.id || uuidv4(), t.id, i.productId, i.name, i.price, i.quantity, i.unit, i.discount, i.total]
    );
  }
  res.json({ success: true });
});

// --- CUSTOMERS ---
app.get('/api/customers', async (req, res) => {
  const customers = await db.all(`SELECT * FROM customers WHERE ${branchFilter(req)}`);
  res.json(customers);
});
app.post('/api/customers', async (req, res) => {
  const c = req.body;
  const branchId = req.headers['x-branch-id'] || c.branchId;
  await db.run(
    "INSERT INTO customers (id, branchId, name, phone, email, address, totalSpent, visits, balance) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
    [c.id, branchId, c.name, c.phone, c.email, c.address, c.totalSpent || 0, c.visits || 0, c.balance || 0]
  );
  res.json({ success: true });
});
app.put('/api/customers/:id', async (req, res) => {
  const c = req.body;
  await db.run(
    "UPDATE customers SET name=?, phone=?, email=?, address=? WHERE id=?",
    [c.name, c.phone, c.email, c.address, req.params.id]
  );
  res.json({ success: true });
});
app.put('/api/customers/:id/balance', async (req, res) => {
  const { amount } = req.body;
  await db.run("UPDATE customers SET balance = balance + ? WHERE id = ?", [amount, req.params.id]);
  res.json({ success: true });
});
app.put('/api/customers/:id/visit', async (req, res) => {
  const { amount } = req.body;
  await db.run("UPDATE customers SET visits = visits + 1, totalSpent = totalSpent + ? WHERE id = ?", [amount, req.params.id]);
  res.json({ success: true });
});
app.delete('/api/customers/:id', async (req, res) => {
  await db.run("DELETE FROM customers WHERE id = ?", [req.params.id]);
  res.json({ success: true });
});

// --- EXPENSES ---
app.get('/api/expenses', async (req, res) => {
  const expenses = await db.all(`SELECT * FROM expenses WHERE ${branchFilter(req)} ORDER BY date DESC`);
  res.json(expenses);
});
app.post('/api/expenses', async (req, res) => {
  const e = req.body;
  const branchId = req.headers['x-branch-id'] || e.branchId;
  await db.run(
    "INSERT INTO expenses (id, branchId, category, description, amount, date, addedBy) VALUES (?, ?, ?, ?, ?, ?, ?)",
    [e.id, branchId, e.category, e.description, e.amount, e.date, e.addedBy]
  );
  res.json({ success: true });
});
app.delete('/api/expenses/:id', async (req, res) => {
  await db.run("DELETE FROM expenses WHERE id = ?", [req.params.id]);
  res.json({ success: true });
});

// --- PREORDERS ---
app.get('/api/preorders', async (req, res) => {
  const preorders = await db.all(`SELECT * FROM preorders WHERE ${branchFilter(req)}`);
  for (const p of preorders) {
    p.items = JSON.parse(p.items);
  }
  res.json(preorders);
});
app.post('/api/preorders', async (req, res) => {
  const p = req.body;
  const branchId = req.headers['x-branch-id'] || p.branchId;
  await db.run(
    "INSERT INTO preorders (id, branchId, customerName, customerPhone, items, totalPrice, deposit, status, dueDate, notes, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    [p.id, branchId, p.customerName, p.customerPhone, JSON.stringify(p.items), p.totalPrice, p.deposit, p.status, p.dueDate, p.notes, p.createdAt]
  );
  res.json({ success: true });
});
app.put('/api/preorders/:id', async (req, res) => {
  if (req.body.status) {
    await db.run("UPDATE preorders SET status = ? WHERE id = ?", [req.body.status, req.params.id]);
  }
  res.json({ success: true });
});
app.delete('/api/preorders/:id', async (req, res) => {
  await db.run("DELETE FROM preorders WHERE id = ?", [req.params.id]);
  res.json({ success: true });
});

// --- SETTINGS ---
app.get('/api/settings', async (req, res) => {
  const rows = await db.all("SELECT * FROM settings");
  const settings = {};
  rows.forEach(r => settings[r.key] = r.value);
  res.json(settings);
});
app.post('/api/settings', async (req, res) => {
  for (const [key, value] of Object.entries(req.body)) {
    await db.run("INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value", [key, value]);
  }
  res.json({ success: true });
});

app.post('/api/reset', async (req, res) => {
  await db.run("DELETE FROM transactions");
  await db.run("DELETE FROM transaction_items");
  await db.run("DELETE FROM products");
  await db.run("DELETE FROM customers");
  await db.run("DELETE FROM expenses");
  await db.run("DELETE FROM preorders");
  res.json({ success: true });
});

const PORT = process.env.PORT || 3001;

// Static Vite Frontend Serving for Production
const distPath = path.join(__dirname, '../dist');
app.use(express.static(distPath));

// Catch-all to support React Router natively
app.get('*', (req, res) => {
  res.sendFile(path.join(distPath, 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`API Server running on port ${PORT}`);
  
  // Initialize Database asynchronously after port bind
  initDb().then(database => {
    db = database;
    console.log("Database perfectly connected and synced!");
  }).catch(err => {
    console.error("CRITICAL DATABASE FAILURE:", err);
    process.exit(1); // Force process shutdown so Render logs the error immediately
  });
});
