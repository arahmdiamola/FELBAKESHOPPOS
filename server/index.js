import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { v4 as uuidv4 } from 'uuid';
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

// 1. Ensure DB Readiness
app.use('/api', (req, res, next) => {
  if (!db) {
    return res.status(503).json({ error: 'Server is starting up... Database not yet ready.' });
  }
  next();
});

let db;

// --- AUDIT LOG HELPER ---
async function logAction(req, action, details = null) {
  try {
    const userId = req.headers['x-user-id'] || 'system';
    const userNameToken = req.headers['x-user-name'] || 'System';
    
    // Fetch name if not in headers
    let finalName = userNameToken;
    if (userId !== 'system' && userNameToken === 'System') {
      const user = await db.get("SELECT name FROM users WHERE id = ?", [userId]);
      if (user) finalName = user.name;
    }

    const branchId = req.headers['x-branch-id'] || null;
    await db.run(
      "INSERT INTO system_logs (id, timestamp, userId, userName, action, details, branchId) VALUES (?, ?, ?, ?, ?, ?, ?)",
      [uuidv4(), new Date().toISOString(), userId, finalName, action, typeof details === 'object' ? JSON.stringify(details) : details, branchId]
    );
  } catch (e) {
    console.error('[Logging Failed]', e);
  }
}

