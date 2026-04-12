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
  Wifi, WifiOff, AlertTriangle, Zap
} from 'lucide-react';
import { 
  AreaChart, Area, ResponsiveContainer, YAxis, XAxis, Tooltip
} from 'recharts';

export default function CommandCenter() {
  const { getTodayStats } = useOrders();
  const { products, getLowStockProducts, refetch } = useProducts();
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
        
        // Background refresh products to ensure low-stock alerts are "live"
        await refetch();
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

  const globalLowStock = useMemo(() => {
    return getLowStockProducts().map(p => ({
      ...p,
      branchName: branches.find(b => b.id === p.branchId)?.name || 'Unknown'
    }));
  }, [products, branches, getLowStockProducts]);

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
       const isSyncing = (b.lastSeenSecondsAgo === null); 
       
       // Use unified low-stock logic instead of hardcoded < 5 rule
       const criticalProducts = globalLowStock.filter(p => p.branchId === b.id);
       
       return { 
         ...b, 
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
  }, [globalSales, branches, products]);

  // Global Sales Pulse Data (Hourly)
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

  const tickerItems = useMemo(() => {
      const sales = globalSales.slice(0, 10).map(t => ({
          branchName: branches.find(b => b.id === t.branchId)?.name || 'Branch',
          total: t.total,
          id: t.id,
          type: 'sale'
      }));

      const alerts = globalLowStock.slice(0, 5).map(p => ({
          branchName: p.branchName,
          itemName: p.name,
          emoji: p.emoji || '⚠️',
          id: p.id,
          type: 'alert'
      }));

      const combined = [...sales, ...alerts];
      return [...combined, ...combined];
  }, [globalSales, branches, globalLowStock]);

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

      <div className="tv-header" style={{ padding: '15px 30px', borderBottom: '1px solid rgba(255,255,255,0.05)', marginBottom: 15 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
          {settings.storeLogo ? (
            <img 
              src={settings.storeLogo} 
              alt="Logo" 
              style={{ width: 60, height: 60, background: '#fff', borderRadius: 12, objectFit: 'contain', padding: 4, boxShadow: '0 4px 12px rgba(0,0,0,0.3)' }} 
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

      {globalLowStock.length > 0 && (
        <div className="tv-inventory-alert-bar">
          <div className="alert-badge"><AlertTriangle size={20} /> INVENTORY WAR ROOM</div>
          <div className="alert-content">
             {globalLowStock.slice(0, 8).map(p => (
               <div key={p.id} className="alert-item">
                 <span>{p.emoji}</span>
                 <span className="name">{p.name}</span>
                 <span className="branch">@{p.branchName}</span>
                 <span className="level">STOCK: {p.stock}</span>
               </div>
             ))}
             {globalLowStock.length > 8 && (
               <div className="alert-more">+{globalLowStock.length - 8} MORE CRITICAL</div>
             )}
          </div>
        </div>
      )}

      <div className="tv-grid" style={{ padding: '0 15px', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 15, flex: 1, overflow: 'hidden' }}>
        {branchPerformance.map((branch, index) => (
          <div 
            key={branch.id} 
            className={`tv-branch-card ${justSoldBranch === branch.id ? 'just-sold' : ''} ${branch.isOnline ? 'card-online-neon' : ''} ${rankedUpBranches[branch.id] ? 'ranked-up' : ''}`}
            style={{ padding: 15, borderRadius: 12, minHeight: 130, border: !branch.isOnline ? '1px dashed rgba(255,255,255,0.1)' : '1px solid #00ff00' }}
          >
            <div className="tv-rank-badge" style={{ fontSize: '0.7rem', padding: '3px 8px', top: 10, right: 10 }}>RANK #{branch.rank}</div>
            
            <div className="tv-branch-name" style={{ fontSize: '1.2rem', marginBottom: 5, gap: 10, display: 'flex', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <MapPin size={18} style={{ color: index === 0 ? '#FFD700' : 'var(--accent)' }} />
                {branch.name}
                {branch.isOnline && <Award size={18} style={{ color: '#FFD700', marginLeft: 4 }} />}
              </div>
            </div>

            <div className="tv-branch-revenue" style={{ fontSize: '2.4rem', fontWeight: 900, marginBottom: 2 }}>
              {formatCurrency(branch.revenue)}
            </div>
            <div className="tv-branch-orders" style={{ fontSize: '0.9rem', opacity: 0.5, fontWeight: 600 }}>
              {branch.orders} Orders • Avg {formatCurrency(branch.orders > 0 ? branch.revenue/branch.orders : 0)}
            </div>
            
            <div style={{ marginTop: 15, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {branch.isSyncing && (
                  <div style={{ color: 'var(--info)', display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.8rem', fontWeight: 800 }}>
                    <Activity size={14} className="spinning" /> SYNCING
                  </div>
                )}
                {branch.criticalStock && (
                  <div className="stock-warning-badge" style={{ fontSize: '0.7rem', padding: '3px 8px' }}>
                    STOCK!
                  </div>
                )}
              </div>

              <div style={{ 
                background: branch.isOnline ? 'rgba(0, 255, 0, 0.1)' : 'rgba(255, 255, 255, 0.05)',
                color: branch.isOnline ? '#00ff00' : 'rgba(255, 255, 255, 0.3)',
                padding: '6px 12px', borderRadius: 12, fontSize: '0.8rem', fontWeight: 900,
                display: 'flex', alignItems: 'center', gap: 10,
                border: branch.isOnline ? '1px solid rgba(0, 255, 0, 0.3)' : '1px solid rgba(255, 255, 255, 0.1)',
                boxShadow: branch.isOnline ? '0 0 15px rgba(0, 255, 0, 0.1)' : 'none',
                minWidth: 100
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {branch.isOnline ? (
                    <Wifi size={18} className="pulse-fast" />
                  ) : (
                    <WifiOff size={18} />
                  )}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1 }}>
                  <span style={{ fontSize: '0.9rem', marginBottom: 2 }}>
                    {branch.isOnline ? (branch.lastSeenSecondsAgo < 1 ? '<1s' : `${branch.lastSeenSecondsAgo}s`) : 'OFF'}
                  </span>
                  <span style={{ fontSize: '0.6rem', opacity: 0.5, letterSpacing: 1 }}>
                    {branch.isOnline ? 'SYNC' : 'LAST SEEN'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

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
                <XAxis dataKey="hourLabel" axisLine={false} tickLine={false} tick={{ fill: '#fff', fontSize: 10, opacity: 0.4 }} interval={3} />
                <YAxis hide domain={[0, 'auto']} />
                <Tooltip contentStyle={{ background: '#2C1810', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8 }} itemStyle={{ color: '#fff' }} />
                <Area type="monotone" dataKey="revenue" stroke="#D4763C" strokeWidth={3} fill="url(#tvPulse)" />
            </AreaChart>
        </ResponsiveContainer>
      </div>

       <div className="tv-ticker-bar" style={{ height: 40, borderRadius: 20, margin: '5px 15px 15px' }}>
        <div className="tv-ticker-content" style={{ gap: 50, fontSize: '1rem' }}>
          {tickerItems.map((item, i) => (
            <div key={`${item.id}-${i}`} className="tv-ticker-item">
              {item.type === 'alert' ? (
                <>
                  <AlertTriangle size={16} style={{ color: 'var(--danger)' }} />
                  <span style={{ color: 'var(--danger)', fontWeight: 800 }}>LOW STOCK: {item.itemName.toUpperCase()}</span>
                  <span style={{ opacity: 0.6 }}>@ {item.branchName.toUpperCase()}</span>
                </>
              ) : (
                <>
                  <ShoppingCart size={16} style={{ color: 'var(--accent)' }} />
                  <span style={{ letterSpacing: 0.5 }}>{item.branchName.toUpperCase()}</span>
                  <span style={{ color: '#4CAF50', fontWeight: 800 }}>{formatCurrency(item.total)}</span>
                </>
              )}
              <span style={{ opacity: 0.2 }}>|</span>
            </div>
          ))}
        </div>
      </div>

       <style jsx>{`
         .tv-inventory-alert-bar {
           background: rgba(43, 8, 8, 0.5);
           border: 2px solid #ff4444;
           margin: 0 15px 15px;
           border-radius: 12px;
           padding: 12px 20px;
           display: flex;
           align-items: center;
           gap: 20px;
           animation: alert-panic-pulse 2s infinite;
           box-shadow: 0 0 30px rgba(255,0,0,0.2);
         }
         .alert-badge {
           background: #ff4444;
           color: white;
           padding: 6px 12px;
           border-radius: 8px;
           font-weight: 900;
           font-size: 0.9rem;
           display: flex;
           align-items: center;
           gap: 8px;
           white-space: nowrap;
         }
         .alert-content { display: flex; gap: 20px; overflow: hidden; flex: 1; }
         .alert-item {
           display: flex;
           align-items: center;
           gap: 8px;
           background: rgba(0,0,0,0.3);
           padding: 4px 12px;
           border-radius: 6px;
           border: 1px solid rgba(255,255,255,0.1);
           white-space: nowrap;
         }
         .alert-item .name { font-weight: 700; color: #fff; }
         .alert-item .branch { font-size: 0.8rem; color: #ffaa00; font-weight: 800; }
         .alert-item .level { font-size: 0.8rem; font-weight: 900; color: #ff4444; }
         .alert-more { font-weight: 800; color: #fff; opacity: 0.6; font-size: 0.9rem; }

         @keyframes alert-panic-pulse {
           0% { border-color: #ff4444; box-shadow: 0 0 10px rgba(255,0,0,0.3); }
           50% { border-color: #ff0000; box-shadow: 0 0 30px rgba(255,0,0,0.6); }
           100% { border-color: #ff4444; box-shadow: 0 0 10px rgba(255,0,0,0.3); }
         }

         .panic-stock { border-color: var(--danger) !important; background: rgba(231, 76, 60, 0.1) !important; animation: pulse-panic 1.5s infinite; }
         @keyframes pulse-panic { 0% { box-shadow: 0 0 0 0 rgba(231, 76, 60, 0.4); } 70% { box-shadow: 0 0 0 15px rgba(231, 76, 60, 0); } 100% { box-shadow: 0 0 0 0 rgba(231, 76, 60, 0); } }
         .stock-warning-badge { background: var(--danger); color: white; padding: 4px 10px; border-radius: 8px; font-size: 0.75rem; font-weight: 800; display: flex; align-items: center; gap: 6px; animation: bounce-alert 0.5s infinite alternate; }
         @keyframes bounce-alert { to { transform: translateY(-4px); } }
         .ranked-up { border-color: #FFD700 !important; background: rgba(255, 215, 0, 0.1) !important; }
         .tv-rank-pill { background: rgba(255,255,255,0.1); color: #fff; padding: 4px 12px; border-radius: 200px; font-size: 0.8rem; font-weight: 900; border: 1px solid rgba(255,255,255,0.1); }
         .pulse-fast { animation: pulse-wifi 1s infinite; }
         @keyframes pulse-wifi { 0% { opacity: 1; transform: scale(1); } 50% { opacity: 0.5; transform: scale(0.9); } 100% { opacity: 1; transform: scale(1); } }
      `}</style>
    </div>
  );
}
