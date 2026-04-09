import { v4 as uuidv4 } from 'uuid';

// ── Category IDs ──
const CAT_BREAD = uuidv4();
const CAT_PASTRY = uuidv4();
const CAT_CAKE = uuidv4();
const CAT_COOKIE = uuidv4();
const CAT_BEVERAGE = uuidv4();
const CAT_KAKANIN = uuidv4();
const CAT_SPECIAL = uuidv4();

export const SEED_CATEGORIES = [
  { id: CAT_BREAD, name: 'Breads', emoji: '🍞' },
  { id: CAT_PASTRY, name: 'Pastries', emoji: '🥐' },
  { id: CAT_CAKE, name: 'Cakes', emoji: '🎂' },
  { id: CAT_COOKIE, name: 'Cookies & Bars', emoji: '🍪' },
  { id: CAT_BEVERAGE, name: 'Beverages', emoji: '☕' },
  { id: CAT_KAKANIN, name: 'Kakanin', emoji: '🍡' },
  { id: CAT_SPECIAL, name: 'Special', emoji: '⭐' },
];

export const SEED_PRODUCTS = [
  // Breads
  { id: uuidv4(), name: 'Pandesal', categoryId: CAT_BREAD, price: 5, costPrice: 2.50, stock: 200, unit: 'pc', reorderPoint: 50, emoji: '🍞' },
  { id: uuidv4(), name: 'Tasty Bread', categoryId: CAT_BREAD, price: 8, costPrice: 3.50, stock: 100, unit: 'pc', reorderPoint: 30, emoji: '🍞' },
  { id: uuidv4(), name: 'Wheat Loaf', categoryId: CAT_BREAD, price: 85, costPrice: 40, stock: 25, unit: 'pc', reorderPoint: 8, emoji: '🍞' },
  { id: uuidv4(), name: 'Raisin Bread', categoryId: CAT_BREAD, price: 45, costPrice: 20, stock: 30, unit: 'pc', reorderPoint: 10, emoji: '🍞' },
  { id: uuidv4(), name: 'Cheese Bread', categoryId: CAT_BREAD, price: 12, costPrice: 5, stock: 80, unit: 'pc', reorderPoint: 20, emoji: '🧀' },

  // Pastries
  { id: uuidv4(), name: 'Ensaymada', categoryId: CAT_PASTRY, price: 25, costPrice: 10, stock: 60, unit: 'pc', reorderPoint: 15, emoji: '🥐' },
  { id: uuidv4(), name: 'Spanish Bread', categoryId: CAT_PASTRY, price: 8, costPrice: 3, stock: 100, unit: 'pc', reorderPoint: 25, emoji: '🥖' },
  { id: uuidv4(), name: 'Cheese Roll', categoryId: CAT_PASTRY, price: 15, costPrice: 6, stock: 50, unit: 'pc', reorderPoint: 15, emoji: '🧀' },
  { id: uuidv4(), name: 'Ube Cheese Pandesal', categoryId: CAT_PASTRY, price: 15, costPrice: 7, stock: 80, unit: 'pc', reorderPoint: 20, emoji: '💜' },
  { id: uuidv4(), name: 'Empanada', categoryId: CAT_PASTRY, price: 20, costPrice: 8, stock: 40, unit: 'pc', reorderPoint: 10, emoji: '🥟' },
  { id: uuidv4(), name: 'Hopia', categoryId: CAT_PASTRY, price: 18, costPrice: 7, stock: 60, unit: 'pc', reorderPoint: 15, emoji: '🥮' },

  // Cakes
  { id: uuidv4(), name: 'Mocha Cake (Whole)', categoryId: CAT_CAKE, price: 450, costPrice: 200, stock: 8, unit: 'pc', reorderPoint: 3, emoji: '🎂' },
  { id: uuidv4(), name: 'Mocha Cake (Slice)', categoryId: CAT_CAKE, price: 65, costPrice: 25, stock: 20, unit: 'pc', reorderPoint: 5, emoji: '🍰' },
  { id: uuidv4(), name: 'Ube Cake (Whole)', categoryId: CAT_CAKE, price: 500, costPrice: 220, stock: 6, unit: 'pc', reorderPoint: 2, emoji: '💜' },
  { id: uuidv4(), name: 'Choco Moist Cake', categoryId: CAT_CAKE, price: 550, costPrice: 250, stock: 5, unit: 'pc', reorderPoint: 2, emoji: '🍫' },
  { id: uuidv4(), name: 'Choco Cake Slice', categoryId: CAT_CAKE, price: 75, costPrice: 30, stock: 15, unit: 'pc', reorderPoint: 5, emoji: '🍰' },
  { id: uuidv4(), name: 'Mango Cake', categoryId: CAT_CAKE, price: 650, costPrice: 300, stock: 4, unit: 'pc', reorderPoint: 2, emoji: '🥭' },

  // Cookies & Bars
  { id: uuidv4(), name: 'Butter Cookies', categoryId: CAT_COOKIE, price: 120, costPrice: 50, stock: 30, unit: 'box', reorderPoint: 8, emoji: '🍪' },
  { id: uuidv4(), name: 'Brownies', categoryId: CAT_COOKIE, price: 35, costPrice: 15, stock: 40, unit: 'pc', reorderPoint: 10, emoji: '🟫' },
  { id: uuidv4(), name: 'Crinkles', categoryId: CAT_COOKIE, price: 10, costPrice: 4, stock: 80, unit: 'pc', reorderPoint: 20, emoji: '🍪' },
  { id: uuidv4(), name: 'Polvoron', categoryId: CAT_COOKIE, price: 8, costPrice: 3, stock: 100, unit: 'pc', reorderPoint: 25, emoji: '🤍' },

  // Beverages
  { id: uuidv4(), name: 'Iced Coffee', categoryId: CAT_BEVERAGE, price: 55, costPrice: 15, stock: 50, unit: 'cup', reorderPoint: 0, emoji: '☕' },
  { id: uuidv4(), name: 'Hot Chocolate', categoryId: CAT_BEVERAGE, price: 45, costPrice: 12, stock: 50, unit: 'cup', reorderPoint: 0, emoji: '🍫' },
  { id: uuidv4(), name: 'Mango Juice', categoryId: CAT_BEVERAGE, price: 40, costPrice: 10, stock: 50, unit: 'cup', reorderPoint: 0, emoji: '🥭' },
  { id: uuidv4(), name: 'Bottled Water', categoryId: CAT_BEVERAGE, price: 20, costPrice: 8, stock: 100, unit: 'pc', reorderPoint: 20, emoji: '💧' },

  // Kakanin
  { id: uuidv4(), name: 'Bibingka', categoryId: CAT_KAKANIN, price: 30, costPrice: 12, stock: 30, unit: 'pc', reorderPoint: 8, emoji: '🟡' },
  { id: uuidv4(), name: 'Puto', categoryId: CAT_KAKANIN, price: 8, costPrice: 3, stock: 60, unit: 'pc', reorderPoint: 15, emoji: '⚪' },
  { id: uuidv4(), name: 'Kutsinta', categoryId: CAT_KAKANIN, price: 8, costPrice: 3, stock: 60, unit: 'pc', reorderPoint: 15, emoji: '🟤' },
  { id: uuidv4(), name: 'Sapin-Sapin', categoryId: CAT_KAKANIN, price: 180, costPrice: 70, stock: 10, unit: 'tray', reorderPoint: 3, emoji: '🌈' },
  { id: uuidv4(), name: 'Leche Flan', categoryId: CAT_KAKANIN, price: 150, costPrice: 55, stock: 12, unit: 'pc', reorderPoint: 3, emoji: '🍮' },
];

