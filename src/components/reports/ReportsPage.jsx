import { useState, useMemo } from 'react';
import { useOrders } from '../../contexts/OrderContext';
import { useProducts } from '../../contexts/ProductContext';
import { useExpenses } from '../../contexts/ExpenseContext';
import { useSettings } from '../../contexts/SettingsContext';
import { formatCurrency, formatDateTime, exportToCSV } from '../../utils/formatters';
import Header from '../layout/Header';
import ReceiptPreview from '../pos/ReceiptPreview';
import { DownloadCloud, Receipt, TrendingUp, PieChart, FileText, Printer } from 'lucide-react';

export default function ReportsPage() {
  const { transactions, preOrders } = useOrders();
  const { products, categories } = useProducts();
  const { expenses } = useExpenses();
  const { settings } = useSettings();
  const [activeTab, setActiveTab] = useState('transactions');

  const [selectedTransaction, setSelectedTransaction] = useState(null);
  const [showReceipt, setShowReceipt] = useState(false);

  const handleReprint = (transaction) => {
    setSelectedTransaction(transaction);
    setShowReceipt(true);
  };

  // Unified Sales (Transactions + Picked Up Pre-orders)
  const allSales = useMemo(() => {
    const closedPreOrders = preOrders
      .filter(o => o.status === 'picked_up')
      .map(o => ({
        id: o.id,
        date: o.dueDate, // The pickup date
        receiptNumber: `PRE-${o.id.slice(0, 4)}`,
        customerName: o.customerName,
        cashierName: 'Pre-order System',
        paymentMethod: 'prepaid',
        total: o.totalPrice,
        items: Array.isArray(o.items) ? o.items : [{ name: o.items, price: o.totalPrice, quantity: 1, productId: 'custom' }],
        isPreorder: true
      }));

    return [...transactions, ...closedPreOrders].sort((a, b) => new Date(b.date) - new Date(a.date));
  }, [transactions, preOrders]);

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
    exportToCSV(allSales, 'Unified_Sales_Ledger', cols);
  };

  // --- Product Performance ---
  const productStats = useMemo(() => {
    const map = {};
    products.forEach(p => {
      map[p.id] = { ...p, sold: 0, revenue: 0 };
    });
    
    // Virtual category for custom items
    map['custom'] = { id: 'custom', name: 'Custom Pre-orders', emoji: '🎂', categoryId: 'custom', sold: 0, revenue: 0, stock: '-', reorderPoint: 0 };

    allSales.forEach(t => {
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
    exportToCSV(expenses, 'Expenses_Ledger', cols);
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
      <div className="page-content animate-fade-in">
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
                  {allSales.slice(0, 100).map(t => (
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
                  Showing top 100 recent rows. Export CSV to view all {allSales.length} records.
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
                  {expenses.slice(0, 100).map(e => (
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
    </>
  );
}
