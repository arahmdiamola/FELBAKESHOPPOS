import { useState, useMemo } from 'react';
import { useOrders } from '../../contexts/OrderContext';
import { useProducts } from '../../contexts/ProductContext';
import { useExpenses } from '../../contexts/ExpenseContext';
import { formatCurrency, formatDateTime, exportToCSV } from '../../utils/formatters';
import Header from '../layout/Header';
import { DownloadCloud, Receipt, TrendingUp, PieChart, FileText } from 'lucide-react';

export default function ReportsPage() {
  const { transactions } = useOrders();
  const { products, categories } = useProducts();
  const { expenses } = useExpenses();
  const [activeTab, setActiveTab] = useState('transactions');

  // --- Transactions Ledger ---
  const handleExportTransactions = () => {
    const cols = [
      { header: 'Date', accessor: t => formatDateTime(t.date) },
      { header: 'Receipt No', accessor: t => t.receiptNumber },
      { header: 'Customer', accessor: t => t.customerName || 'Walk-in' },
      { header: 'Cashier', accessor: t => t.cashierName },
      { header: 'Payment Method', accessor: t => t.paymentMethod },
      { header: 'Total (PHP)', accessor: t => t.total.toFixed(2) },
      { header: 'Items Sold', accessor: t => t.items?.reduce((s, i) => s + i.quantity, 0) || 0 }
    ];
    exportToCSV(transactions, 'Transaction_Ledger', cols);
  };

  // --- Product Performance ---
  const productStats = useMemo(() => {
    const map = {};
    products.forEach(p => {
      map[p.id] = { ...p, sold: 0, revenue: 0 };
    });
    
    transactions.forEach(t => {
      t.items?.forEach(i => {
        if (map[i.productId]) {
          map[i.productId].sold += i.quantity;
          map[i.productId].revenue += (i.price * i.quantity);
        }
      });
    });
    
    return Object.values(map).sort((a, b) => b.sold - a.sold);
  }, [transactions, products]);

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
                <thead><tr><th>Date</th><th>Receipt</th><th>Customer</th><th>Cashier</th><th>Method</th><th>Items</th><th>Total</th></tr></thead>
                <tbody>
                  {transactions.slice(0, 100).map(t => (
                    <tr key={t.id}>
                      <td>{formatDateTime(t.date)}</td>
                      <td className="primary">{t.receiptNumber}</td>
                      <td>{t.customerName || 'Walk-in'}</td>
                      <td>{t.cashierName}</td>
                      <td><span className={`badge badge-${t.paymentMethod === 'cash' ? 'green' : t.paymentMethod === 'gcash' ? 'blue' : 'amber'}`}>{t.paymentMethod}</span></td>
                      <td>{t.items?.reduce((s, i) => s + i.quantity, 0) || 0} pcs</td>
                      <td className="font-bold text-right" style={{ color: 'var(--text-primary)' }}>{formatCurrency(t.total)}</td>
                    </tr>
                  ))}
                  {transactions.length === 0 && (
                    <tr><td colSpan={7} className="text-center text-muted py-4">No transactions recorded yet</td></tr>
                  )}
                </tbody>
              </table>
              {transactions.length > 100 && (
                <div className="text-center text-muted" style={{ padding: 12, fontSize: 'var(--font-xs)' }}>
                  Showing top 100 recent rows. Export CSV to view all {transactions.length} records.
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
    </>
  );
}
