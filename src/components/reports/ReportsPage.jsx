import { useState, useMemo, useEffect } from 'react';
import { useOrders } from '../../contexts/OrderContext';
import { useProducts } from '../../contexts/ProductContext';
import { useExpenses } from '../../contexts/ExpenseContext';
import { useSettings } from '../../contexts/SettingsContext';
import { formatCurrency, formatDateTime, exportToCSV } from '../../utils/formatters';
import Header from '../layout/Header';
import ReceiptPreview from '../pos/ReceiptPreview';
import { DownloadCloud, Receipt, TrendingUp, PieChart, FileText, Printer, Calendar, Clock, ChevronDown } from 'lucide-react';

export default function ReportsPage() {
  const { transactions, preOrders } = useOrders();
  const { products, categories } = useProducts();
  const { expenses: allExpenses } = useExpenses();
  const { settings } = useSettings();
  const [activeTab, setActiveTab] = useState('transactions');
  const [rangePreset, setRangePreset] = useState('today');
  const [dateRange, setDateRange] = useState({ start: '', end: '' });

  // Initialize dates
  useEffect(() => {
    handleSetPreset('today');
  }, []);

  const handleSetPreset = (preset) => {
    setRangePreset(preset);
    const now = new Date();
    let start = new Date();
    let end = new Date();

    if (preset === 'today') {
      start.setHours(0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);
    } else if (preset === 'week') {
      const diff = now.getDate() - now.getDay(); // Start of week (Sunday)
      start = new Date(now.setDate(diff));
      start.setHours(0, 0, 0, 0);
      end = new Date();
    } else if (preset === 'month') {
      start = new Date(now.getFullYear(), now.getMonth(), 1);
      end = new Date();
    }
    
    setDateRange({
      start: start.toISOString().split('T')[0],
      end: end.toISOString().split('T')[0]
    });
  };

  const [selectedTransaction, setSelectedTransaction] = useState(null);
  const [showReceipt, setShowReceipt] = useState(false);

  const handleReprint = (transaction) => {
    setSelectedTransaction(transaction);
    setShowReceipt(true);
  };

  // Filter transactions and pre-orders by range
  const filteredSales = useMemo(() => {
    if (!dateRange.start || !dateRange.end) return [];
    
    const start = new Date(dateRange.start);
    start.setHours(0, 0, 0, 0);
    const end = new Date(dateRange.end);
    end.setHours(23, 59, 59, 999);

    const tx = transactions.filter(t => {
      const d = new Date(t.date);
      return d >= start && d <= end;
    });

    const pre = preOrders
      .filter(o => {
        if (o.status !== 'picked_up') return false;
        const d = new Date(o.dueDate);
        return d >= start && d <= end;
      })
      .map(o => ({
        id: o.id,
        date: o.dueDate,
        receiptNumber: `PRE-${o.id.slice(0, 4)}`,
        customerName: o.customerName,
        cashierName: 'Pre-order System',
        paymentMethod: 'prepaid',
        total: o.totalPrice,
        items: Array.isArray(o.items) ? o.items : [{ name: o.items, price: o.totalPrice, quantity: 1, productId: 'custom' }],
        isPreorder: true
      }));

    return [...tx, ...pre].sort((a, b) => new Date(b.date) - new Date(a.date));
  }, [transactions, preOrders, dateRange]);

  const filteredExpenses = useMemo(() => {
    if (!dateRange.start || !dateRange.end) return [];
    const start = new Date(dateRange.start);
    start.setHours(0, 0, 0, 0);
    const end = new Date(dateRange.end);
    end.setHours(23, 59, 59, 999);

    return allExpenses.filter(e => {
      const d = new Date(e.date);
      return d >= start && d <= end;
    });
  }, [allExpenses, dateRange]);

  // --- Transactions Ledger ---
  const handleExportTransactions = () => {
    const cols = [
      { header: 'Date', accessor: t => formatDateTime(t.date) },
      { header: 'Receipt No', accessor: t => t.receiptNumber },
      { header: 'Type', accessor: t => t.isPreorder ? 'Pre-order' : 'POS' },
      { header: 'Customer', accessor: t => t.customerName || 'Walk-in' },
      { header: 'Cashier', accessor: t => t.cashierName },
      { header: 'Payment Method', accessor: t => t.paymentMethod },
      { header: 'Total (PHP)', accessor: t => t.total.toFixed(2) },
      { header: 'Items Sold', accessor: t => t.items?.reduce((s, i) => s + i.quantity, 0) || 0 }
    ];
    exportToCSV(filteredSales, `Unified_Sales_${dateRange.start}_to_${dateRange.end}`, cols);
  };

  // --- Product Performance ---
  const productStats = useMemo(() => {
    const map = {};
    products.forEach(p => {
      map[p.id] = { ...p, sold: 0, revenue: 0 };
    });
    
    // Virtual category for custom items
    map['custom'] = { id: 'custom', name: 'Custom Pre-orders', emoji: '🎂', categoryId: 'custom', sold: 0, revenue: 0, stock: '-', reorderPoint: 0 };

    filteredSales.forEach(t => {
      t.items?.forEach(i => {
        const key = map[i.productId] ? i.productId : 'custom';
        map[key].sold += i.quantity;
        map[key].revenue += (i.price * i.quantity);
      });
    });
    
    return Object.values(map).filter(p => p.sold > 0 || p.id !== 'custom').sort((a, b) => b.sold - a.sold);
  }, [allSales, products]);

  const handleExportProducts = () => {
    const cols = [
      { header: 'Product Name', accessor: p => p.name },
      { header: 'Category', accessor: p => categories.find(c => c.id === p.categoryId)?.name || 'Uncategorized' },
      { header: 'Current Stock', accessor: p => p.stock },
      { header: 'Total Qty Sold', accessor: p => p.sold },
      { header: 'Total Revenue (PHP)', accessor: p => p.revenue.toFixed(2) }
    ];
    exportToCSV(productStats, 'Product_Performance', cols);
  };

  // --- Expenses Export ---
  const handleExportExpenses = () => {
    const cols = [
      { header: 'Date', accessor: e => formatDateTime(e.date) },
      { header: 'Category', accessor: e => e.category },
      { header: 'Description', accessor: e => e.description },
      { header: 'Amount (PHP)', accessor: e => e.amount.toFixed(2) },
      { header: 'Added By', accessor: e => e.addedBy }
    ];
    exportToCSV(filteredExpenses, `Expenses_${dateRange.start}_to_${dateRange.end}`, cols);
  };

  return (
    <>
      <Header 
        title="Reports & Analytics" 
        subtitle="Exportable accounting data and deep metrics" 
        actions={
          <div className="flex gap-2">
            {activeTab === 'transactions' && (
              <button className="btn btn-primary" onClick={handleExportTransactions}>
                <DownloadCloud size={16} /> Export CSV
              </button>
            )}
            {activeTab === 'products' && (
              <button className="btn btn-primary" onClick={handleExportProducts}>
                <DownloadCloud size={16} /> Export CSV
              </button>
            )}
            {activeTab === 'expenses' && (
              <button className="btn btn-primary" onClick={handleExportExpenses}>
                <DownloadCloud size={16} /> Export CSV
              </button>
            )}
          </div>
        }
      />
      <div className="page-content animate-fade-in" style={{ paddingTop: 0 }}>
        {/* DATE FILTER BAR */}
        <div className="date-filter-bar-luxury">
           <div className="preset-group">
              <button className={rangePreset === 'today' ? 'active' : ''} onClick={() => handleSetPreset('today')}>Today</button>
              <button className={rangePreset === 'week' ? 'active' : ''} onClick={() => handleSetPreset('week')}>This Week</button>
              <button className={rangePreset === 'month' ? 'active' : ''} onClick={() => handleSetPreset('month')}>This Month</button>
              <button className={rangePreset === 'custom' ? 'active' : ''} onClick={() => setRangePreset('custom')}>Custom Range</button>
           </div>
           
           {rangePreset === 'custom' && (
             <div className="custom-dates animate-scale-in">
                <div className="date-input-lux">
                  <Calendar size={14} />
                  <input type="date" value={dateRange.start} onChange={e => setDateRange({...dateRange, start: e.target.value})} />
                </div>
                <div style={{ opacity: 0.3 }}>-</div>
                <div className="date-input-lux">
                  <Calendar size={14} />
                  <input type="date" value={dateRange.end} onChange={e => setDateRange({...dateRange, end: e.target.value})} />
                </div>
             </div>
           )}

           <div className="flex-1" />

           <div className="range-indicator">
              <Clock size={14} style={{ opacity: 0.5 }} />
              <span>{dateRange.start} to {dateRange.end}</span>
           </div>
        </div>
        <div className="tabs">
          <button className={`tab ${activeTab === 'transactions' ? 'active' : ''}`} onClick={() => setActiveTab('transactions')}>
            <Receipt size={16} style={{ display: 'inline', marginRight: 6, verticalAlign: 'text-bottom' }}/> 
            Transaction Ledger
          </button>
          <button className={`tab ${activeTab === 'products' ? 'active' : ''}`} onClick={() => setActiveTab('products')}>
            <PieChart size={16} style={{ display: 'inline', marginRight: 6, verticalAlign: 'text-bottom' }}/> 
            Product Performance
          </button>
          <button className={`tab ${activeTab === 'expenses' ? 'active' : ''}`} onClick={() => setActiveTab('expenses')}>
            <FileText size={16} style={{ display: 'inline', marginRight: 6, verticalAlign: 'text-bottom' }}/> 
            Expenses Ledger
          </button>
        </div>

        {activeTab === 'transactions' && (
          <div className="card">
            <div className="table-container" style={{ border: 'none' }}>
              <table className="table">
                <thead><tr><th>Date</th><th>Type</th><th>Receipt</th><th>Customer</th><th>Cashier</th><th>Method</th><th>Items</th><th>Total</th><th style={{ textAlign: 'right' }}>Action</th></tr></thead>
                <tbody>
                  {filteredSales.slice(0, 500).map(t => (
                    <tr key={t.id}>
                      <td>{formatDateTime(t.date)}</td>
                      <td className="text-muted text-xs uppercase">{t.isPreorder ? 'Pre-order' : 'POS'}</td>
                      <td className="primary">{t.receiptNumber}</td>
                      <td>{t.customerName || 'Walk-in'}</td>
                      <td>{t.cashierName}</td>
                      <td><span className={`badge badge-${t.paymentMethod === 'cash' ? 'green' : t.paymentMethod === 'gcash' ? 'blue' : 'amber'}`}>{t.paymentMethod}</span></td>
                      <td>{t.items?.reduce((s, i) => s + i.quantity, 0) || 0} pcs</td>
                      <td className="font-bold text-right" style={{ color: 'var(--text-primary)' }}>{formatCurrency(t.total)}</td>
                      <td style={{ textAlign: 'right' }}>
                        <button className="btn btn-icon btn-ghost" onClick={() => handleReprint(t)} title="Reprint Receipt">
                          <Printer size={16} />
                        </button>
                      </td>
                    </tr>
                  ))}
                  {allSales.length === 0 && (
                    <tr><td colSpan={9} className="text-center text-muted py-4">No transactions recorded yet</td></tr>
                  )}
                </tbody>
              </table>
              {allSales.length > 100 && (
                <div className="text-center text-muted" style={{ padding: 12, fontSize: 'var(--font-xs)' }}>
                  Showing top 500 recent rows. Export CSV to view all {filteredSales.length} records.
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'products' && (
          <div className="card">
            <div className="table-container" style={{ border: 'none' }}>
              <table className="table">
                <thead><tr><th>Product Name</th><th>Category</th><th>Current Stock</th><th>Sold Quantity</th><th>Total Revenue Generated</th></tr></thead>
                <tbody>
                  {productStats.map(p => (
                    <tr key={p.id}>
                      <td className="primary">{p.emoji} {p.name}</td>
                      <td>{categories.find(c => c.id === p.categoryId)?.name || 'Other'}</td>
                      <td><span className={`badge ${p.stock <= p.reorderPoint ? 'badge-red' : 'badge-gray'}`}>{p.stock}</span></td>
                      <td className="font-bold">{p.sold}</td>
                      <td className="font-bold text-right" style={{ color: 'var(--success)' }}>{formatCurrency(p.revenue)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'expenses' && (
          <div className="card">
            <div className="table-container" style={{ border: 'none' }}>
              <table className="table">
                <thead><tr><th>Date</th><th>Category</th><th>Description</th><th>Added By</th><th>Amount</th></tr></thead>
                <tbody>
                  {filteredExpenses.slice(0, 500).map(e => (
                    <tr key={e.id}>
                      <td>{formatDateTime(e.date)}</td>
                      <td><span className="badge badge-gray">{e.category}</span></td>
                      <td>{e.description}</td>
                      <td className="text-xs">{e.addedBy}</td>
                      <td className="font-bold text-right" style={{ color: 'var(--danger)' }}>{formatCurrency(e.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
      {showReceipt && selectedTransaction && (
        <ReceiptPreview 
          transaction={selectedTransaction} 
          settings={settings} 
          onClose={() => setShowReceipt(false)} 
        />
      )}
      <style jsx>{`
        .date-filter-bar-luxury {
          background: rgba(255, 255, 255, 0.4);
          backdrop-filter: blur(20px);
          border-bottom: 1px solid rgba(0,0,0,0.05);
          padding: 12px 32px;
          display: flex;
          align-items: center;
          gap: 20px;
          margin-bottom: 24px;
        }

        .preset-group {
          display: flex;
          background: rgba(0,0,0,0.03);
          padding: 4px;
          border-radius: 14px;
          gap: 4px;
        }
        .preset-group button {
          border: none;
          background: transparent;
          padding: 8px 16px;
          border-radius: 10px;
          font-size: 0.8rem;
          font-weight: 700;
          color: #8B837E;
          cursor: pointer;
          transition: all 0.2s;
        }
        .preset-group button.active {
          background: white;
          color: var(--mocha);
          box-shadow: 0 4px 12px rgba(0,0,0,0.05);
        }

        .custom-dates {
          display: flex;
          align-items: center;
          gap: 12px;
        }
        .date-input-lux {
          background: white;
          border: 1px solid rgba(0,0,0,0.05);
          border-radius: 12px;
          padding: 6px 12px;
          display: flex;
          align-items: center;
          gap: 10px;
          box-shadow: 0 2px 8px rgba(0,0,0,0.02);
        }
        .date-input-lux input {
          border: none;
          outline: none;
          font-family: inherit;
          font-weight: 600;
          color: var(--mocha);
          font-size: 0.85rem;
        }

        .range-indicator {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 0.75rem;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 1px;
          color: #A0938A;
          background: white;
          padding: 10px 15px;
          border-radius: 12px;
          border: 1px solid rgba(0,0,0,0.03);
        }

        @keyframes scaleIn {
          from { transform: scale(0.95); opacity: 0; }
          to { transform: scale(1); opacity: 1; }
        }
        .animate-scale-in { animation: scaleIn 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275) both; }
      `}</style>
    </>
  );
}
