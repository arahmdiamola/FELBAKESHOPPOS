import { useState, useMemo, useEffect } from 'react';
import { useOrders } from '../../contexts/OrderContext';
import { useProducts } from '../../contexts/ProductContext';
import { useExpenses } from '../../contexts/ExpenseContext';
import { useSettings } from '../../contexts/SettingsContext';
import { formatCurrency, formatDateTime, exportToCSV } from '../../utils/formatters';
import Header from '../layout/Header';
import ReceiptPreview from '../pos/ReceiptPreview';
import { 
  DownloadCloud, Receipt, TrendingUp, PieChart, FileText, 
  Printer, Calendar, Clock, ChevronDown, Filter, 
  ArrowRight, Download, BarChart3, Database
} from 'lucide-react';
import './ReportsPage.css';

export default function ReportsPage() {
  const { transactions, preOrders } = useOrders();
  const { products, categories } = useProducts();
  const { expenses: allExpenses } = useExpenses();
  const { settings } = useSettings();
  
  const [activeTab, setActiveTab] = useState('transactions');
  const [rangePreset, setRangePreset] = useState('today');
  const [dateRange, setDateRange] = useState({ start: '', end: '' });
  const [selectedTransaction, setSelectedTransaction] = useState(null);
  const [productionLogs, setProductionLogs] = useState([]);
  const [isLoadingProd, setIsLoadingProd] = useState(false);
  const [showReceipt, setShowReceipt] = useState(false);

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
      const diff = now.getDate() - now.getDay();
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

  const fetchProductionHistory = async () => {
    setIsLoadingProd(true);
    try {
      // Fetch both completed and ruined logs for full audit
      const [completed, ruined] = await Promise.all([
        api.get('/production/logs?status=completed'),
        api.get('/production/logs?status=ruined')
      ]);
      setProductionLogs([...(completed || []), ...(ruined || [])]);
    } catch (err) {
      console.error('Failed to fetch production logs', err);
    } finally {
      setIsLoadingProd(false);
    }
  };

  useEffect(() => {
    fetchProductionHistory();
  }, []);

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

  const productStats = useMemo(() => {
    const map = {};
    products.forEach(p => { map[p.id] = { ...p, sold: 0, revenue: 0 }; });
    map['custom'] = { id: 'custom', name: 'Custom Items', emoji: '✨', categoryId: 'custom', sold: 0, revenue: 0 };

    filteredSales.forEach(t => {
      t.items?.forEach(i => {
        const key = map[i.productId] ? i.productId : 'custom';
        map[key].sold += i.quantity;
        map[key].revenue += (i.price * i.quantity);
      });
    });
    
    return Object.values(map).filter(p => p.sold > 0).sort((a, b) => b.sold - a.sold);
  }, [filteredSales, products]);

  // Export Handlers
  const handleExport = () => {
    if (activeTab === 'transactions') {
      const cols = [
        { header: 'Date', accessor: t => formatDateTime(t.date) },
        { header: 'Receipt No', accessor: t => t.receiptNumber },
        { header: 'Type', accessor: t => t.isPreorder ? 'Pre-order' : 'POS' },
        { header: 'Customer', accessor: t => t.customerName || 'Walk-in' },
        { header: 'Payment', accessor: t => t.paymentMethod },
        { header: 'Total', accessor: t => t.total.toFixed(2) }
      ];
      exportToCSV(filteredSales, `Sales_Report_${dateRange.start}_to_${dateRange.end}`, cols);
    } else if (activeTab === 'products') {
      const cols = [
        { header: 'Product', accessor: p => p.name },
        { header: 'Sold', accessor: p => p.sold },
        { header: 'Revenue', accessor: p => p.revenue.toFixed(2) }
      ];
      exportToCSV(productStats, `Product_Report_${dateRange.start}`, cols);
    } else if (activeTab === 'materials') {
      const cols = [
        { header: 'Material', accessor: m => m.name },
        { header: 'Total Used', accessor: m => `${m.used} ${m.unit}` },
        { header: 'Total Wasted', accessor: m => `${m.wasted} ${m.unit}` },
        { header: 'Net Impact', accessor: m => `${(m.used + m.wasted).toFixed(2)} ${m.unit}` }
      ];
      exportToCSV(materialStats, `Material_Audit_${dateRange.start}_to_${dateRange.end}`, cols);
    } else {
      const cols = [
        { header: 'Date', accessor: e => formatDateTime(e.date) },
        { header: 'Description', accessor: e => e.description },
        { header: 'Amount', accessor: e => e.amount.toFixed(2) }
      ];
      exportToCSV(filteredExpenses, `Expenses_Report_${dateRange.start}`, cols);
    }
    addToast('Report exported successfully!', 'success');
  };

  // Metrics
  const totalRevenue = useMemo(() => filteredSales.reduce((s, t) => s + t.total, 0), [filteredSales]);
  const totalExpenses = useMemo(() => filteredExpenses.reduce((s, e) => s + e.amount, 0), [filteredExpenses]);
  
  const materialStats = useMemo(() => {
    if (!dateRange.start || !dateRange.end) return [];
    const start = new Date(dateRange.start);
    start.setHours(0, 0, 0, 0);
    const end = new Date(dateRange.end);
    end.setHours(23, 59, 59, 999);

    const filteredLogs = productionLogs.filter(log => {
      const d = new Date(log.date);
      return d >= start && d <= end;
    });

    const map = {};
    filteredLogs.forEach(log => {
      log.items?.forEach(item => {
        if (!map[item.materialId]) {
          map[item.materialId] = {
            id: item.materialId,
            name: item.name,
            emoji: item.emoji || '📦',
            unit: item.unit,
            used: 0,
            wasted: 0
          };
        }
        if (log.status === 'ruined') {
          map[item.materialId].wasted += item.quantity;
        } else {
          map[item.materialId].used += item.quantity;
        }
      });
    });

    return Object.values(map).sort((a, b) => b.used - a.used);
  }, [productionLogs, dateRange]);

  const netProfit = totalRevenue - totalExpenses;

  return (
    <>
      <Header />
      <div className="studio-reports-container">
        
        {/* Top Control Bar */}
        <div className="studio-control-bar">
           <div className="control-left">
              <h1 className="studio-page-title">Analytics Studio</h1>
              <div className="range-selector-lux">
                 <div className="preset-buttons">
                    {['today', 'week', 'month'].map(p => (
                       <button 
                          key={p} 
                          className={rangePreset === p ? 'active' : ''} 
                          onClick={() => handleSetPreset(p)}
                       >
                          {p.toUpperCase()}
                       </button>
                    ))}
                    <button 
                       className={rangePreset === 'custom' ? 'active' : ''} 
                       onClick={() => setRangePreset('custom')}
                    >
                       CUSTOM
                    </button>
                 </div>
                 
                 {rangePreset === 'custom' && (
                    <div className="custom-input-box animate-scale-in">
                       <div className="lux-input">
                          <Calendar size={14} />
                          <input type="date" value={dateRange.start} onChange={e => setDateRange({...dateRange, start: e.target.value})} />
                       </div>
                       <ArrowRight size={14} style={{ opacity: 0.3 }} />
                       <div className="lux-input">
                          <Calendar size={14} />
                          <input type="date" value={dateRange.end} onChange={e => setDateRange({...dateRange, end: e.target.value})} />
                       </div>
                    </div>
                 )}
              </div>
           </div>
           
           <div className="control-right">
              <button className="studio-export-btn" onClick={handleExport}>
                 <Download size={18} /> Export CSV
              </button>
           </div>
        </div>

        {/* Dash Summary Grid */}
        <div className="studio-summary-grid">
           <div className="summary-card-lux revenue">
              <div className="card-inner">
                 <div className="card-top">
                    <TrendingUp size={20} />
                    <span>GROSS REVENUE</span>
                 </div>
                 <div className="card-val">{formatCurrency(totalRevenue)}</div>
                 <div className="card-sub">{filteredSales.length} Transactions</div>
              </div>
           </div>
           
           <div className="summary-card-lux expense">
              <div className="card-inner">
                 <div className="card-top">
                    <FileText size={20} />
                    <span>TOTAL EXPENSES</span>
                 </div>
                 <div className="card-val">{formatCurrency(totalExpenses)}</div>
                 <div className="card-sub">{filteredExpenses.length} Records</div>
              </div>
           </div>

           <div className="summary-card-lux profit">
              <div className="card-inner">
                 <div className="card-top">
                    <BarChart3 size={20} />
                    <span>NET PROFIT</span>
                 </div>
                 <div className="card-val">{formatCurrency(netProfit)}</div>
                 <div className="card-sub">Margin: {totalRevenue > 0 ? ((netProfit/totalRevenue)*100).toFixed(1) : 0}%</div>
              </div>
           </div>
        </div>

        {/* Main Content Area */}
        <div className="studio-reports-workspace">
           <div className="workspace-header">
              <div className="studio-tabs">
                 <button className={activeTab === 'transactions' ? 'active' : ''} onClick={() => setActiveTab('transactions')}>Ledger</button>
                 <button className={activeTab === 'products' ? 'active' : ''} onClick={() => setActiveTab('products')}>Products</button>
                 <button className={activeTab === 'materials' ? 'active' : ''} onClick={() => setActiveTab('materials')}>Materials</button>
                 <button className={activeTab === 'expenses' ? 'active' : ''} onClick={() => setActiveTab('expenses')}>Expenses</button>
              </div>
              <div className="workspace-meta">
                 <Clock size={14} />
                 <span>Period: {dateRange.start} — {dateRange.end}</span>
              </div>
           </div>

           <div className="workspace-scroller">
              {activeTab === 'transactions' && (
                 <div className="studio-table-glass">
                    <table className="lux-table">
                       <thead>
                          <tr>
                             <th>TIME & DATE</th>
                             <th>RECEIPT</th>
                             <th>CUSTOMER</th>
                             <th>PAYMENT</th>
                             <th style={{ textAlign: 'right' }}>TOTAL</th>
                             <th style={{ textAlign: 'center' }}>OPS</th>
                          </tr>
                       </thead>
                       <tbody>
                          {filteredSales.map(t => (
                             <tr key={t.id}>
                                <td className="time-col">{formatDateTime(t.date)}</td>
                                <td className="receipt-col">{t.receiptNumber}</td>
                                <td>{t.customerName || 'Walk-in'}</td>
                                <td><span className={`method-badge ${t.paymentMethod}`}>{t.paymentMethod}</span></td>
                                <td className="val-col">{formatCurrency(t.total)}</td>
                                <td className="ops-col">
                                   <button onClick={() => { setSelectedTransaction(t); setShowReceipt(true); }}><Printer size={14} /></button>
                                </td>
                             </tr>
                          ))}
                       </tbody>
                    </table>
                 </div>
              )}

              {activeTab === 'products' && (
                 <div className="studio-grid-lux">
                    {productStats.map(p => (
                       <div key={p.id} className="stat-pill-lux">
                          <div className="pill-emoji">{p.emoji}</div>
                          <div className="pill-main">
                             <div className="pill-name">{p.name}</div>
                             <div className="pill-sub">{p.sold} Units Sold</div>
                          </div>
                          <div className="pill-val">{formatCurrency(p.revenue)}</div>
                       </div>
                    ))}
                 </div>
              )}

              {activeTab === 'materials' && (
                  <div className="studio-table-glass">
                     <table className="lux-table">
                        <thead>
                           <tr>
                              <th>MATERIAL</th>
                              <th>TOTAL QUANTITY USED</th>
                              <th>SPOILAGE / WASTE</th>
                              <th style={{ textAlign: 'right' }}>NET IMPACT</th>
                           </tr>
                        </thead>
                        <tbody>
                           {materialStats.map(m => (
                              <tr key={m.id}>
                                 <td className="material-col-audit">
                                    <div className="audit-emoji-lux">{m.emoji}</div>
                                    <div className="audit-name-lux">{m.name}</div>
                                 </td>
                                 <td className="usage-col-safe">{m.used} {m.unit}</td>
                                 <td className="usage-col-danger">{m.wasted > 0 ? `${m.wasted} ${m.unit}` : '—'}</td>
                                 <td className="val-col" style={{ fontWeight: 950 }}>{(m.used + m.wasted).toFixed(2)} {m.unit}</td>
                              </tr>
                           ))}
                           {materialStats.length === 0 && (
                              <tr>
                                 <td colSpan="4" style={{ textAlign: 'center', padding: '40px', opacity: 0.5 }}>
                                    No material consumption recorded for this period.
                                 </td>
                              </tr>
                           )}
                        </tbody>
                     </table>
                  </div>
               )}

              {activeTab === 'expenses' && (
                 <div className="studio-table-glass">
                    <table className="lux-table">
                       <thead>
                          <tr>
                             <th>DATE</th>
                             <th>CATEGORY</th>
                             <th>DESCRIPTION</th>
                             <th style={{ textAlign: 'right' }}>AMOUNT</th>
                          </tr>
                       </thead>
                       <tbody>
                          {filteredExpenses.map(e => (
                             <tr key={e.id}>
                                <td>{formatDateTime(e.date)}</td>
                                <td><span className="cat-badge">{e.category}</span></td>
                                <td>{e.description}</td>
                                <td className="val-col danger">{formatCurrency(e.amount)}</td>
                             </tr>
                          ))}
                       </tbody>
                    </table>
                 </div>
              )}
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
