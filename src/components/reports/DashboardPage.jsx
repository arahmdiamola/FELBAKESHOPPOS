import { useMemo, useState } from 'react';
import { useOrders } from '../../contexts/OrderContext';
import { useProducts } from '../../contexts/ProductContext';
import { useExpenses } from '../../contexts/ExpenseContext';
import { useSettings } from '../../contexts/SettingsContext';
import { formatCurrency, formatNumber } from '../../utils/formatters';
import { DollarSign, ShoppingBag, TrendingUp, AlertTriangle, Package, Wallet, Printer, Calendar, CreditCard } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, AreaChart, Area } from 'recharts';
import Header from '../layout/Header';
import ReceiptPreview from '../pos/ReceiptPreview';

export default function DashboardPage() {
  const { allSales, getTodayStats } = useOrders();
  const { products, categories, getLowStockProducts } = useProducts();
  const { getTotalExpenses } = useExpenses();
  const { settings } = useSettings();

  const [selectedTransaction, setSelectedTransaction] = useState(null);
  const [showReceipt, setShowReceipt] = useState(false);

  const handleReprint = (transaction) => {
    setSelectedTransaction(transaction);
    setShowReceipt(true);
  };

  const todayStats = getTodayStats();
  const lowStock = getLowStockProducts();
  const monthlyExpenses = getTotalExpenses(30);
  const weeklyExpenses = getTotalExpenses(7);

  // Weekly Revenue (Last 7 days)
  const weeklyRevenueVal = useMemo(() => {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 7);
    return allSales.filter(t => new Date(t.date) >= cutoff).reduce((sum, t) => sum + t.total, 0);
  }, [allSales]);

  // Weekly revenue
  const weeklyData = useMemo(() => {
    const data = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      date.setHours(0, 0, 0, 0);
      const next = new Date(date);
      next.setDate(next.getDate() + 1);

      const daySales = allSales.filter(t => {
        const d = new Date(t.date);
        return d >= date && d < next;
      });

      data.push({
        day: date.toLocaleDateString('en-US', { weekday: 'short' }),
        revenue: daySales.reduce((sum, t) => sum + t.total, 0),
        orders: daySales.length,
      });
    }
    return data;
  }, [allSales]);

  // Best sellers
  const bestSellers = useMemo(() => {
    const map = {};
    allSales.slice(0, 500).forEach(t => {
      (t.items || []).forEach(item => {
        map[item.name] = (map[item.name] || 0) + (item.quantity || 1);
      });
    });
    return Object.entries(map)
      .map(([name, qty]) => ({ name: name.length > 12 ? name.slice(0, 12) + '…' : name, qty }))
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 6);
  }, [allSales]);

  // Sales by category
  const categoryData = useMemo(() => {
    const map = {};
    allSales.slice(0, 500).forEach(t => {
      (t.items || []).forEach(item => {
        const product = products.find(p => p.id === item.productId);
        const catId = product?.categoryId || 'custom';
        map[catId] = (map[catId] || 0) + (item.price * item.quantity);
      });
    });
    return Object.entries(map)
      .map(([id, value]) => {
        const cat = categories.find(c => c.id === id);
        return { name: id === 'custom' ? 'Pre-orders' : (cat?.name || 'Other'), value: Math.round(value) };
      })
      .sort((a, b) => b.value - a.value)
      .slice(0, 6);
  }, [allSales, products, categories]);

  // Monthly revenue
  const monthlyRevenue = useMemo(() => {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 30);
    return allSales.filter(t => new Date(t.date) >= cutoff).reduce((sum, t) => sum + t.total, 0);
  }, [allSales]);

  // Today's Sales Pulse (Hourly)
  const todayPulseData = useMemo(() => {
    const data = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // Typical bakeshop hours: 6 AM to 9 PM
    for (let h = 6; h <= 21; h++) {
      const hSales = allSales.filter(t => {
        const d = new Date(t.date);
        return d >= today && d.getHours() === h;
      });
      
      data.push({
        hour: h > 12 ? `${h - 12} PM` : h === 12 ? '12 PM' : `${h} AM`,
        revenue: hSales.reduce((sum, t) => sum + t.total, 0),
        count: hSales.length
      });
    }
    return data;
  }, [allSales]);

  const COLORS = ['#D4763C', '#5B9BD5', '#4CAF50', '#F5A623', '#9C27B0', '#E74C3C'];

  const tooltipStyle = {
    backgroundColor: '#FFFCF9',
    border: '1px solid #E8D5C4',
    borderRadius: '12px',
    color: '#2C1810',
    fontSize: '13px',
    boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
  };

  return (
    <>
      <Header title="Dashboard" subtitle="Today's bakeshop performance at a glance" />
      <div className="page-content animate-fade-in">
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-card-icon amber"><DollarSign size={24} /></div>
            <div className="stat-card-content">
              <h3>Today's Revenue</h3>
              <div className="stat-value">{formatCurrency(todayStats.revenue)}</div>
              <div className="stat-change positive">{todayStats.count} orders today</div>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-card-icon blue"><Calendar size={24} /></div>
            <div className="stat-card-content">
              <h3>Weekly Revenue</h3>
              <div className="stat-value">{formatCurrency(weeklyRevenueVal)}</div>
              <div className="stat-change positive">Last 7 days</div>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-card-icon green"><TrendingUp size={24} /></div>
            <div className="stat-card-content">
              <h3>Monthly Revenue</h3>
              <div className="stat-value">{formatCurrency(monthlyRevenue)}</div>
              <div className="stat-change positive">Last 30 days</div>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-card-icon red"><CreditCard size={24} /></div>
            <div className="stat-card-content">
              <h3>Weekly Expenses</h3>
              <div className="stat-value">{formatCurrency(weeklyExpenses)}</div>
              <div className="stat-change negative">Last 7 days</div>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-card-icon orange"><Wallet size={24} /></div>
            <div className="stat-card-content">
              <h3>Monthly Expenses</h3>
              <div className="stat-value">{formatCurrency(monthlyExpenses)}</div>
              <div className="stat-change negative">Last 30 days</div>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-card-icon green"><Package size={24} /></div>
            <div className="stat-card-content">
              <h3>Inventory Value</h3>
              <div className="stat-value">{formatCurrency(inventoryValue)}</div>
              <div className="stat-change">{formatNumber(products.length)} products</div>
            </div>
          </div>
        </div>

        {/* Live Pulse Section */}
        <div className="chart-card" style={{ marginBottom: 24, padding: '24px' }}>
          <div className="chart-card-header" style={{ marginBottom: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <TrendingUp size={20} style={{ color: 'var(--success)' }} />
              <h3 style={{ fontSize: '1.2rem', fontWeight: 800 }}>Today's Sales Pulse</h3>
            </div>
            <span className="badge badge-green">LIVE TRACKING</span>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={todayPulseData}>
              <defs>
                <linearGradient id="colorPulse" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#4CAF50" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#4CAF50" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#E8D5C4" vertical={false} opacity={0.5} />
              <XAxis dataKey="hour" stroke="#A38B7E" fontSize={11} tickLine={false} axisLine={false} interval={2} />
              <YAxis hide />
              <Tooltip 
                contentStyle={{ ...tooltipStyle, borderRadius: '12px' }} 
                formatter={(v) => [formatCurrency(v), 'Revenue']} 
              />
              <Area type="monotone" dataKey="revenue" stroke="#4CAF50" strokeWidth={3} fill="url(#colorPulse)" dot={false} activeDot={{ r: 6, stroke: '#fff', strokeWidth: 2 }} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="charts-grid">
          <div className="chart-card">
            <div className="chart-card-header"><h3>Weekly Revenue</h3></div>
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart data={weeklyData}>
                <defs>
                  <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#D4763C" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#D4763C" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#E8D5C4" />
                <XAxis dataKey="day" stroke="#A38B7E" fontSize={12} />
                <YAxis stroke="#A38B7E" fontSize={12} tickFormatter={v => `₱${v}`} />
                <Tooltip contentStyle={tooltipStyle} formatter={(value) => [`₱${value.toFixed(2)}`, 'Revenue']} />
                <Area type="monotone" dataKey="revenue" stroke="#D4763C" strokeWidth={2} fill="url(#colorRev)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          <div className="chart-card">
            <div className="chart-card-header"><h3>Best Sellers</h3></div>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={bestSellers} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#E8D5C4" />
                <XAxis type="number" stroke="#A38B7E" fontSize={12} />
                <YAxis dataKey="name" type="category" stroke="#A38B7E" fontSize={11} width={100} />
                <Tooltip contentStyle={tooltipStyle} />
                <Bar dataKey="qty" fill="#D4763C" radius={[0, 4, 4, 0]} name="Sold" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="charts-grid">
          <div className="chart-card">
            <div className="chart-card-header"><h3>Sales by Category</h3></div>
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie data={categoryData} cx="50%" cy="50%" innerRadius={70} outerRadius={100} paddingAngle={5} dataKey="value">
                  {categoryData.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={tooltipStyle} formatter={(value) => [formatCurrency(value), 'Sales']} />
              </PieChart>
            </ResponsiveContainer>
            <div className="flex gap-3 justify-center" style={{ flexWrap: 'wrap', padding: '0 16px' }}>
              {categoryData.map((entry, i) => (
                <div key={i} className="flex items-center gap-1 text-sm">
                  <span style={{ width: 10, height: 10, borderRadius: '50%', background: COLORS[i], display: 'inline-block' }} />
                  {entry.name}
                </div>
              ))}
            </div>
          </div>

          <div className="card">
            <div className="card-header">
              <h3 className="card-title">Low Stock Alerts</h3>
              <span className="badge badge-red">{lowStock.length} items</span>
            </div>
            <div className="table-container" style={{ border: 'none' }}>
              <table className="table">
                <thead><tr><th>Product</th><th>Stock</th><th>Reorder At</th></tr></thead>
                <tbody>
                  {lowStock.slice(0, 8).map(p => (
                    <tr key={p.id}>
                      <td className="primary">{p.emoji} {p.name}</td>
                      <td><span className="badge badge-red">{p.stock} {p.unit}</span></td>
                      <td>{p.reorderPoint} {p.unit}</td>
                    </tr>
                  ))}
                  {lowStock.length === 0 && (
                    <tr><td colSpan={3} style={{ textAlign: 'center', color: 'var(--text-muted)' }}>All stocked up! 🎉</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Recent Transactions */}
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">Recent Sales Ledger</h3>
          </div>
          <div className="table-container" style={{ border: 'none' }}>
            <table className="table">
              <thead><tr><th>Type</th><th>Receipt</th><th>Customer</th><th>Items</th><th>Amount</th><th>Method</th><th style={{ textAlign: 'right' }}>Action</th></tr></thead>
              <tbody>
                {allSales.slice(0, 10).map(t => (
                  <tr key={t.id}>
                    <td><span className={`badge ${t.isPreorder ? 'badge-blue' : 'badge-gray'}`}>{t.isPreorder ? 'Pre-order' : 'POS'}</span></td>
                    <td className="primary">{t.receiptNumber}</td>
                    <td>{t.customerName || 'Walk-in'}</td>
                    <td>{t.items?.reduce((s, i) => s + i.quantity, 0) || 0} pcs</td>
                    <td className="font-bold">{formatCurrency(t.total)}</td>
                    <td><span className={`badge badge-${t.paymentMethod === 'cash' ? 'green' : t.paymentMethod === 'gcash' ? 'blue' : 'amber'}`}>{t.paymentMethod}</span></td>
                    <td style={{ textAlign: 'right' }}>
                      <button className="btn btn-icon btn-ghost" onClick={() => handleReprint(t)} title="Reprint Receipt">
                        <Printer size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
      {showReceipt && selectedTransaction && (
        <ReceiptPreview 
          transaction={selectedTransaction} 
          settings={settings} 
          onClose={() => setShowReceipt(false)} 
        />
      )}
    </>
  );
}