// ── Seed Customers ──
export const SEED_CUSTOMERS = [
  { id: uuidv4(), name: 'Maria Santos', phone: '0917-123-4567', email: 'maria@email.com', address: 'Brgy. San Jose, Quezon City', totalSpent: 5400, visits: 24, balance: 0, createdAt: '2026-01-15' },
  { id: uuidv4(), name: 'Juan Dela Cruz', phone: '0918-234-5678', email: '', address: 'Brgy. Maligaya, Manila', totalSpent: 3200, visits: 15, balance: 150, createdAt: '2026-02-01' },
  { id: uuidv4(), name: 'Elena Reyes', phone: '0919-345-6789', email: 'elena.reyes@email.com', address: 'Brgy. Sta. Lucia, Pasig', totalSpent: 8750, visits: 42, balance: 0, createdAt: '2025-11-20' },
  { id: uuidv4(), name: 'Pedro Garcia', phone: '0920-456-7890', email: '', address: 'Brgy. Poblacion, Makati', totalSpent: 1800, visits: 8, balance: 0, createdAt: '2026-03-10' },
  { id: uuidv4(), name: 'Rosa Mendoza', phone: '0921-567-8901', email: 'rosa.m@email.com', address: 'Brgy. Bagong Silang, Caloocan', totalSpent: 12500, visits: 55, balance: 0, createdAt: '2025-08-05' },
];

// ── Seed Users ──
export const SEED_USERS = [
  { id: 'admin', name: 'Admin', role: 'admin', pin: '1234' },
  { id: 'cashier1', name: 'Ana', role: 'cashier', pin: '1111' },
  { id: 'cashier2', name: 'Ben', role: 'cashier', pin: '2222' },
];

