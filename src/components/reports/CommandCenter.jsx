import { useMemo, useState, useEffect, useRef } from 'react';
import { useOrders } from '../../contexts/OrderContext';
import { useAuth } from '../../contexts/AuthContext';
import { useSettings } from '../../contexts/SettingsContext';
import { useProducts } from '../../contexts/ProductContext';
import { formatCurrency } from '../../utils/formatters';
import { api } from '../../utils/api';
import { 
  Maximize, Minimize, TrendingUp, ShoppingBag, 
  MapPin, Activity, Award, ShoppingCart, 
  WifiOff, AlertTriangle, Zap
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
  
  // Achievement System
  const prevRanksRef = useRef({});
  const [rankedUpBranches, setRankedUpBranches] = useState({});

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

  // Identify Top 3 Products Globally for "Stock Panic" monitoring
  const globalTopProducts = useMemo(() => {
    const map = {};
    allSales.slice(0, 200).forEach(t => {
      (t.items || []).forEach(item => {
        map[item.productId] = (map[item.productId] || 0) + item.quantity;
      });
    });
    return Object.entries(map)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(entry => entry[0]);
  }, [allSales]);

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

    const currentRanks = branches.map(b => ({
      ...b,
      revenue: map[b.id]?.revenue || 0,
      orders: map[b.id]?.orders || 0,
    })).sort((a, b) => b.revenue - a.revenue);

    // Connectivity & Stock Alert Logic
    const now = new Date();
    const finalData = currentRanks.map((b, index) => {
       const lastSeenDate = b.lastSeen ? new Date(b.lastSeen) : null;
       const isOffline = !lastSeenDate || (now - lastSeenDate > 300000); // 5 mins
       
       // Critical Stock Logic: Check if any top product is low at THIS branch
       const branchProducts = products.filter(p => p.branchId === b.id);
       const criticalProducts = branchProducts.filter(p => globalTopProducts.includes(p.id) && p.stock < 5);
       
       return { 
         ...b, 
         isOffline, 
         criticalStock: criticalProducts.length > 0 ? criticalProducts : null,
         rank: index + 1
       };
    });

    // Detect Rank-Ups
    const rankChanges = {};
    finalData.forEach(b => {
      const prevRank = prevRanksRef.current[b.id];
      if (prevRank && b.rank < prevRank) {
        rankChanges[b.id] = true;
      }
      prevRanksRef.current[b.id] = b.rank;
    });

    if (Object.keys(rankChanges).length > 0) {
       setRankedUpBranches(prev => ({ ...prev, ...rankChanges }));
       setTimeout(() => {
         setRankedUpBranches(prev => {
           const next = { ...prev };
           Object.keys(rankChanges).forEach(id => delete next[id]);
           return next;
         });
       }, 5000);
    }

    return finalData;
  }, [allSales, branches, products, globalTopProducts]);

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
            className={`tv-branch-card 
              ${justSoldBranch === branch.id ? 'just-sold' : ''} 
              ${branch.isOffline ? 'is-offline' : ''} 
              ${branch.criticalStock ? 'panic-stock' : ''}
              ${rankedUpBranches[branch.id] ? 'ranked-up' : ''}
            `}
            style={{ opacity: branch.isOffline ? 0.4 : 1 }}
          >
            <div className="tv-rank-badge">RANK #{branch.rank}</div>
            
            {rankedUpBranches[branch.id] && (
               <div className="rank-up-tag">
                 <Zap size={14} fill="currentColor" /> RANK UP!
               </div>
            )}

            <div className="tv-branch-name">
              <MapPin size={24} style={{ color: index === 0 ? '#FFD700' : 'var(--accent)' }} />
              {branch.name}
            </div>

            {branch.isOffline ? (
               <div style={{ color: 'var(--danger)', display: 'flex', alignItems: 'center', gap: 8, fontSize: '1.4rem', fontWeight: 900, margin: '10px 0' }}>
                 <WifiOff size={24} /> CONNECTION LOST
               </div>
            ) : (
               <>
                 <div className="tv-branch-revenue">
                   {formatCurrency(branch.revenue)}
                 </div>
                 <div className="tv-branch-orders">
                   {branch.orders} Orders {branch.orders > 0 && `(Avg ${formatCurrency(branch.revenue/branch.orders)})`}
                 </div>
               </>
            )}
            
            <div style={{ marginTop: 15, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              {!branch.isOffline ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.8rem', color: 'var(--success)', fontWeight: 700 }}>
                  <Activity size={14} /> ACTIVE
                </div>
              ) : (
                <div style={{ fontSize: '0.8rem', opacity: 0.5 }}>Check Internet</div>
              )}

              {branch.criticalStock && !branch.isOffline && (
                 <div className="stock-warning-badge">
                   <AlertTriangle size={14} /> LOW STOCK: {branch.criticalStock[0].name}
                 </div>
              )}

              {index === 0 && !branch.isOffline && <Award size={20} style={{ color: '#FFD700' }} />}
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

      <style jsx>{`
         .panic-stock {
            border-color: var(--danger) !important;
            background: rgba(231, 76, 60, 0.1) !important;
            animation: pulse-panic 1.5s infinite;
         }
         @keyframes pulse-panic {
            0% { box-shadow: 0 0 0 0 rgba(231, 76, 60, 0.4); }
            70% { box-shadow: 0 0 0 15px rgba(231, 76, 60, 0); }
            100% { box-shadow: 0 0 0 0 rgba(231, 76, 60, 0); }
         }
         .stock-warning-badge {
            background: var(--danger);
            color: white;
            padding: 4px 10px;
            border-radius: 8px;
            font-size: 0.75rem;
            font-weight: 800;
            display: flex;
            align-items: center;
            gap: 6px;
            animation: bounce-alert 0.5s infinite alternate;
         }
         @keyframes bounce-alert {
            to { transform: translateY(-4px); }
         }
         .ranked-up {
            border-color: #FFD700 !important;
            background: rgba(255, 215, 0, 0.1) !important;
         }
         .rank-up-tag {
            position: absolute;
            top: -10px;
            left: 50%;
            transform: translateX(-50%);
            background: #FFD700;
            color: #2C1810;
            padding: 4px 12px;
            border-radius: 12px;
            font-size: 0.8rem;
            font-weight: 900;
            display: flex;
            align-items: center;
            gap: 4px;
            box-shadow: 0 4px 12px rgba(255, 215, 0, 0.3);
            z-index: 10;
            animation: slide-up-rank 0.4s ease-out;
         }
         @keyframes slide-up-rank {
            from { transform: translate(-50%, 20px); opacity: 0; }
            to { transform: translate(-50%, 0); opacity: 1; }
         }
      `}</style>
    </div>
  );
}
