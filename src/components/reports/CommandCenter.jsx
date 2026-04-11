import { useMemo, useState, useEffect } from 'react';
import { useOrders } from '../../contexts/OrderContext';
import { useAuth } from '../../contexts/AuthContext';
import { useSettings } from '../../contexts/SettingsContext';
import { useProducts } from '../../contexts/ProductContext';
import { formatCurrency } from '../../utils/formatters';
import { api } from '../../utils/api';
import { 
  Maximize, Minimize, TrendingUp, ShoppingBag, 
  MapPin, Activity, Award, ShoppingCart
} from 'lucide-react';
import { 
  AreaChart, Area, ResponsiveContainer, YAxis, XAxis, Tooltip
} from 'recharts';

export default function CommandCenter() {
  const { allSales, getTodayStats } = useOrders();
  const { products } = useProducts();
  const { settings } = useSettings();
  const [branches, setBranches] = useState([]);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [justSoldBranch, setJustSoldBranch] = useState(null);

  // Fetch branches for names/addresses
  useEffect(() => {
    api.get('/branches').then(setBranches).catch(console.error);
  }, []);

  // Detect new sales for visual "Pulse" effect on branch cards
  useEffect(() => {
    if (allSales.length > 0) {
      const topSale = allSales[0];
      setJustSoldBranch(topSale.branchId);
      const timer = setTimeout(() => setJustSoldBranch(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [allSales.length]);

  const stats = getTodayStats();

  // Branch Performance Analysis
  const branchPerformance = useMemo(() => {
    const map = {};
    const today = new Date().toDateString();

    allSales.forEach(t => {
      if (new Date(t.date).toDateString() !== today) return;
      if (!map[t.branchId]) {
        map[t.branchId] = { revenue: 0, orders: 0 };
      }
      map[t.branchId].revenue += t.total;
      map[t.branchId].orders += 1;
    });

    return branches.map(b => ({
      ...b,
      revenue: map[b.id]?.revenue || 0,
      orders: map[b.id]?.orders || 0,
      isLive: true // System is always heartbeating via OrderContext polling
    })).sort((a, b) => b.revenue - a.revenue);
  }, [allSales, branches]);

  // Global Sales Pulse Data (Hourly)
  const pulseData = useMemo(() => {
    const data = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (let h = 6; h <= 21; h++) {
      const hSales = allSales.filter(t => {
        const d = new Date(t.date);
        return d >= today && d.getHours() === h;
      });
      data.push({
        hour: h > 12 ? `${h - 12} PM` : h === 12 ? '12 PM' : `${h} AM`,
        revenue: hSales.reduce((sum, t) => sum + t.total, 0)
      });
    }
    return data;
  }, [allSales]);

  // Recent Ticker Items (double for smooth loop)
  const tickerItems = useMemo(() => {
      const items = allSales.slice(0, 10).map(t => ({
          branchName: branches.find(b => b.id === t.branchId)?.name || 'Branch',
          total: t.total,
          id: t.id
      }));
      return [...items, ...items];
  }, [allSales, branches]);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
      setIsFullscreen(true);
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
        setIsFullscreen(false);
      }
    }
  };

  return (
    <div className="tv-background">
      <button className="fullscreen-btn" onClick={toggleFullscreen}>
        {isFullscreen ? <Minimize size={24} /> : <Maximize size={24} />}
      </button>

      {/* Header Section */}
      <div className="tv-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
          <div className="sidebar-brand-icon" style={{ width: 80, height: 80, fontSize: '2.5rem' }}>🧁</div>
          <div>
            <h1 style={{ fontSize: '3rem', fontWeight: 900, color: '#fff' }}>MISSION CONTROL</h1>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'var(--success)', fontWeight: 800 }}>
              <div className="pulse-orb" /> LIVE EMPIRE MONITORING — {settings.storeName}
            </div>
          </div>
        </div>

        <div className="tv-global-stats">
          <div className="tv-revenue-label">Total Global Revenue Today</div>
          <div className="tv-main-revenue">{formatCurrency(stats.revenue)}</div>
          <div style={{ fontSize: '1.2rem', opacity: 0.6, fontWeight: 700 }}>
            <TrendingUp size={20} style={{ display: 'inline', marginRight: 8 }} />
            {stats.count} TRANSACTIONS PROCESSED ACROSS {branches.length} BRANCHES
          </div>
        </div>
      </div>

      {/* Empire Grid */}
      <div className="tv-grid">
        {branchPerformance.map((branch, index) => (
          <div 
            key={branch.id} 
            className={`tv-branch-card ${justSoldBranch === branch.id ? 'just-sold' : ''}`}
          >
            <div className="tv-rank-badge">RANK #{index + 1}</div>
            <div className="tv-branch-name">
              <MapPin size={24} style={{ color: index === 0 ? '#FFD700' : 'var(--accent)' }} />
              {branch.name}
            </div>
            <div className="tv-branch-revenue">
              {formatCurrency(branch.revenue)}
            </div>
            <div className="tv-branch-orders">
              {branch.orders} Orders {branch.orders > 0 && `(Avg ${formatCurrency(branch.revenue/branch.orders)})`}
            </div>
            
            <div style={{ marginTop: 15, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.8rem', color: 'var(--success)', fontWeight: 700 }}>
                <Activity size={14} /> ACTIVE
              </div>
              {index === 0 && <Award size={20} style={{ color: '#FFD700' }} />}
            </div>
          </div>
        ))}
      </div>

      {/* Pulse Pulse Chart */}
      <div style={{ background: 'rgba(0,0,0,0.2)', padding: 20, borderRadius: 24, border: '1px solid rgba(255,255,255,0.05)' }}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 20, textTransform: 'uppercase', letterSpacing: 2, fontSize: '0.9rem', opacity: 0.7 }}>
            <Activity size={18} /> Global Sales Velocity (24h)
        </div>
        <ResponsiveContainer width="100%" height={150}>
            <AreaChart data={pulseData}>
                <defs>
                    <linearGradient id="tvPulse" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#D4763C" stopOpacity={0.4} />
                        <stop offset="95%" stopColor="#D4763C" stopOpacity={0} />
                    </linearGradient>
                </defs>
                <XAxis dataKey="hour" hide />
                <YAxis hide />
                <Area type="monotone" dataKey="revenue" stroke="#D4763C" strokeWidth={4} fill="url(#tvPulse)" />
            </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Ticker Bar */}
      <div className="tv-ticker-bar">
        <div className="tv-ticker-content">
          {tickerItems.map((item, i) => (
            <div key={`${item.id}-${i}`} className="tv-ticker-item">
              <ShoppingCart size={18} style={{ color: 'var(--accent)' }} />
              <span>{item.branchName.toUpperCase()}</span>
              <span style={{ color: '#4CAF50' }}>+{formatCurrency(item.total)}</span>
              <span style={{ opacity: 0.2 }}>•</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
