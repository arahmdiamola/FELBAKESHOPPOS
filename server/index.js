import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { v4 as uuidv4 } from 'uuid';
import { initDb } from './db.js';
import { isProduction } from './pg-adapter.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));

// --- Server Shield: Deployment Version Marker ---
console.log('--- BAKERY POS SERVER V1.1.9: TOTAL LIQUIDATION ACTIVE ---');

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
    
    // Log write with more descriptive failure catch
    await db.run(
      "INSERT INTO system_logs (id, timestamp, user_id, user_name, action, details, branch_id) VALUES (?, ?, ?, ?, ?, ?, ?)",
      [uuidv4(), new Date().toISOString(), userId, finalName, action, typeof details === 'object' ? JSON.stringify(details) : details, branchId]
    );
  } catch (e) {
    console.error(`[Logging Failed] Action: ${action} | Error: ${e.message}`);
  }
}

// --- DIAGNOSTIC: RAW BRANCH DATA ---
app.get('/api/diag/branches', async (req, res) => {
  try {
    const branches = await db.all("SELECT * FROM branches");
    const sessions = await db.all("SELECT * FROM branch_sessions");
    res.json({ branches, sessions, serverTime: new Date().toISOString() });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Helper to append branch condition (strictly enforced by role)
const getBranchFilter = (req) => {
  const branchId = req.headers['x-branch-id'];
  const role = req.headers['x-user-role'];

  if (['system_admin', 'owner'].includes(role) && (!branchId || branchId === 'all')) {
    return { query: "1=1", params: [] };
  }

  // Demo mode: Allow 'all' branches if explicitly requested and no role (public)
  if (branchId === 'all' && !role) {
    return { query: "1=1", params: [] };
  }

  if (!branchId || branchId === 'all') {
    // If a manager has no branch, allow them to see everything as well
    if (role === 'manager') return { query: "1=1", params: [] };
    // Otherwise, lock out unassigned staff
    return { query: "branch_id = ?", params: ['UNASSIGNED_OR_LOCKED'] };
  }

  return { query: "branch_id = ?", params: [branchId] };
};

// --- AUTH ---
app.post('/api/auth/login', async (req, res) => {
  const { id, pin } = req.body;
  try {
    const user = await db.get("SELECT * FROM users WHERE id = ? AND pin = ?", [id, pin]);
    if (user) {
      if (user.branch_id) {
        const branch = await db.get("SELECT * FROM branches WHERE id = ?", [user.branch_id]);
        user.branchName = branch?.name;
        
        // --- IMPLICIT LOGIN HEARTBEAT ---
        // INSTANT LOGIN: Force branch to 'Active' immediately on login
        const timestamp = new Date().toISOString();
        await db.run("UPDATE branches SET last_seen = ? WHERE id = ?", [timestamp, user.branch_id]);
        await db.run(
          "INSERT INTO branch_sessions (branch_id, user_id, last_seen) VALUES (?, ?, ?) ON CONFLICT (branch_id, user_id) DO UPDATE SET last_seen = EXCLUDED.last_seen", 
          [user.branch_id, user.id, timestamp]
        );
        
        // Update user session to ensure dashboard sees the specific active user
        await db.run("DELETE FROM branch_sessions WHERE branch_id = ? AND user_id = ?", [user.branch_id, user.id]);
        await db.run(
          "INSERT INTO branch_sessions (branch_id, user_id, last_seen) VALUES (?, ?, ?)",
          [user.branch_id, user.id, timestamp]
        );
      }
      
      // LOG LOGIN ACTION
      await logAction(req, 'LOGIN', { userId: user.id, name: user.name });
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
    const allSessions = await db.all("SELECT branch_id, last_seen FROM branch_sessions");
    
    const processed = branches.map(b => {
      // Find sessions using the most common ID property variations
      const branchId = b.id || b.ID;
      const branchSessions = allSessions.filter(s => (s.branch_id || s.branchId || s.branchid) === branchId);
      
      // MASTER UTC SYNC LOGIC (Case-Agnostic)
      // We look at EVERY possible casing for 'last_seen' to defeat DB redundancy.
      const nowMs = Date.now();
      
      const getBestDate = (obj) => {
        const potentialDates = [
          obj.last_seen, 
          obj.lastSeen, 
          obj.lastseen, 
          obj.updated_at,
          obj.updatedAt
        ].map(val => val ? new Date(val) : new Date(0))
         .filter(d => !isNaN(d.getTime()));
        
        return Math.max(0, ...potentialDates.map(d => d.getTime()));
      };

      const latestBranchMs = getBestDate(b);
      const latestSessionMs = Math.max(0, ...branchSessions.map(s => getBestDate(s)));
      
      const latestMs = Math.max(latestBranchMs, latestSessionMs);

      // 2-Minute Safety Window (Tightened from 5m for Dashboard Accuracy)
      const isOnline = (nowMs - latestMs) < 120000;
      
      return { 
        ...b, 
        isOnline, 
        sessionCount: branchSessions.length, 
        lastSeenSecondsAgo: latestMs > 0 ? Math.max(0, Math.floor((nowMs - latestMs) / 1000)) : null,
        rawLastSeen: b.lastSeen || b.last_seen || b.lastseen,
        serverTime: new Date(nowMs).toISOString()
      };
    });
    
    res.json(processed);
  } catch (error) {
    console.error('[Branches API Failure]', error);
    res.status(500).json({ error: 'Failed to fetch branches' });
  }
});

// High-speed Pulse signal receiver (Connectivity Heartbeat)
app.post('/api/branches/:id/pulse', async (req, res) => {
  const { userId } = req.body;
  const branchId = req.params.id;
  if (!branchId) return res.status(400).json({ error: 'Missing branch ID' });
    
  try {
    const timestamp = new Date().toISOString();
    
    // 1. Update master branch last_seen (Safe, Update doesn't throw if ID missing)
    await db.run("UPDATE branches SET last_seen = ? WHERE id = ?", [timestamp, branchId]);
    
    // 2. Update specific session with Resilient Strategy (Delete then Insert)
    // This avoids "ON CONFLICT" errors if the unique index migration failed.
    if (userId) {
       await db.transaction(async (tx) => {
         await tx.run("DELETE FROM branch_sessions WHERE branch_id = ? AND user_id = ?", [branchId, userId]);
         await tx.run(
           "INSERT INTO branch_sessions (branch_id, user_id, last_seen) VALUES (?, ?, ?)",
           [branchId, userId, timestamp]
         );
       });
    }
    
    res.json({ success: true, timestamp });
  } catch (error) {
    // Return 200 even if DB fails to stop console noise, but log for dev
    console.warn('[Pulse Failure Logged]', { error: error.message, branchId, userId });
    res.status(200).json({ success: false, error: 'Silenced DB error' });
  }
});

app.post('/api/branches/:id/disconnect', async (req, res) => {
  const { userId } = req.body;
  const branchId = req.params.id;
  try {
    if (userId) {
      // Clear specific user session
      await db.run("DELETE FROM branch_sessions WHERE branch_id = ? AND user_id = ?", [branchId, userId]);
      
      // Check if any other sessions remain for this branch
      const remaining = await db.get("SELECT COUNT(*) as count FROM branch_sessions WHERE branch_id = ?", [branchId]);
      if (remaining && remaining.count === 0) {
        // Only if NO sessions left, nuke the branch last_seen for instant dashboard feedback
        await db.run("UPDATE branches SET last_seen = NULL WHERE id = ?", [branchId]);
      }
    } else {
      // Force whole branch offline
      await db.run("DELETE FROM branch_sessions WHERE branch_id = ?", [branchId]);
      await db.run("UPDATE branches SET last_seen = NULL WHERE id = ?", [branchId]);
    }
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
    await db.run("UPDATE branches SET last_seen = ? WHERE id = ?", [timestamp, req.params.id]);
    res.json({ success: true, timestamp });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- USERS ---
app.get('/api/users', async (req, res) => {
  try {
    const userRole = req.headers['x-user-role'];
    if (!userRole || userRole === 'system_admin') {
      const allDbUsers = await db.all("SELECT * FROM users");
      return res.json(allDbUsers);
    }
    const { query, params } = getBranchFilter(req);
    const branchUsers = await db.all(`SELECT * FROM users WHERE ${query}`, params);
    res.json(branchUsers);
  } catch (err) {
    console.error('[GET /api/users Failure]', err);
    res.status(500).json({ error: err.message });
  }
});
app.post('/api/users', async (req, res) => {
  const { id, name, role, pin, branchId, image } = req.body;
  try {
    await db.run(
      "INSERT INTO users (id, name, role, pin, branch_id, image) VALUES (?, ?, ?, ?, ?, ?)",
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
      "UPDATE users SET name = ?, role = ?, branch_id = ?, image = ? WHERE id = ?",
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
  const { query, params } = getBranchFilter(req);
  const products = await db.all(`SELECT * FROM products WHERE ${query}`, params);
  res.json(products);
});
app.post('/api/products', async (req, res) => {
  const { id, name, categoryId, price, costPrice, stock, unit, reorderPoint, emoji, image, isTopSelling } = req.body;
  const branchId = req.headers['x-branch-id'] || req.body.branchId;
  await db.run(
    "INSERT INTO products (id, branch_id, name, category_id, price, cost_price, stock, unit, reorder_point, emoji, image, is_top_selling) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
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
        "INSERT INTO products (id, branch_id, name, category_id, price, cost_price, stock, unit, reorder_point, emoji, image, is_top_selling) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
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
      "UPDATE products SET name=?, price=?, cost_price=?, stock=?, category_id=?, unit=?, reorder_point=?, emoji=?, image=?, is_top_selling=? WHERE id=?",
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
      const sql = isProduction 
        ? "UPDATE products SET stock = GREATEST(0, stock - ?) WHERE id = ?"
        : "UPDATE products SET stock = MAX(0, stock - ?) WHERE id = ?";
      await db.run(sql, [item.quantity, item.productId]);
    } else {
      await db.run("UPDATE products SET stock = stock + ? WHERE id = ?", [item.quantity, item.productId]);
    }
  }
  res.json({ success: true });
});
app.put('/api/products/:id/adjust', async (req, res) => {
  const { quantity } = req.body;
  const sql = isProduction
    ? "UPDATE products SET stock = GREATEST(0, stock + ?) WHERE id = ?"
    : "UPDATE products SET stock = MAX(0, stock + ?) WHERE id = ?";
  await db.run(sql, [quantity, req.params.id]);
  res.json({ success: true });
});

// --- RAW MATERIALS ---
app.get('/api/raw-materials', async (req, res) => {
  const { query, params } = getBranchFilter(req);
  const materials = await db.all(`SELECT * FROM raw_materials WHERE ${query}`, params);
  res.json(materials);
});

app.post('/api/raw-materials', async (req, res) => {
  try {
    const { id, name, stock, unit, reorderPoint, emoji } = req.body;
    let branchId = req.headers['x-branch-id'] || req.body.branchId;
    
    // Explicit validation: Cannot insert into 'all' branch
    if (!branchId || branchId === 'all') {
      return res.status(400).json({ error: 'Valid Branch ID is required' });
    }

    await db.run(
      "INSERT INTO raw_materials (id, branch_id, name, stock, unit, reorder_point, emoji) VALUES (?, ?, ?, ?, ?, ?, ?)",
      [id, branchId, name, stock || 0, unit || 'kg', reorderPoint || 0, emoji || 'ðŸ“¦']
    );
    res.json({ success: true });
  } catch (err) {
    console.error('[POST /api/raw-materials] Error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/raw-materials/:id', async (req, res) => {
  const { name, stock, unit, reorderPoint, emoji } = req.body;
  await db.run(
    "UPDATE raw_materials SET name=?, stock=?, unit=?, reorder_point=?, emoji=? WHERE id=?",
    [name, stock, unit, reorderPoint, emoji, req.params.id]
  );
  res.json({ success: true });
});

app.delete('/api/raw-materials/:id', async (req, res) => {
  await db.run("DELETE FROM raw_materials WHERE id = ?", [req.params.id]);
  res.json({ success: true });
});

// --- PRODUCTION ---
app.get('/api/production/logs', async (req, res) => {
  const status = req.query.status;
  const { query, params } = getBranchFilter(req);
  let sql = `SELECT * FROM production_logs WHERE ${query}`;
  if (status) sql += ` AND status = '${status}'`;
  sql += ` ORDER BY date DESC LIMIT 100`;
  
  const logs = await db.all(sql, params);
  for (const log of logs) {
    log.items = await db.all("SELECT * FROM production_log_items WHERE production_log_id = ?", [log.id]);
  }
  res.json(logs);
});

app.post('/api/production/log', async (req, res) => {
  const { id, productId, productName, quantityProduced, estimatedYield, items, date, notes, status } = req.body;
  const branchId = req.headers['x-branch-id'];
  const userId = req.headers['x-user-id'];
  const userNameToken = req.headers['x-user-name'] || 'User';

  if (!branchId || branchId === 'all') {
    return res.status(400).json({ error: 'Valid Branch ID is required' });
  }

  const finalStatus = status || 'completed';

  try {
    await db.transaction(async (tx) => {
      // 1. Create Production Log
      await tx.run(
        "INSERT INTO production_logs (id, branch_id, user_id, user_name, product_id, product_name, quantity_produced, estimated_yield, date, notes, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        [id, branchId, userId, userNameToken, productId, productName, quantityProduced || 0, estimatedYield || 0, date, notes, finalStatus]
      );

      // 2. Add Finished Product stock (ONLY if completed immediately)
      if (finalStatus === 'completed' && productId && quantityProduced > 0) {
        await tx.run("UPDATE products SET stock = stock + ? WHERE id = ?", [quantityProduced, productId]);
      }

      // 3. Process Raw Materials usage
      if (Array.isArray(items)) {
        for (const item of items) {
          // Fetch current cost price to lock it in for audit
          const material = await tx.get("SELECT cost_price FROM raw_materials WHERE id = ?", [item.materialId]);
          const costPrice = material?.cost_price || 0;

          await tx.run(
            "INSERT INTO production_log_items (id, production_log_id, material_id, material_name, quantity_used, unit, cost_price) VALUES (?, ?, ?, ?, ?, ?, ?)",
            [uuidv4(), id, item.materialId, item.materialName, item.quantityUsed, item.unit, costPrice]
          );
          // ALWAYS Deduct from raw materials stock
          await tx.run("UPDATE raw_materials SET stock = stock - ? WHERE id = ?", [item.quantityUsed, item.materialId]);
        }
      }
    });
    
    // Audit Log
    if (finalStatus === 'completed') {
      await logAction(req, 'PRODUCTION_COMPLETED', { product: productName, quantity: quantityProduced });
    } else {
      await logAction(req, 'PRODUCTION_STARTED', { product: productName, estimated: estimatedYield });
    }

    res.json({ success: true });
  } catch (err) {
    console.error('[Production Log Failed]', err);
    // V1.1.6 Sensing: Return detailed error message if column missing
    res.status(500).json({ 
      error: `Production Log Error: ${err.message}`,
      detail: err.toString(),
      code: err.code
    });
  }
});

app.post('/api/production/finalize', async (req, res) => {
  const { logId, actualYield } = req.body;
  
  try {
    await db.transaction(async (tx) => {
      const log = await tx.get("SELECT * FROM production_logs WHERE id = ?", [logId]);
      if (!log) throw new Error('Production log not found');

      // 1. Update status and yield
      await tx.run(
        "UPDATE production_logs SET status = 'completed', quantity_produced = ? WHERE id = ?",
        [actualYield, logId]
      );

      // 2. Add to product stock
      if (log.productId) {
        await tx.run("UPDATE products SET stock = stock + ? WHERE id = ?", [actualYield, log.productId]);
      }
    });

    const finalLog = await db.get("SELECT product_name FROM production_logs WHERE id = ?", [logId]);
    await logAction(req, 'PRODUCTION_FINALIZED', { product: finalLog?.product_name, actual: actualYield });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/production/void', async (req, res) => {
  const { logId, reason } = req.body;
  
  try {
    await db.transaction(async (tx) => {
      const log = await tx.get("SELECT * FROM production_logs WHERE id = ?", [logId]);
      if (!log) throw new Error('Production log not found');

      // 1. Mark as ruined
      await tx.run("UPDATE production_logs SET status = 'ruined', notes = ? WHERE id = ?", [reason, logId]);

      // 2. Audit Log (Notification for Owner)
      await logAction(req, 'PRODUCTION_SPOILAGE', { 
        product: log.productName, 
        reason: reason || 'Not specified',
        lossType: 'VOIDED_BATCH'
      });
    });

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- TRANSACTIONS ---
app.get('/api/transactions', async (req, res) => {
  const limit = req.query.limit ? `LIMIT ${req.query.limit}` : '';
  const { query, params } = getBranchFilter(req);
  const txns = await db.all(`SELECT * FROM transactions WHERE ${query} ORDER BY date DESC ${limit}`, params);
  for (const t of txns) {
    t.items = await db.all("SELECT * FROM transaction_items WHERE transaction_id = ?", [t.id]);
  }
  res.json(txns);
});

app.get('/api/transactions/today', async (req, res) => {
  try {
    const { query, params } = getBranchFilter(req);
    // Use the explicit date from query if provided (for local time alignment), otherwise fallback to UTC today
    const dateStr = req.query.date || new Date().toISOString().split('T')[0];
    
    const txns = await db.all(
      `SELECT * FROM transactions WHERE ${query} AND date LIKE ? ORDER BY date DESC`,
      [...params, `${dateStr}%`]
    );
    res.json(txns);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
app.post('/api/transactions', async (req, res) => {
  const t = req.body;
  const branchId = req.headers['x-branch-id'] || t.branchId;
  
  if (!branchId || branchId === 'all') {
    return res.status(400).json({ error: 'Transaction must have a valid branchId' });
  }

  try {
    await db.transaction(async (tx) => {
      await tx.run(
        "INSERT INTO transactions (id, branch_id, receipt_number, subtotal, discount, tax, total, payment_method, amount_paid, \"change\", customer_id, customer_name, cashier_id, cashier_name, date, status, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        [t.id, branchId, t.receiptNumber, t.subtotal, t.discount, t.tax, t.total, t.paymentMethod, t.amountPaid, t.change, t.customerId, t.customerName, t.cashierId, t.cashierName, t.date, t.status, t.notes]
      );

      // Refresh last_seen on transaction (auto-heartbeat)
      await tx.run("UPDATE branches SET last_seen = ? WHERE id = ?", [new Date().toISOString(), branchId]);

      for (const i of t.items) {
        await tx.run(
          "INSERT INTO transaction_items (id, transaction_id, product_id, name, price, quantity, unit, discount, total) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
          [i.id || uuidv4(), t.id, i.productId, i.name, i.price, i.quantity, i.unit, i.discount, i.total]
        );
      }
    });
    
    await logAction(req, 'SALE_COMPLETED', { receiptNumber: t.receiptNumber, total: t.total });
    res.json({ success: true });
  } catch (error) {
    console.error('[Transaction Sync Error]', error);
    res.status(500).json({ error: error.message });
  }
});

// --- CUSTOMERS ---
app.get('/api/customers', async (req, res) => {
  const { query, params } = getBranchFilter(req);
  const customers = await db.all(`SELECT * FROM customers WHERE ${query}`, params);
  res.json(customers);
});
app.post('/api/customers', async (req, res) => {
  try {
    const c = req.body;
    const branchId = req.headers['x-branch-id'] || c.branchId;
    await db.run(
      "INSERT INTO customers (id, branch_id, name, phone, email, address, total_spent, visits, balance) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
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
  await db.run("UPDATE customers SET visits = visits + 1, total_spent = total_spent + ? WHERE id = ?", [amount, req.params.id]);
  res.json({ success: true });
});
app.delete('/api/customers/:id', async (req, res) => {
  await db.run("DELETE FROM customers WHERE id = ?", [req.params.id]);
  res.json({ success: true });
});

// --- EXPENSES ---
app.get('/api/expenses', async (req, res) => {
  const { query, params } = getBranchFilter(req);
  const expenses = await db.all(`SELECT * FROM expenses WHERE ${query} ORDER BY date DESC`, params);
  res.json(expenses);
});
app.post('/api/expenses', async (req, res) => {
  const e = req.body;
  const branchId = req.headers['x-branch-id'] || e.branchId;
    await db.run(
      "INSERT INTO expenses (id, branch_id, category, description, amount, date, added_by) VALUES (?, ?, ?, ?, ?, ?, ?)",
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
  const { query, params } = getBranchFilter(req);
  const preorders = await db.all(`SELECT * FROM preorders WHERE ${query}`, params);
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
      "INSERT INTO preorders (id, branch_id, customer_name, customer_phone, items, total_price, deposit, status, due_date, notes, quantity, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      [p.id, branchId, p.customerName, p.customerPhone, JSON.stringify(p.items), p.totalPrice, p.deposit, p.status, p.dueDate, p.notes, p.quantity || 1, p.createdAt]
    );

    await logAction(req, 'PREORDER_CREATED', { customer: p.customerName, total: p.totalPrice });
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
      await db.run("DELETE FROM transaction_items");
      await db.run("DELETE FROM transactions");
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

    // 2. Wipe ALL Tables in strict dependency order (Postgres compatible)
    const tables = [
      'production_log_items',
      'production_logs',
      'transaction_items',
      'transactions',
      'branch_sessions',
      'raw_materials',
      'preorders',
      'expenses',
      'customers',
      'users',
      'products',
      'categories',
      'branches',
      'settings'
    ];
    
    for (const table of tables) {
      await db.run(`DELETE FROM ${table}`).catch(() => {}); 
    }

    // 3. Re-populate Tables in correct dependency order
    const tableOrder = [
      { name: 'branches', data: backup.branches, cols: ['id', 'name', 'address', 'last_seen'] },
      { name: 'users', data: backup.users, cols: ['id', 'name', 'role', 'pin', 'branch_id', 'image'] },
      { name: 'categories', data: backup.categories, cols: ['id', 'name', 'emoji'] },
      { name: 'products', data: backup.products, cols: ['id', 'branch_id', 'name', 'category_id', 'price', 'cost_price', 'stock', 'unit', 'reorder_point', 'emoji', 'image', 'is_top_selling'] },
      { name: 'raw_materials', data: backup.raw_materials || [], cols: ['id', 'branch_id', 'name', 'stock', 'unit', 'reorder_point', 'emoji', 'cost_price'] },
      { name: 'customers', data: backup.customers, cols: ['id', 'branch_id', 'name', 'phone', 'email', 'address', 'total_spent', 'visits', 'balance'] },
      { name: 'transactions', data: backup.transactions, cols: ['id', 'branch_id', 'receipt_number', 'subtotal', 'discount', 'tax', 'total', 'payment_method', 'amount_paid', 'change', 'customer_id', 'customer_name', 'cashier_id', 'cashier_name', 'date', 'status', 'notes'] },
      { name: 'transaction_items', data: backup.transaction_items, cols: ['id', 'transaction_id', 'product_id', 'name', 'price', 'quantity', 'unit', 'discount', 'total'] },
      { name: 'expenses', data: backup.expenses, cols: ['id', 'branch_id', 'category', 'description', 'amount', 'date', 'added_by'] },
      { name: 'preorders', data: backup.preorders, cols: ['id', 'branch_id', 'customer_name', 'customer_phone', 'items', 'total_price', 'deposit', 'status', 'due_date', 'notes', 'quantity', 'created_at'] },
      { name: 'production_logs', data: backup.production_logs || [], cols: ['id', 'branch_id', 'user_id', 'user_name', 'product_id', 'product_name', 'quantity_produced', 'status', 'date', 'notes', 'estimated_yield', 'unit'] },
      { name: 'production_log_items', data: backup.production_log_items || [], cols: ['id', 'production_log_id', 'material_id', 'material_name', 'quantity_used', 'unit', 'cost_price'] },
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
    const limit = parseInt(req.query.limit) || 100;
    const branchId = req.headers['x-branch-id'];
    const userRole = (req.headers['x-user-role'] || '').toLowerCase();

    let logs;
    const isAdmin = userRole === 'system_admin' || userRole === 'owner';
    
    const query = `
      SELECT l.*, b.name as branch_name 
      FROM system_logs l 
      LEFT JOIN branches b ON l.branch_id = b.id 
      ${isAdmin ? '' : 'WHERE l.branch_id = ?'} 
      ORDER BY l.timestamp DESC LIMIT ?
    `;

    if (isAdmin) {
      logs = await db.all(query, [limit]);
    } else {
      logs = await db.all(query, [branchId, limit]);
    }
    res.json(logs || []);
  } catch (err) {
    console.error('[GET /api/logs Error]', err);
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

// Global Error Handler for API (prevents HTML fallbacks)
app.use('/api', (err, req, res, next) => {
  console.error('[API Error Interceptor]', err);
  res.status(500).json({ 
    error: 'Internal Server Error',
    message: err.message,
    path: req.path
  });
});

// Catch-all to support React Router natively
app.use((req, res) => {
  res.sendFile(path.join(distPath, 'index.html'));
});

// --- STARTUP SEQUENCE ---
// To prevent Render health check timeouts, we start listening IMMEDIATELY
// and initialize the database in parallel.
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 API Server pre-listening on port ${PORT}. Awaiting database...`);
    
    initDb().then(database => {
        db = database;
        console.log("✅ Database fully initialized and synced!");
    }).catch(err => {
        console.error("❌ FATAL: Database initialization failed:", err);
        // Important: Still crash if DB fails so Render restarts the service
        process.exit(1);
    });
});
