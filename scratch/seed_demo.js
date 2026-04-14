import { pgAdapter } from '../server/pg-adapter.js';
import { v4 as uuidv4 } from 'uuid';

async function seedDemo() {
  try {
    console.log("🚀 Starting Clean Demo Seed...");

    // 1. Fetch existing entities
    const branches = await pgAdapter.all("SELECT id, name FROM branches");
    const allProducts = await pgAdapter.all("SELECT id, name, price, branch_id, unit FROM products");
    const users = await pgAdapter.all("SELECT id, name, branch_id FROM users");

    const today = new Date().toISOString().split('T')[0]; // "2026-04-15"
    const paymentMethods = ['Cash', 'GCash', 'Maya'];

    await pgAdapter.transaction(async (tx) => {
      // 2. CLEAR PREVIOUS SEED DATA FOR TODAY
      console.log("🧹 Clearing previous transactions for today...");
      await tx.run("DELETE FROM transaction_items WHERE transaction_id IN (SELECT id FROM transactions WHERE date LIKE ?)", [`${today}%`]);
      await tx.run("DELETE FROM transactions WHERE date LIKE ?", [`${today}%`]);

      for (const branch of branches) {
        console.log(`📡 Seeding Branch: ${branch.name}...`);
        
        let branchTotal = 0;
        const targetSales = 75000 + Math.random() * 20000; // Aim for 75K - 95K
        
        // Filter products for this branch and exclude crazy outliers (like 50k Pandesal)
        const branchProducts = allProducts.filter(p => p.branchId === branch.id && p.price < 2000);
        const branchUser = users.find(u => u.branchId === branch.id) || users[0];

        if (branchProducts.length === 0) {
          console.warn(`⚠️ No suitable products for branch ${branch.name}, skipping.`);
          continue;
        }

        let orderCount = 0;
        while (branchTotal < targetSales) {
          const orderId = uuidv4();
          const pMethod = paymentMethods[Math.floor(Math.random() * paymentMethods.length)];
          const receiptNo = `RCPT-${Math.floor(Math.random() * 900000) + 100000}`;
          
          // Random time today (08:00 to 23:00)
          const hour = 8 + Math.floor(Math.random() * 15);
          const minute = Math.floor(Math.random() * 60);
          const orderTime = `${today}T${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}:00.000Z`;

          // Generate 1-5 random items
          let orderItems = [];
          const itemCount = 1 + Math.floor(Math.random() * 4);
          let orderSubtotal = 0;

          for (let i = 0; i < itemCount; i++) {
            const prod = branchProducts[Math.floor(Math.random() * branchProducts.length)];
            const qty = 1 + Math.floor(Math.random() * 2);
            const itemTotal = prod.price * qty;

            // STRICTOR CAP: Don't let a single order push us over 100K
            if (branchTotal + orderSubtotal + itemTotal + (orderSubtotal + itemTotal) * 0.12 > 100000) {
              continue;
            }

            orderItems.push({
              id: uuidv4(),
              transaction_id: orderId,
              product_id: prod.id,
              name: prod.name,
              price: prod.price,
              quantity: qty,
              unit: prod.unit || 'pc',
              total: itemTotal
            });
            orderSubtotal += itemTotal;
          }

          if (orderItems.length === 0) break; // Can't add more without hitting cap

          const tax = orderSubtotal * 0.12; // 12% VAT
          const orderTotal = orderSubtotal + tax;

          branchTotal += orderTotal;
          orderCount++;

          // Insert Transaction
          await tx.run(`
            INSERT INTO transactions (
              id, branch_id, receipt_number, subtotal, discount, tax, total, 
              payment_method, amount_paid, "change", cashier_id, cashier_name, date, status
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `, [
            orderId, branch.id, receiptNo, orderSubtotal, 0, tax, orderTotal,
            pMethod, orderTotal, 0, branchUser?.id || null, branchUser?.name || 'Cashier', orderTime, 'completed'
          ]);

          // Insert Items
          for (const item of orderItems) {
            await tx.run(`
              INSERT INTO transaction_items (
                id, transaction_id, product_id, name, price, quantity, unit, total
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            `, [
              item.id, orderId, item.product_id, item.name, item.price, item.quantity, item.unit, item.total
            ]);
          }
        }

        console.log(`✅ Branch ${branch.name} seeded with ${orderCount} transactions. Total Sales: ₱${branchTotal.toLocaleString()}`);
      }
    });

    console.log("✨ Demo Seeding Completed Successfully!");
  } catch (err) {
    console.error("❌ Seeding Failed:", err);
  } finally {
    process.exit(0);
  }
}

seedDemo();
