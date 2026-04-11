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
  const { getTodayStats } = useOrders();
  const { products } = useProducts();
  const { settings } = useSettings();
  const [branches, setBranches] = useState([]);
  const [globalSales, setGlobalSales] = useState([]);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [justSoldBranch, setJustSoldBranch] = useState(null);
  
  // Achievement System
  const prevRanksRef = useRef({});
  const [rankedUpBranches, setRankedUpBranches] = useState({});

  // Master Background Fetcher: Truly Global Data (ignores user's current branch)
  useEffect(() => {
    const fetchGlobalData = async () => {
      try {
        const [tx, branchesData] = await Promise.all([
          api.get('/transactions?limit=500', { headers: { 'X-Branch-Id': 'all' } }),
          api.get('/branches')
        ]);
        setGlobalSales(tx || []);
        setBranches(branchesData || []);
      } catch (e) {
        console.error('[Mission Control Master Fetch Error]', e);
      }
    };
    
    fetchGlobalData();
    const interval = setInterval(fetchGlobalData, 10000); // 10s poll
    return () => clearInterval(interval);
  }, []);

  // Detect new sales for visual "Pulse" effect on branch cards
  useEffect(() => {
    if (globalSales.length > 0) {
      const topSale = globalSales[0];
      setJustSoldBranch(topSale.branchId);
      const timer = setTimeout(() => setJustSoldBranch(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [globalSales.length]);

  const stats = getTodayStats();

  // Identify Top 3 Products Globally for "Stock Panic" monitoring
  const globalTopProducts = useMemo(() => {
    const map = {};
    globalSales.slice(0, 500).forEach(t => {
      (t.items || []).forEach(item => {
        map[item.productId] = (map[item.productId] || 0) + item.quantity;
      });
    });
    return Object.entries(map)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(entry => entry[0]);
  }, [globalSales]);

  // Branch Performance Analysis
  const branchPerformance = useMemo(() => {
    const map = {};
    const today = new Date().toDateString();

    globalSales.forEach(t => {
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

    const finalData = currentRanks.map((b, index) => {
       // Handle NULL (Initial sync pending) gracefully
       const isSyncing = !b.lastSeen; 
       
       // Critical Stock Logic: Check if any top product is low at THIS branch
       const branchProducts = products.filter(p => p.branchId === b.id);
       const criticalProducts = branchProducts.filter(p => globalTopProducts.includes(p.id) && p.stock < 5);
       
       return { 
         ...b, 
         // Use server-side isOnline flag, but allow isSyncing to override for new branches
         isSyncing,
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
  }, [globalSales, branches, products, globalTopProducts]);

  // Global Sales Pulse Data (Hourly) - 24H Coverage
  const pulseMetrics = useMemo(() => {
    const data = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    let total = 0;

    for (let h = 0; h <= 23; h++) {
      const hSales = globalSales.filter(t => {
        const d = new Date(t.date);
        return d >= today && d.getHours() === h;
      });
      const revenue = hSales.reduce((sum, t) => sum + t.total, 0);
      total += revenue;
      
      data.push({
        hour: h,
        hourLabel: h > 12 ? `${h - 12} PM` : h === 12 ? '12 PM' : h === 0 ? '12 AM' : `${h} AM`,
        revenue
      });
    }
    return { data, total };
  }, [globalSales]);

  // Recent Ticker Items (double for smooth loop)
  const tickerItems = useMemo(() => {
      const items = globalSales.slice(0, 10).map(t => ({
          branchName: branches.find(b => b.id === t.branchId)?.name || 'Branch',
          total: t.total,
          id: t.id
      }));
      return [...items, ...items];
  }, [globalSales, branches]);

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
      <div className="tv-header" style={{ padding: '15px 30px', borderBottom: '1px solid rgba(255,255,255,0.05)', marginBottom: 15 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
          {settings.storeLogo ? (
            <img 
              src={settings.storeLogo} 
              alt="Logo" 
              style={{ 
                width: 60, 
                height: 60, 
                background: '#fff', 
                borderRadius: 12, 
                objectFit: 'contain', 
                padding: 4,
                boxShadow: '0 4px 12px rgba(0,0,0,0.3)'
              }} 
            />
          ) : (
            <div className="sidebar-brand-icon" style={{ width: 60, height: 60, fontSize: '2rem' }}>🧁</div>
          )}
          <div>
            <h1 style={{ fontSize: '2.2rem', fontWeight: 900, color: '#fff', letterSpacing: '-0.5px', marginBottom: 0 }}>MISSION CONTROL</h1>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'var(--success)', fontWeight: 800, fontSize: '0.9rem' }}>
              <div className="pulse-orb" style={{ width: 10, height: 10 }} /> LIVE EMPIRE MONITORING — {settings.storeName}
            </div>
          </div>
        </div>

        <div className="tv-global-stats" style={{ paddingRight: 20 }}>
          <div className="tv-revenue-label" style={{ fontSize: '1rem', opacity: 0.7 }}>Global Revenue Today</div>
          <div className="tv-main-revenue" style={{ fontSize: '3.8rem', lineHeight: 1 }}>{formatCurrency(stats.revenue)}</div>
          <div style={{ fontSize: '1rem', opacity: 0.6, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 8 }}>
            <TrendingUp size={18} style={{ color: 'var(--success)' }} />
            {stats.count.toLocaleString()} TRANSACTIONS
          </div>
        </div>
      </div>

      {/* Empire Grid */}
      <div className="tv-grid" style={{ padding: '0 15px', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 15, flex: 1, overflow: 'hidden' }}>
        {branchPerformance.map((branch, index) => (
          <div 
            key={branch.id} 
            className={`tv-branch-card 
              ${justSoldBranch === branch.id ? 'just-sold' : ''} 
              ${branch.isOnline ? 'card-online' : ''} 
              ${branch.criticalStock ? 'panic-stock' : ''}
              ${rankedUpBranches[branch.id] ? 'ranked-up' : ''}
            `}
            style={{ 
               opacity: 1, 
               filter: !branch.isOnline ? 'grayscale(0.8) opacity(0.6)' : 'none',
               padding: 15,
               borderRadius: 12,
               minHeight: 130,
               border: !branch.isOnline ? '1px dashed rgba(255,255,255,0.1)' : '1px solid rgba(0,255,0,0.3)'
            }}
          >
            <div className="tv-rank-badge" style={{ fontSize: '0.7rem', padding: '3px 8px', top: 10, right: 10 }}>RANK #{branch.rank}</div>
            
            {rankedUpBranches[branch.id] && (
               <div className="rank-up-tag" style={{ fontSize: '0.7rem', padding: '3px 10px' }}>
                 <Zap size={12} fill="currentColor" /> UP!
               </div>
            )}

            <div className="tv-branch-name" style={{ fontSize: '1.2rem', marginBottom: 5, gap: 10, display: 'flex', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <MapPin size={18} style={{ color: index === 0 ? '#FFD700' : 'var(--accent)' }} />
                {branch.name}
              </div>
              {rankedUpBranches[branch.id] && (
                 <div className="rank-up-badge-mini">
                   <Zap size={12} fill="currentColor" /> RISE!
                 </div>
              )}
            </div>

            <div className="tv-branch-revenue" style={{ fontSize: '2.4rem', fontWeight: 900, marginBottom: 2 }}>
              {formatCurrency(branch.revenue)}
            </div>
            <div className="tv-branch-orders" style={{ fontSize: '0.9rem', opacity: 0.5, fontWeight: 600 }}>
              {branch.orders} Orders • Avg {formatCurrency(branch.orders > 0 ? branch.revenue/branch.orders : 0)}
            </div>
            
            <div style={{ marginTop: 15, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {branch.isOnline ? (
                   <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                     <div className="vivid-signal" />
                     <div style={{ background: '#00ff00', color: '#000', padding: '3px 10px', borderRadius: 6, fontWeight: 900, fontSize: '0.9rem', letterSpacing: 1 }}>CONNECTED</div>
                     <span style={{ color: '#00ff00', fontSize: '0.8rem', fontWeight: 800 }}>{branch.lastSeenSecondsAgo < 10 ? 'INSTANT' : `${branch.lastSeenSecondsAgo}s`}</span>
                   </div>
                ) : branch.isSyncing ? (
                  <div style={{ color: 'var(--info)', display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.8rem', fontWeight: 800 }}>
                    <Activity size={14} className="spinning" /> SYNCING
                  </div>
                ) : (
                  <div style={{ color: 'rgba(255,255,255,0.3)', display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.8rem', fontWeight: 800 }}>
                    <WifiOff size={14} /> OFFLINE
                  </div>
                )}
                {branch.criticalStock && !branch.isOffline && (
                   <div className="stock-warning-badge" style={{ fontSize: '0.7rem', padding: '3px 8px' }}>
                     STOCK!
                   </div>
                )}
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                {branch.isOnline && <Award size={22} style={{ color: '#FFD700' }} />}
                <div className="tv-rank-pill">#{branch.rank}</div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Global Sales Activity (Empire Pulse) */}
      <div style={{ background: 'rgba(0,0,0,0.3)', padding: '15px 30px', borderRadius: 20, border: '1px solid rgba(255,255,255,0.05)', margin: '10px 15px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', textTransform: 'uppercase', letterSpacing: 2, fontSize: '0.8rem', fontWeight: 800, opacity: 0.6 }}>
              <Activity size={16} style={{ color: 'var(--accent)' }} /> Global Daily Sales Activity
          </div>
          <div style={{ color: 'var(--success)', fontWeight: 900, fontSize: '1rem', textShadow: '0 0 10px rgba(0,255,0,0.3)' }}>
             TOTAL Today: <span style={{ fontSize: '1.2rem' }}>{formatCurrency(pulseMetrics.total)}</span>
          </div>
        </div>
        <ResponsiveContainer width="100%" height={100}>
            <AreaChart data={pulseMetrics.data}>
                <defs>
                    <linearGradient id="tvPulse" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#D4763C" stopOpacity={0.4} />
                        <stop offset="95%" stopColor="#D4763C" stopOpacity={0} />
                    </linearGradient>
                </defs>
                <XAxis 
                  dataKey="hourLabel" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: '#fff', fontSize: 10, opacity: 0.4 }} 
                  interval={3} 
                />
                <YAxis hide domain={[0, 'auto']} />
                <Tooltip 
                  contentStyle={{ background: '#2C1810', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8 }}
                  itemStyle={{ color: '#fff' }}
                />
                <Area type="monotone" dataKey="revenue" stroke="#D4763C" strokeWidth={3} fill="url(#tvPulse)" />
            </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Ticker Bar */}
      <div className="tv-ticker-bar" style={{ height: 40, borderRadius: 20, margin: '5px 15px 15px' }}>
        <div className="tv-ticker-content" style={{ gap: 50, fontSize: '1rem' }}>
          {tickerItems.map((item, i) => (
            <div key={`${item.id}-${i}`} className="tv-ticker-item">
              <ShoppingCart size={16} style={{ color: 'var(--accent)' }} />
              <span style={{ letterSpacing: 0.5 }}>{item.branchName.toUpperCase()}</span>
              <span style={{ color: '#4CAF50', fontWeight: 800 }}>{formatCurrency(item.total)}</span>
              <span style={{ opacity: 0.2 }}>|</span>
            </div>
          ))}
        </div>
      </div>

      <style jsx>{`
         .vivid-signal {
            width: 14px;
            height: 14px;
            background: #00ff00;
            border-radius: 50%;
            box-shadow: 0 0 15px #00ff00;
            animation: pulse-signal 0.8s infinite alternate;
         }
         .card-online {
            border-color: rgba(0, 255, 0, 0.4) !important;
            background: linear-gradient(135deg, rgba(255,255,255,0.05) 0%, rgba(0,255,0,0.03) 100%) !important;
            box-shadow: 0 0 20px rgba(0, 255, 0, 0.1);
         }
         @keyframes pulse-signal {
            from { opacity: 0.4; transform: scale(0.8); }
            to { opacity: 1; transform: scale(1.2); }
         }
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
         .tv-rank-pill {
            background: rgba(255,255,255,0.1);
            color: #fff;
            padding: 4px 12px;
            border-radius: 200px;
            font-size: 0.8rem;
            font-weight: 900;
            border: 1px solid rgba(255,255,255,0.1);
         }
         .rank-up-badge-mini {
            background: #FFD700;
            color: #2C1810;
            padding: 2px 8px;
            border-radius: 6px;
            font-size: 0.7rem;
            font-weight: 900;
            display: flex;
            align-items: center;
            gap: 4px;
            animation: bounce-rank 0.4s ease-out;
         }
         @keyframes bounce-rank {
            0% { transform: scale(0.5); opacity: 0; }
            50% { transform: scale(1.2); }
            100% { transform: scale(1); opacity: 1; }
         }
      `}</style>
    </div>
  );
}
