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

  // Fetch branches for names/addresses + polling for heartbeats
  useEffect(() => {
    const fetchBranches = () => {
      api.get('/branches').then(setBranches).catch(console.error);
    };
    
    fetchBranches();
    const bInterval = setInterval(fetchBranches, 10000); // Poll every 10s for heartbeats
    return () => clearInterval(bInterval);
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
    allSales.slice(0, 500).forEach(t => {
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
       
       // Handle NULL (Initial sync pending) gracefully
       const isRecentlyCreated = !b.lastSeen; 
       const isOffline = !isRecentlyCreated && (now - lastSeenDate > 300000); // 5 mins
       
       // Critical Stock Logic: Check if any top product is low at THIS branch
       const branchProducts = products.filter(p => p.branchId === b.id);
       const criticalProducts = branchProducts.filter(p => globalTopProducts.includes(p.id) && p.stock < 5);
       
       return { 
         ...b, 
         isOffline, 
         isSyncing: isRecentlyCreated,
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
        <div style={{ display: 'flex', alignItems: 'center', gap: 30 }}>
          {settings.storeLogo ? (
            <img 
              src={settings.storeLogo} 
              alt="Logo" 
              style={{ 
                width: 120, 
                height: 120, 
                background: '#fff', 
                borderRadius: 24, 
                objectFit: 'contain', 
                padding: 10,
                boxShadow: '0 8px 32px rgba(0,0,0,0.3)'
              }} 
            />
          ) : (
            <div className="sidebar-brand-icon" style={{ width: 100, height: 100, fontSize: '3.5rem' }}>🧁</div>
          )}
          <div>
            <h1 style={{ fontSize: '4rem', fontWeight: 900, color: '#fff', letterSpacing: '-1px' }}>MISSION CONTROL</h1>
            <div style={{ display: 'flex', alignItems: 'center', gap: 15, color: 'var(--success)', fontWeight: 800, fontSize: '1.2rem' }}>
              <div className="pulse-orb" style={{ width: 15, height: 15 }} /> LIVE EMPIRE MONITORING — {settings.storeName}
            </div>
          </div>
        </div>

        <div className="tv-global-stats" style={{ paddingRight: 40 }}>
          <div className="tv-revenue-label" style={{ fontSize: '1.5rem' }}>Total Global Revenue Today</div>
          <div className="tv-main-revenue" style={{ fontSize: '7rem' }}>{formatCurrency(stats.revenue)}</div>
          <div style={{ fontSize: '1.5rem', opacity: 0.8, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 10 }}>
            <TrendingUp size={28} style={{ color: 'var(--success)' }} />
            {stats.count.toLocaleString()} TRANSACTIONS PROCESSED TOTAL
          </div>
        </div>
      </div>

      {/* Empire Grid */}
      <div className="tv-grid" style={{ padding: '0 20px', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: 30 }}>
        {branchPerformance.map((branch, index) => (
          <div 
            key={branch.id} 
            className={`tv-branch-card 
              ${justSoldBranch === branch.id ? 'just-sold' : ''} 
              ${branch.isOffline ? 'is-offline' : ''} 
              ${branch.criticalStock ? 'panic-stock' : ''}
              ${rankedUpBranches[branch.id] ? 'ranked-up' : ''}
            `}
            style={{ 
               opacity: 1, 
               filter: branch.isOffline ? 'grayscale(0.8) opacity(0.7)' : 'none',
               padding: 35,
               borderRadius: 24,
               minHeight: 220,
               border: branch.isOffline ? '1px dashed rgba(255,255,255,0.2)' : undefined
            }}
          >
            <div className="tv-rank-badge" style={{ fontSize: '1rem', padding: '6px 14px' }}>RANK #{branch.rank}</div>
            
            {rankedUpBranches[branch.id] && (
               <div className="rank-up-tag" style={{ fontSize: '1rem', padding: '6px 18px' }}>
                 <Zap size={18} fill="currentColor" /> RANK UP!
               </div>
            )}

            <div className="tv-branch-name" style={{ fontSize: '2rem', marginBottom: 15 }}>
              <MapPin size={32} style={{ color: index === 0 ? '#FFD700' : 'var(--accent)' }} />
              {branch.name}
            </div>

            {branch.isOffline ? (
               <div style={{ color: 'var(--danger)', display: 'flex', alignItems: 'center', gap: 12, fontSize: '1.8rem', fontWeight: 900, margin: '15px 0' }}>
                 <WifiOff size={32} /> CONNECTION LOST
               </div>
            ) : branch.isSyncing ? (
               <div style={{ color: 'var(--info)', display: 'flex', alignItems: 'center', gap: 12, fontSize: '1.8rem', fontWeight: 900, margin: '15px 0' }}>
                 <Activity size={32} className="spinning" /> PENDING SYNC...
               </div>
            ) : (
               <>
                 <div className="tv-branch-revenue" style={{ fontSize: '3.5rem' }}>
                   {formatCurrency(branch.revenue)}
                 </div>
                 <div className="tv-branch-orders" style={{ fontSize: '1.3rem', opacity: 0.6 }}>
                   {branch.orders} Orders • Avg {formatCurrency(branch.orders > 0 ? branch.revenue/branch.orders : 0)}
                 </div>
               </>
            )}
            
            <div style={{ marginTop: 25, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              {!branch.isOffline && !branch.isSyncing ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: '1.1rem', color: 'var(--success)', fontWeight: 800 }}>
                  <Activity size={20} /> LIVE ACTIVITY
                </div>
              ) : (
                <div style={{ fontSize: '1rem', opacity: 0.5 }}>Network Monitoring</div>
              )}

              {branch.criticalStock && !branch.isOffline && (
                 <div className="stock-warning-badge" style={{ fontSize: '1rem', padding: '8px 16px' }}>
                   <AlertTriangle size={18} /> STOCK ALERT: {branch.criticalStock[0].name}
                 </div>
              )}

              {index === 0 && !branch.isOffline && !branch.isSyncing && <Award size={32} style={{ color: '#FFD700' }} />}
            </div>
          </div>
        ))}
      </div>

      {/* Global Sales Pulse Chart */}
      <div style={{ background: 'rgba(0,0,0,0.3)', padding: 40, borderRadius: 32, border: '1px solid rgba(255,255,255,0.08)', margin: '0 20px' }}>
        <div style={{ display: 'flex', gap: 15, alignItems: 'center', marginBottom: 25, textTransform: 'uppercase', letterSpacing: 4, fontSize: '1.2rem', fontWeight: 800, opacity: 0.8 }}>
            <Activity size={24} style={{ color: 'var(--accent)' }} /> Global Empire Pulse (Hourly Performance)
        </div>
        <ResponsiveContainer width="100%" height={240}>
            <AreaChart data={pulseData}>
                <defs>
                    <linearGradient id="tvPulse" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#D4763C" stopOpacity={0.6} />
                        <stop offset="95%" stopColor="#D4763C" stopOpacity={0} />
                    </linearGradient>
                </defs>
                <XAxis dataKey="hour" stroke="rgba(255,255,255,0.3)" fontSize={14} tickLine={false} axisLine={false} />
                <YAxis hide domain={[0, 'auto']} />
                <Area type="monotone" dataKey="revenue" stroke="#D4763C" strokeWidth={6} fill="url(#tvPulse)" />
            </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Ticker Bar */}
      <div className="tv-ticker-bar" style={{ height: 80, borderRadius: 40, margin: '10px 20px 0' }}>
        <div className="tv-ticker-content" style={{ gap: 80, fontSize: '1.4rem' }}>
          {tickerItems.map((item, i) => (
            <div key={`${item.id}-${i}`} className="tv-ticker-item">
              <ShoppingCart size={24} style={{ color: 'var(--accent)' }} />
              <span style={{ letterSpacing: 1 }}>{item.branchName.toUpperCase()}</span>
              <span style={{ color: '#4CAF50', fontWeight: 900 }}>{formatCurrency(item.total)}</span>
              <span style={{ opacity: 0.3 }}>|</span>
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