// Helper to append branch condition (strictly enforced by role)
const branchFilter = (req) => {
  const branchId = req.headers['x-branch-id'];
  const role = req.headers['x-user-role'];

  // Global access check (System Admins and Owners see everything if no filter)
  if (['system_admin', 'owner'].includes(role) && (!branchId || branchId === 'all')) {
    return "1=1";
  }

  if (!branchId || branchId === 'all') {
    // If a manager has no branch, allow them to see everything as well
    if (role === 'manager') return "1=1";
    // Otherwise, lock out unassigned staff
    return "branchId = 'UNASSIGNED_OR_LOCKED'";
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
const requireSystemAdmin = (req, res, next) => {
  if (req.headers['x-user-role'] !== 'system_admin') {
    return res.status(403).json({ error: 'Only System Admins can perform this action' });
  }
  next();
};

app.get('/api/branches', async (req, res) => {
  try {
    const branches = await db.all("SELECT * FROM branches");
    const now = new Date();
    
    // Server-side Online Detection (immune to client clock drift)
    const processed = branches.map(b => {
      // Handle both camelCase and lowercase versions from different DB adapters
      const rawLastSeen = b.lastSeen || b.lastseen;
      const lastSeenDate = rawLastSeen ? new Date(rawLastSeen) : null;
      
      let isOnline = false;
      let lastSeenSecondsAgo = null;

      if (lastSeenDate) {
        const diffMs = Math.abs(now - lastSeenDate);
        isOnline = diffMs < 120000; // 2 mins threshold (high responsiveness for TV)
        lastSeenSecondsAgo = Math.floor(diffMs / 1000);
      }
      
      return { ...b, isOnline, lastSeenSecondsAgo };
    });
    
    res.json(processed);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// High-speed Pulse signal receiver (Connectivity Heartbeat)
app.post('/api/branches/:id/pulse', async (req, res) => {
  try {
    const timestamp = new Date().toISOString();
    await db.run("UPDATE branches SET lastSeen = ? WHERE id = ?", [timestamp, req.params.id]);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
app.post('/api/branches/:id/disconnect', async (req, res) => {
  try {
    await db.run("UPDATE branches SET lastSeen = NULL WHERE id = ?", [req.params.id]);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/branches', requireSystemAdmin, async (req, res) => {
  const { name, address } = req.body;
  const id = uuidv4();
  try {
    await db.run("INSERT INTO branches (id, name, address) VALUES ($1, $2, $3)", [id, name, address]);
    res.json({ id, name, address });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/branches/:id', requireSystemAdmin, async (req, res) => {
  const { name, address } = req.body;
  try {
    await db.run("UPDATE branches SET name = $1, address = $2 WHERE id = $3", [name, address, req.params.id]);
    res.json({ id: req.params.id, name, address });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/branches/:id', requireSystemAdmin, async (req, res) => {
  try {
    await db.run("DELETE FROM branches WHERE id = $1", [req.params.id]);
    res.json({ success: true });
  } catch (error) {
    // Postgres Foreign Key Constraint Violation is standard code '23503' length or sqlite constraint
    if (error.message.includes('constraint') || error.code === '23503') {
      res.status(409).json({ error: 'Cannot delete branch because it currently has users, customers, or products strictly assigned to it. You must reassign or clear them first.' });
    } else {
      res.status(500).json({ error: error.message });
    }
  }
});

app.post('/api/branches/:id/heartbeat', async (req, res) => {
  try {
    const timestamp = new Date().toISOString();
    await db.run("UPDATE branches SET lastSeen = ? WHERE id = ?", [timestamp, req.params.id]);
    res.json({ success: true, timestamp });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
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
  try {
    await db.run(
      "INSERT INTO users (id, name, role, pin, branchId, image) VALUES (?, ?, ?, ?, ?, ?)",
      [id, name, role, pin, branchId || null, image]
    );
    res.json({ id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
app.put('/api/users/:id', async (req, res) => {
  const { name, role, branchId, image } = req.body;
  try {
    await db.run(
      "UPDATE users SET name = ?, role = ?, branchId = ?, image = ? WHERE id = ?",
      [name, role, branchId || null, image, req.params.id]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
app.put('/api/users/:id/pin', async (req, res) => {
  const { pin } = req.body;
  try {
    await db.run("UPDATE users SET pin = ? WHERE id = ?", [pin, req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
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
  const { id, name, categoryId, price, costPrice, stock, unit, reorderPoint, emoji, image, isTopSelling } = req.body;
  const branchId = req.headers['x-branch-id'] || req.body.branchId;
  await db.run(
    "INSERT INTO products (id, branchId, name, categoryId, price, costPrice, stock, unit, reorderPoint, emoji, image, isTopSelling) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    [id, branchId, name, categoryId, price, costPrice, stock, unit, reorderPoint, emoji, image, isTopSelling || 0]
  );
  res.json({ success: true });
});
app.post('/api/products/batch', async (req, res) => {
  const { products } = req.body;
  const branchId = req.headers['x-branch-id'];

  if (!products || !Array.isArray(products)) {
    return res.status(400).json({ error: 'Invalid batch format' });
  }

  try {
    for (const p of products) {
      await db.run(
        "INSERT INTO products (id, branchId, name, categoryId, price, costPrice, stock, unit, reorderPoint, emoji, image, isTopSelling) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        [p.id, branchId, p.name, p.categoryId, p.price, p.costPrice, p.stock, p.unit, p.reorderPoint, p.emoji, p.image || null, p.isTopSelling || 0]
      );
    }
    res.json({ success: true, count: products.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
app.put('/api/products/:id', async (req, res) => {
    const updates = req.body;
    await db.run(
      "UPDATE products SET name=?, price=?, costPrice=?, stock=?, categoryId=?, unit=?, reorderPoint=?, emoji=?, image=?, isTopSelling=? WHERE id=?",
      [updates.name, updates.price, updates.costPrice, updates.stock, updates.categoryId, updates.unit, updates.reorderPoint, updates.emoji, updates.image, updates.isTopSelling, req.params.id]
    );
    
    await logAction(req, 'PRODUCT_UPDATED', { productId: req.params.id, name: updates.name, stock: updates.stock });
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
      await db.run("UPDATE products SET stock = GREATEST(0, stock - ?) WHERE id = ?", [item.quantity, item.productId]);
    } else {
      await db.run("UPDATE products SET stock = stock + ? WHERE id = ?", [item.quantity, item.productId]);
    }
  }
  res.json({ success: true });
});
app.put('/api/products/:id/adjust', async (req, res) => {
  const { quantity } = req.body;
  await db.run("UPDATE products SET stock = GREATEST(0, stock + ?) WHERE id = ?", [quantity, req.params.id]);
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
  
  if (!branchId || branchId === 'all') {
    return res.status(400).json({ error: 'Transaction must have a valid branchId' });
  }

  try {
    await db.run(
      "INSERT INTO transactions (id, branchId, receiptNumber, subtotal, discount, tax, total, paymentMethod, amountPaid, change, customerId, customerName, cashierId, cashierName, date, status, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      [t.id, branchId, t.receiptNumber, t.subtotal, t.discount, t.tax, t.total, t.paymentMethod, t.amountPaid, t.change, t.customerId, t.customerName, t.cashierId, t.cashierName, t.date, t.status, t.notes]
    );

    // Refresh lastSeen on transaction (auto-heartbeat)
    await db.run("UPDATE branches SET lastSeen = ? WHERE id = ?", [new Date().toISOString(), branchId]);

    for (const i of t.items) {
      await db.run(
        "INSERT INTO transaction_items (id, transactionId, productId, name, price, quantity, unit, discount, total) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
        [i.id || uuidv4(), t.id, i.productId, i.name, i.price, i.quantity, i.unit, i.discount, i.total]
      );
    }
    
    await logAction(req, 'SALE_COMPLETED', { receiptNumber: t.receiptNumber, total: t.total });
    res.json({ success: true });
  } catch (error) {
    console.error('[Transaction Sync Error]', error);
    res.status(500).json({ error: error.message });
  }
});

// --- CUSTOMERS ---
app.get('/api/customers', async (req, res) => {
  const customers = await db.all(`SELECT * FROM customers WHERE ${branchFilter(req)}`);
  res.json(customers);
});
app.post('/api/customers', async (req, res) => {
  try {
    const c = req.body;
    const branchId = req.headers['x-branch-id'] || c.branchId;
    await db.run(
      "INSERT INTO customers (id, branchId, name, phone, email, address, totalSpent, visits, balance) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
      [c.id, branchId, c.name, c.phone, c.email, c.address, c.totalSpent || 0, c.visits || 0, c.balance || 0]
    );
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
app.put('/api/customers/:id', async (req, res) => {
  try {
    const c = req.body;
    await db.run(
      "UPDATE customers SET name=?, phone=?, email=?, address=? WHERE id=?",
      [c.name, c.phone, c.email, c.address, req.params.id]
    );
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
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
      [uuidv4(), branchId, e.category, e.description, e.amount, e.date, e.addedBy]
    );
    
    await logAction(req, 'EXPENSE_RECORDED', { category: e.category, amount: e.amount });
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
app.get('/api/preorders/:id', async (req, res) => {
  try {
    const preorder = await db.get("SELECT * FROM preorders WHERE id = ?", [req.params.id]);
    if (!preorder) return res.status(404).json({ error: 'Preorder not found' });
    preorder.items = JSON.parse(preorder.items);
    res.json(preorder);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
app.post('/api/preorders', async (req, res) => {
  try {
    const p = req.body;
    const branchId = req.headers['x-branch-id'] || p.branchId;
    if (!branchId || branchId === 'all') {
      return res.status(400).json({ error: 'Preorder must have a valid branchId' });
    }
    await db.run(
      "INSERT INTO preorders (id, branchId, customerName, customerPhone, items, totalPrice, deposit, status, dueDate, notes, quantity, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      [p.id, branchId, p.customerName, p.customerPhone, JSON.stringify(p.items), p.totalPrice, p.deposit, p.status, p.dueDate, p.notes, p.quantity || 1, p.createdAt]
    );
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
app.put('/api/preorders/:id', async (req, res) => {
  try {
    if (req.body.status) {
      await db.run("UPDATE preorders SET status = ? WHERE id = ?", [req.body.status, req.params.id]);
    }
    res.json({ success: true });
  } catch (error) {
    console.error('[Preorder Detail Error]', error);
    res.status(500).json({ error: error.message });
  }
});
app.delete('/api/preorders/:id', async (req, res) => {
  try {
    await db.run("DELETE FROM preorders WHERE id = ?", [req.params.id]);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// --- SETTINGS ---
app.get('/api/settings', async (req, res) => {
  const rows = await db.all("SELECT * FROM settings");
  const settings = {};
  rows.forEach(r => settings[r.key] = r.value);
  res.json(settings);
});
app.post('/api/settings', async (req, res) => {
    const entries = Object.entries(req.body);
    for (const [key, value] of entries) {
      await db.run("INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value", [key, value]);
    }
    
    await logAction(req, 'SETTINGS_UPDATED', { updatedKeys: entries.map(e => e[0]) });
    res.json({ success: true });
});

app.post('/api/reset', requireSystemAdmin, async (req, res) => {
  const { targets } = req.body;
  
  try {
    if (!targets || !Array.isArray(targets) || targets.length === 0) {
      return res.status(400).json({ error: 'No reset categories selected' });
    }

    if (targets.includes('transactions')) {
      await db.run("DELETE FROM transactions");
      await db.run("DELETE FROM transaction_items");
      console.log("[Reset] Wiped Transactions");
    }
    
    if (targets.includes('products')) {
      await db.run("DELETE FROM products");
      await db.run("DELETE FROM categories");
      console.log("[Reset] Wiped Inventory & Categories");
    }
    
    if (targets.includes('customers')) {
      await db.run("DELETE FROM customers");
      console.log("[Reset] Wiped Customers");
    }
    
    if (targets.includes('expenses')) {
      await db.run("DELETE FROM expenses");
      console.log("[Reset] Wiped Expenses");
    }
    
    if (targets.includes('preorders')) {
      await db.run("DELETE FROM preorders");
      console.log("[Reset] Wiped Pre-orders");
    }

    // Special: Clear system sync state if everything is wiped
    if (targets.length >= 5) {
       await db.run("DELETE FROM settings WHERE key LIKE 'sync_%'");
    }

    res.json({ success: true, message: `Successfully wiped: ${targets.join(', ')}` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/restore', async (req, res) => {
  const backup = req.body;
  
  if (!backup || !backup.timestamp) {
    return res.status(400).json({ error: 'Invalid backup format' });
  }

  try {
    // 1. DANGER ZONE: Start Transaction
    await db.exec("BEGIN TRANSACTION");

    // 2. Wipe ALL Tables in reverse dependency order
    const tables = ['settings', 'preorders', 'expenses', 'transaction_items', 'transactions', 'customers', 'products', 'categories', 'users', 'branches'];
    for (const table of tables) {
      await db.run(`DELETE FROM ${table}`);
    }

    // 3. Re-populate Tables in correct dependency order
    const tableOrder = [
      { name: 'branches', data: backup.branches, cols: ['id', 'name', 'address'] },
      { name: 'users', data: backup.users, cols: ['id', 'name', 'role', 'pin', 'branchId', 'image'] },
      { name: 'categories', data: backup.categories, cols: ['id', 'name', 'emoji'] },
      { name: 'products', data: backup.products, cols: ['id', 'branchId', 'name', 'categoryId', 'price', 'costPrice', 'stock', 'unit', 'reorderPoint', 'emoji', 'image', 'isTopSelling'] },
      { name: 'customers', data: backup.customers, cols: ['id', 'branchId', 'name', 'phone', 'email', 'address', 'totalSpent', 'visits', 'balance'] },
      { name: 'transactions', data: backup.transactions, cols: ['id', 'branchId', 'receiptNumber', 'subtotal', 'discount', 'tax', 'total', 'paymentMethod', 'amountPaid', 'change', 'customerId', 'customerName', 'cashierId', 'cashierName', 'date', 'status', 'notes'] },
      { name: 'transaction_items', data: backup.transaction_items, cols: ['id', 'transactionId', 'productId', 'name', 'price', 'quantity', 'unit', 'discount', 'total'] },
      { name: 'expenses', data: backup.expenses, cols: ['id', 'branchId', 'category', 'description', 'amount', 'date', 'addedBy'] },
      { name: 'preorders', data: backup.preorders, cols: ['id', 'branchId', 'customerName', 'customerPhone', 'items', 'totalPrice', 'deposit', 'status', 'dueDate', 'notes', 'quantity', 'createdAt'] },
      { name: 'settings', data: backup.settings, cols: ['key', 'value'] }
    ];

    for (const t of tableOrder) {
      if (!t.data || !Array.isArray(t.data)) continue;
      for (const row of t.data) {
        const placeholders = t.cols.map(() => '?').join(', ');
        const values = t.cols.map(c => {
          const val = row[c];
          // Handle JSON fields (specifically items in preorders)
          if (t.name === 'preorders' && c === 'items' && typeof val === 'object') {
            return JSON.stringify(val);
          }
          return val;
        });
        await db.run(`INSERT INTO ${t.name} (${t.cols.join(', ')}) VALUES (${placeholders})`, values);
      }
    }

    await db.exec("COMMIT");
    
    await logAction(req, 'SYSTEM_RESTORE', { backupTimestamp: backup.timestamp });
    res.json({ success: true, message: 'System restored successfully' });
  } catch (err) {
    await db.exec("ROLLBACK");
    console.error('[Restore Failed]', err);
    res.status(500).json({ error: `Restore failed: ${err.message}` });
  }
});

app.get('/api/logs', async (req, res) => {
  try {
    const limit = req.query.limit || 100;
    const branchId = req.headers['x-branch-id'];
    const userRole = req.headers['x-user-role'];

    let logs;
    if (userRole === 'system_admin') {
      logs = await db.all("SELECT * FROM system_logs ORDER BY timestamp DESC LIMIT ?", [limit]);
    } else {
      // Owners/Managers see their branch logs only
      logs = await db.all("SELECT * FROM system_logs WHERE branchId = ? ORDER BY timestamp DESC LIMIT ?", [branchId, limit]);
    }
    res.json(logs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/backup-full', async (req, res) => {
  try {
    const backup = {
      timestamp: new Date().toISOString(),
      branches: await db.all("SELECT * FROM branches"),
      users: await db.all("SELECT * FROM users"),
      categories: await db.all("SELECT * FROM categories"),
      products: await db.all("SELECT * FROM products"),
      transactions: await db.all("SELECT * FROM transactions"),
      transaction_items: await db.all("SELECT * FROM transaction_items"),
      customers: await db.all("SELECT * FROM customers"),
      expenses: await db.all("SELECT * FROM expenses"),
      preorders: await db.all("SELECT * FROM preorders"),
      settings: await db.all("SELECT * FROM settings"),
    };
    
    // Set headers to force download as JSON file
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="fel-pos-backup-${new Date().toISOString().slice(0,10)}.json"`);
    res.send(JSON.stringify(backup, null, 2));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 3001;

// Static Vite Frontend Serving for Production
const distPath = path.join(__dirname, '../dist');
app.use(express.static(distPath));

// 404 for API
app.use('/api', (req, res) => {
  res.status(404).json({ error: `API Route not found: ${req.method} ${req.originalUrl}` });
});

// Catch-all to support React Router natively
app.use((req, res) => {
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