// ── Sample Transactions ──
function generateSampleTransactions() {
  const txns = [];
  const products = SEED_PRODUCTS;
  const customers = SEED_CUSTOMERS;
  const methods = ['cash', 'gcash', 'card', 'cash', 'cash', 'gcash'];

  for (let i = 0; i < 40; i++) {
    const daysAgo = Math.floor(Math.random() * 14);
    const date = new Date();
    date.setDate(date.getDate() - daysAgo);
    date.setHours(6 + Math.floor(Math.random() * 14), Math.floor(Math.random() * 60));

    const numItems = 1 + Math.floor(Math.random() * 4);
    const items = [];
    const usedProductIds = new Set();

    for (let j = 0; j < numItems; j++) {
      const product = products[Math.floor(Math.random() * products.length)];
      if (usedProductIds.has(product.id)) continue;
      usedProductIds.add(product.id);

      const qty = 1 + Math.floor(Math.random() * 5);
      items.push({
        id: uuidv4(),
        productId: product.id,
        name: product.name,
        price: product.price,
        costPrice: product.costPrice,
        quantity: qty,
        unit: product.unit,
        discount: 0,
        total: product.price * qty,
      });
    }

    if (items.length === 0) continue;

    const subtotal = items.reduce((s, it) => s + it.total, 0);
    const tax = 0;
    const total = subtotal + tax;
    const customer = Math.random() > 0.4 ? customers[Math.floor(Math.random() * customers.length)] : null;
    const method = methods[Math.floor(Math.random() * methods.length)];

    txns.push({
      id: uuidv4(),
      receiptNumber: `FEL-${date.toISOString().slice(2, 10).replace(/-/g, '')}-${String(1000 + i).slice(1)}`,
      items,
      subtotal,
      discount: 0,
      tax,
      total,
      paymentMethod: method,
      amountPaid: method === 'cash' ? Math.ceil(total / 50) * 50 : total,
      change: method === 'cash' ? Math.ceil(total / 50) * 50 - total : 0,
      customerId: customer?.id || null,
      customerName: customer?.name || 'Walk-in Customer',
      cashierId: 'admin',
      cashierName: 'Admin',
      date: date.toISOString(),
      status: 'completed',
      notes: '',
    });
  }

  return txns.sort((a, b) => new Date(b.date) - new Date(a.date));
}

export const SEED_TRANSACTIONS = generateSampleTransactions();

// ── Sample Expenses ──
export const EXPENSE_CATEGORIES = [
  { id: 'ingredients', name: 'Ingredients', emoji: '🥚' },
  { id: 'utilities', name: 'Utilities', emoji: '💡' },
  { id: 'rent', name: 'Rent', emoji: '🏠' },
  { id: 'wages', name: 'Wages', emoji: '👷' },
  { id: 'packaging', name: 'Packaging', emoji: '📦' },
  { id: 'equipment', name: 'Equipment', emoji: '🔧' },
  { id: 'other', name: 'Other', emoji: '📋' },
];

function generateSampleExpenses() {
  const expenses = [];
  const items = [
    { category: 'ingredients', desc: 'Flour (25kg)', amount: 850 },
    { category: 'ingredients', desc: 'Sugar (10kg)', amount: 520 },
    { category: 'ingredients', desc: 'Eggs (30 pcs)', amount: 270 },
    { category: 'ingredients', desc: 'Butter (5kg)', amount: 1200 },
    { category: 'ingredients', desc: 'Ube Halaya (2kg)', amount: 350 },
    { category: 'utilities', desc: 'Electricity Bill', amount: 4500 },
    { category: 'utilities', desc: 'Water Bill', amount: 800 },
    { category: 'packaging', desc: 'Cake Boxes', amount: 600 },
    { category: 'packaging', desc: 'Paper Bags', amount: 350 },
    { category: 'wages', desc: 'Baker Salary', amount: 8000 },
    { category: 'wages', desc: 'Helper Salary', amount: 5000 },
  ];

  for (let i = 0; i < 15; i++) {
    const item = items[Math.floor(Math.random() * items.length)];
    const daysAgo = Math.floor(Math.random() * 30);
    const date = new Date();
    date.setDate(date.getDate() - daysAgo);

    expenses.push({
      id: uuidv4(),
      category: item.category,
      description: item.desc,
      amount: item.amount + Math.floor(Math.random() * 200 - 100),
      date: date.toISOString(),
      addedBy: 'Admin',
    });
  }

  return expenses.sort((a, b) => new Date(b.date) - new Date(a.date));
}

export const SEED_EXPENSES = generateSampleExpenses();

// ── Sample Pre-orders ──
export const SEED_PREORDERS = [
  {
    id: uuidv4(),
    customerName: 'Maria Santos',
    customerPhone: '0917-123-4567',
    items: 'Mocha Cake (8 inches) with "Happy Birthday Lola" topper',
    quantity: 1,
    totalPrice: 650,
    deposit: 300,
    pickupDate: new Date(Date.now() + 2 * 86400000).toISOString(),
    specialInstructions: 'Extra chocolate ganache on top. Blue roses decoration.',
    status: 'confirmed',
    createdAt: new Date(Date.now() - 86400000).toISOString(),
  },
  {
    id: uuidv4(),
    customerName: 'Elena Reyes',
    customerPhone: '0919-345-6789',
    items: 'Ensaymada x50, Spanish Bread x100',
    quantity: 150,
    totalPrice: 2050,
    deposit: 1000,
    pickupDate: new Date(Date.now() + 5 * 86400000).toISOString(),
    specialInstructions: 'For office event. Pack in boxes of 10.',
    status: 'pending',
    createdAt: new Date().toISOString(),
  },
];
