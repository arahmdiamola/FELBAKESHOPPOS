import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  TrendingUp, TrendingDown, ShoppingCart, Users, Award, 
  MapPin, Wifi, WifiOff, Activity, AlertTriangle, Zap,
  ShoppingBag, Minimize, Maximize, Clock, Shield,
  ChevronRight, ArrowRight, Pizza
} from 'lucide-react';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, 
  ResponsiveContainer, BarChart, Bar, Cell 
} from 'recharts';
import { formatCurrency } from '../../utils/formatters';
import { api } from '../../utils/api';
import { useOrders } from '../../contexts/OrderContext';
import { useProducts } from '../../contexts/ProductContext';
import { useSettings } from '../../contexts/SettingsContext';
import { useAuth } from '../../contexts/AuthContext';

export default function CommandCenter({ isPublic = false }) {
  const { getTodayStats } = useOrders();
  const { products, getLowStockProducts, refetch } = useProducts();
  const { settings } = useSettings();
  const { currentUser } = useAuth();
  const [branches, setBranches] = useState([]);
  const [globalSales, setGlobalSales] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [ruinedProduction, setRuinedProduction] = useState([]);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [justSoldBranch, setJustSoldBranch] = useState(null);
  const [activeSlide, setActiveSlide] = useState(1);
  const [activeProduction, setActiveProduction] = useState([]);
  
  // Achievement System
  const prevRanksRef = useRef({});
  const [rankedUpBranches, setRankedUpBranches] = useState({});

  // Slide Switcher
  useEffect(() => {
    const slideInterval = setInterval(() => {
      setActiveSlide(prev => (prev === 1 ? 2 : 1));
    }, 15000);
    return () => clearInterval(slideInterval);
  }, []);

  // Master Background Fetcher: Truly Global Data
  useEffect(() => {
    const fetchGlobalData = async () => {
      try {
        const headers = { 
          'X-Branch-Id': 'all',
          'X-User-Role': 'system_admin' // Force full access for dashboard
        };

        const [tx, branchesData, prodData] = await Promise.all([
          api.get('/transactions?limit=500', { headers }),
          api.get('/branches', { headers }),
          api.get('/production/logs?status=in_oven', { headers })
        ]);

        setGlobalSales(tx || []);
        setBranches(branchesData || []);
        setActiveProduction(prodData || []);
        
        // Secure-only fetching
        if (!isPublic) {
          const [logs, ruinedData] = await Promise.all([
            api.get('/logs?limit=50', { headers }),
            api.get('/production/logs?status=ruined', { headers })
          ]);
          setAuditLogs(logs || []);
          setRuinedProduction(ruinedData || []);
        }

        await refetch();
      } catch (e) {
        console.error('[Mission Control Master Fetch Error]', e);
      }
    };
    
    fetchGlobalData();
    const interval = setInterval(fetchGlobalData, 10000);
    return () => clearInterval(interval);
  }, [isPublic, refetch]);

  // Calculations for Loss
  const lossStats = useMemo(() => {
    if (isPublic) return null;
    
    let totalSunkCost = 0;
    let totalPotentialLoss = 0;

    ruinedProduction.forEach(log => {
      // Sunk Cost: Sum of material costs
      const materialCost = log.items?.reduce((sum, item) => sum + (item.costPrice || 0) * item.quantityUsed, 0) || 0;
      totalSunkCost += materialCost;

      // Potential Loss: Retail price * quantity
      const product = products.find(p => p.id === log.productId);
      const retailPrice = product?.price || 0;
      totalPotentialLoss += retailPrice * (log.quantityProduced || log.estimatedYield || 0);
    });

    return { totalSunkCost, totalPotentialLoss };
  }, [ruinedProduction, products, isPublic]);

  // Detect new sales
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
       const isSyncing = (b.last_seen_seconds_ago === null); 
       const criticalProducts = globalLowStock.filter(p => p.branchId === b.id);
       const batchesInOven = activeProduction.filter(p => p.branchId === b.id);
       
       return { 
         ...b, 
         isSyncing,
         criticalStock: criticalProducts.length > 0 ? criticalProducts : null,
         activeBatches: batchesInOven.length,
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
  }, [globalSales, branches, globalLowStock, activeProduction]);

  // Hourly Activity
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
      document.documentElement.requestFullscreen().then(() => setIsFullscreen(true));
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false));
    }
  };

  return (
    <div className={`tv-background ${isPublic ? 'public-mode' : 'owner-mode'}`} style={{ fontFamily: '"Outfit", sans-serif' }}>
      <button className="fullscreen-btn" onClick={toggleFullscreen}>
        {isFullscreen ? <Minimize size={24} /> : <Maximize size={24} />}
      </button>

      {/* HEADER SECTION */}
      <div className="tv-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
          {settings.storeLogo ? (
            <img 
              src={settings.storeLogo} 
              alt="Logo" 
              className="header-logo"
            />
          ) : (
            <div className="sidebar-brand-icon" style={{ width: 70, height: 70, fontSize: '2.5rem' }}>🧁</div>
          )}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
               <h1 style={{ fontSize: '2.5rem', fontWeight: 900, color: '#fff', letterSpacing: '-1px', marginBottom: 0 }}>
                 {isPublic ? 'MISSION CONTROL' : 'OWNER\'S WAR ROOM'}
               </h1>
               {isPublic && <span className="demo-badge">PUBLIC DEMO</span>}
               {!isPublic && <span className="secure-badge"><Zap size={14} /> SECURE LINK</span>}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'var(--success)', fontWeight: 800, fontSize: '0.9rem', opacity: 0.8, marginTop: 5 }}>
              <div className="pulse-orb" style={{ width: 10, height: 10 }} /> LIVE EMPIRE MONITORING — {settings.storeName}
            </div>
          </div>
        </div>

        <div className="tv-global-stats">
          <div className="tv-revenue-label" style={{ fontSize: '0.85rem', opacity: 0.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '2px', marginBottom: 5 }}>Global Revenue Today</div>
          <div className="tv-main-revenue" style={{ fontSize: '4.5rem', lineHeight: 0.9, fontWeight: 900, letterSpacing: '-3px' }}>{formatCurrency(pulseMetrics.total)}</div>
          <div style={{ fontSize: '0.9rem', opacity: 0.4, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 8, marginTop: 8 }}>
            <TrendingUp size={16} style={{ color: 'var(--success)' }} />
            {globalSales.length.toLocaleString()} TRANSACTIONS
          </div>
        </div>
      </div>

      {/* SLIDE NAVIGATION INDICATOR */}
      <div className="tv-slide-nav">
        <button onClick={() => setActiveSlide(1)} className={activeSlide === 1 ? 'active' : ''}>1</button>
        <button onClick={() => setActiveSlide(2)} className={activeSlide === 2 ? 'active' : ''}>2</button>
      </div>

      <div className="tv-viewport">
        {/* SLIDE 1: BRANCH INTELLIGENCE */}
        <div className={`tv-slide ${activeSlide === 1 ? 'active' : 'inactive'}`}>
          <div className="slide-label">
             <MapPin size={24} /> GLOBAL BRANCH INTELLIGENCE GRID
          </div>
          <div className="tv-grid">
            {branchPerformance.map((branch, index) => (
              <div 
                key={branch.id} 
                className={`tv-branch-card ${justSoldBranch === branch.id ? 'just-sold' : ''} ${branch.isOnline ? 'card-online-neon' : ''} ${rankedUpBranches[branch.id] ? 'ranked-up' : ''}`}
              >
                <div className="tv-rank-badge">RANK #{branch.rank}</div>
                
                <div className="tv-branch-name">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <MapPin size={18} style={{ color: index === 0 ? '#FFD700' : 'var(--accent)' }} />
                    {branch.name}
                  </div>
                </div>

                <div className="tv-branch-revenue">
                  {formatCurrency(branch.revenue)}
                </div>
                <div className="tv-branch-orders">
                  {branch.orders} Orders • Avg {formatCurrency(branch.orders > 0 ? branch.revenue/branch.orders : 0)}
                </div>
                
                <div style={{ marginTop: 25, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    {branch.activeBatches > 0 && (
                       <div className="oven-indicator-badge">
                         🥧 {branch.activeBatches} IN OVEN
                       </div>
                    )}
                    {branch.criticalStock && (
                      <div className="stock-warning-badge">
                        LOW STOCK
                      </div>
                    )}
                  </div>

                  <div className={`status-pill ${branch.isOnline ? 'online' : 'offline'}`}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {branch.isOnline ? <Wifi size={18} className="pulse-fast" /> : <WifiOff size={18} />}
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
        </div>

        {/* SLIDE 2: OPERATIONS & LOSS AUDIT */}
        <div className={`tv-slide ${activeSlide === 2 ? 'active' : 'inactive'}`}>
           <div className="slide-label">
             <Activity size={24} /> SHIPMENT & OPERATIONS COMMAND
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 20, flex: 1 }}>
            {/* INVENTORY ALERTS */}
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
                </div>
              </div>
            )}

            {/* OWNER ONLY AUDIT FEED & LOSS TRACKER */}
            {!isPublic && (
              <div className="owner-audit-grid">
                <div className="audit-card feed-panel">
                    <div className="card-title">
                        <Activity size={18} color="var(--accent)" /> LIVE AUDIT FEED
                    </div>
                    <div className="audit-list">
                        {auditLogs.slice(0, 15).map(log => (
                          <div key={log.id} className="audit-item">
                              <div className="audit-time">{new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                              <div className="audit-branch">{log.branchName}</div>
                              <div className="audit-msg">
                                <strong style={{ color: 'var(--accent)' }}>{log.userName}</strong>
                                <span style={{ margin: '0 8px', opacity: 0.5 }}>•</span>
                                {log.action === 'PRODUCTION_SPOILAGE' ? (
                                  <span className="danger-text">VOIDED BATCH: {log.details?.product} ({log.details?.reason})</span>
                                ) : log.action}
                              </div>
                          </div>
                        ))}
                        {auditLogs.length === 0 && <div style={{ opacity: 0.3, padding: 20 }}>No system activity detected...</div>}
                    </div>
                </div>

                <div className="audit-card loss-panel">
                    <div className="card-title">
                        <AlertTriangle size={18} color="#ef4444" /> RECENT PRODUCTION LOSS (7D)
                    </div>
                    <div className="loss-metrics">
                        <div className="loss-box sunk">
                          <span className="label">SUNK COST</span>
                          <span className="value">{formatCurrency(lossStats?.totalSunkCost || 0)}</span>
                          <span className="desc">Materials Lost</span>
                        </div>
                        <div className="loss-box potential">
                          <span className="label">REVENUE VOID</span>
                          <span className="value">{formatCurrency(lossStats?.totalPotentialLoss || 0)}</span>
                          <span className="desc">Potential Sales</span>
                        </div>
                    </div>
                    <div className="ruined-list" style={{ marginTop: 20 }}>
                      {ruinedProduction.slice(0, 5).map(p => (
                        <div key={p.id} className="ruined-item">
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={{ opacity: 0.5 }}>{new Date(p.date).toLocaleDateString()}</span>
                            <span style={{ fontWeight: 700 }}>{p.productName}</span>
                          </div>
                          <span style={{ color: '#ef4444', fontWeight: 900 }}>
                            - {formatCurrency((p.quantityProduced || p.estimatedYield) * (products.find(prod => prod.id === p.productId)?.price || 0))}
                          </span>
                        </div>
                      ))}
                    </div>
                </div>
              </div>
            )}

            {/* HOURLY PERFORMANCE */}
            <div className="tv-hourly-section">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <div style={{ display: 'flex', gap: 10, alignItems: 'center', textTransform: 'uppercase', letterSpacing: 2, fontSize: '0.8rem', fontWeight: 800, opacity: 0.6 }}>
                    <Activity size={16} color="var(--accent)" /> Global Daily Sales Activity
                </div>
                <div style={{ color: 'var(--success)', fontWeight: 900 }}>
                  TODAY: <span style={{ fontSize: '1.2rem' }}>{formatCurrency(pulseMetrics.total)}</span>
                </div>
              </div>
              <ResponsiveContainer width="100%" height={150}>
                  <AreaChart data={pulseMetrics.data}>
                      <defs>
                        <linearGradient id="tvPulse" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#D4763C" stopOpacity={0.3}/>
                          <stop offset="95%" stopColor="#D4763C" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <XAxis dataKey="hourLabel" axisLine={false} tickLine={false} tick={{ fill: '#fff', fontSize: 10, opacity: 0.4 }} interval={3} />
                      <YAxis hide domain={[0, 'auto']} />
                      <Tooltip contentStyle={{ background: '#2C1810', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8 }} itemStyle={{ color: '#fff' }} />
                      <Area type="monotone" dataKey="revenue" stroke="#D4763C" strokeWidth={3} fill="url(#tvPulse)" />
                  </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </div>

       <div className="tv-ticker-bar">
        <div className="tv-ticker-content">
          {tickerItems.map((item, i) => (
            <div key={`${item.id}-${i}`} className="tv-ticker-item">
              {item.type === 'alert' ? (
                <>
                  <AlertTriangle size={16} style={{ color: '#ef4444' }} />
                  <span style={{ color: '#ef4444', fontWeight: 800 }}>LOW STOCK: {item.itemName.toUpperCase()}</span>
                  <span style={{ opacity: 0.6 }}>@{item.branchName.toUpperCase()}</span>
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
          .tv-background { background: #050505; min-height: 100vh; color: #fff; font-family: 'Outfit', sans-serif; display: flex; flex-direction: column; padding: 10px; overflow-x: hidden; position: relative; }
          .public-mode { background: radial-gradient(circle at top right, #1a1a2e, #050505); }
          .owner-mode { background: radial-gradient(circle at top right, #140808, #050505); }

          .tv-header { padding: 25px 40px; border-bottom: 1px solid rgba(255,255,255,0.05); margin-bottom: 5px; display: flex; justify-content: space-between; align-items: center; z-index: 10; }
          .header-logo { width: 70px; height: 70px; background: #fff; border-radius: 16px; object-fit: contain; padding: 6px; box-shadow: 0 8px 24px rgba(0,0,0,0.5); }
          
          .tv-slide-nav { position: absolute; top: 140px; right: 40px; display: flex; gap: 12px; z-index: 100; }
          .tv-slide-nav button { background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); color: #fff; width: 36px; height: 36px; border-radius: 50%; cursor: pointer; font-size: 0.8rem; font-weight: 800; transition: all 0.3s; }
          .tv-slide-nav button.active { background: var(--accent); border-color: var(--accent); box-shadow: 0 0 20px rgba(212, 118, 60, 0.4); }

          .tv-viewport { flex: 1; position: relative; width: 100%; overflow: hidden; margin-top: 10px; }
          .tv-slide { position: absolute; top: 0; left: 0; width: 100%; height: 100%; transition: all 1s cubic-bezier(0.23, 1, 0.32, 1); padding: 0 30px; display: flex; flex-direction: column; }
          .tv-slide.active { opacity: 1; transform: translateX(0); visibility: visible; }
          .tv-slide.inactive { opacity: 0; transform: translateX(100px); visibility: hidden; }

          .slide-label { font-size: 0.8rem; font-weight: 900; color: rgba(255,255,255,0.3); display: flex; align-items: center; gap: 12px; margin-bottom: 25px; text-transform: uppercase; letter-spacing: 4px; border-left: 4px solid var(--accent); padding-left: 20px; }

          .demo-badge { background: #3b82f6; color: #fff; padding: 4px 10px; border-radius: 6px; font-weight: 900; font-size: 0.7rem; }
          .secure-badge { background: #ef4444; color: #fff; padding: 4px 10px; border-radius: 6px; font-weight: 900; font-size: 0.7rem; display: flex; align-items: center; gap: 4px; animation: glow-red 2s infinite; }
          @keyframes glow-red { 0%, 100% { box-shadow: 0 0 5px rgba(239, 68, 68, 0.5); } 50% { box-shadow: 0 0 15px rgba(239, 68, 68, 0.8); } }

          .owner-audit-grid { display: grid; grid-template-columns: 1.6fr 1fr; gap: 20px; }
          .audit-card { background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.05); border-radius: 24px; padding: 25px; backdrop-filter: blur(10px); }
          .feed-panel { border-left: 1px solid rgba(212, 118, 60, 0.2); }
          .loss-panel { border-left: 1px solid rgba(239, 68, 68, 0.2); }
          .card-title { font-size: 0.75rem; font-weight: 800; color: rgba(255,255,255,0.3); display: flex; align-items: center; gap: 10px; margin-bottom: 20px; text-transform: uppercase; letter-spacing: 2px; }
          
          .audit-list { height: 250px; overflow-y: auto; font-family: 'JetBrains Mono', monospace; font-size: 0.85rem; scrollbar-width: none; }
          .audit-item { display: flex; gap: 15px; padding: 12px 0; border-bottom: 1px solid rgba(255,255,255,0.03); align-items: baseline; }
          .audit-time { color: rgba(255,255,255,0.2); white-space: nowrap; font-size: 0.7rem; font-weight: 700; }
          .audit-branch { color: var(--info); font-weight: 800; white-space: nowrap; font-size: 0.75rem; min-width: 90px; }
          .audit-msg { color: #fff; opacity: 0.8; line-height: 1.5; }
          .danger-text { color: #fe6b6b; font-weight: 700; }

          .loss-metrics { display: flex; gap: 15px; }
          .loss-box { flex: 1; padding: 20px; border-radius: 16px; display: flex; flex-direction: column; background: rgba(255,255,255,0.01); border: 1px solid rgba(255,255,255,0.04); }
          .loss-box.sunk { border-top: 3px solid #ef4444; }
          .loss-box.potential { border-top: 3px solid #f59e0b; }
          .loss-box .label { font-size: 0.6rem; font-weight: 900; opacity: 0.4; color: #fff; text-transform: uppercase; letter-spacing: 1px; }
          .loss-box .value { font-size: 1.8rem; font-weight: 900; color: #fff; margin: 6px 0; letter-spacing: -1px; }
          .loss-box .desc { font-size: 0.6rem; opacity: 0.2; text-transform: uppercase; font-weight: 800; }

          .ruined-list { font-size: 0.8rem; color: rgba(255,255,255,0.5); display: flex; flex-direction: column; gap: 10px; }
          .ruined-item { display: flex; justify-content: space-between; align-items: center; padding: 12px 16px; background: rgba(255,255,255,0.02); border-radius: 12px; border: 1px solid rgba(255,255,255,0.03); }

          .tv-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(360px, 1fr)); gap: 25px; }
          .tv-branch-card { padding: 30px; border-radius: 28px; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.06); position: relative; overflow: hidden; transition: all 0.4s cubic-bezier(0.165, 0.84, 0.44, 1); backdrop-filter: blur(12px); }
          .tv-branch-card:hover { transform: translateY(-5px); background: rgba(255,255,255,0.05); border-color: rgba(255,255,255,0.1); }
          .card-online-neon { border-color: rgba(0, 255, 0, 0.15); box-shadow: 0 10px 40px rgba(0,0,0,0.3), inset 0 0 20px rgba(0,255,0,0.01); }
          .ranked-up { animation: rank-pulse 2s cubic-bezier(0.4, 0, 0.2, 1); }
          @keyframes rank-pulse { 0% { box-shadow: 0 0 0 0 rgba(212, 118, 60, 0.4); } 70% { box-shadow: 0 0 0 20px rgba(212, 118, 60, 0); } 100% { box-shadow: 0 0 0 0 rgba(212, 118, 60, 0); } }

          .tv-rank-badge { position: absolute; top: 20px; right: 20px; background: rgba(255,255,255,0.03); padding: 5px 14px; border-radius: 10px; font-size: 0.65rem; font-weight: 900; color: rgba(255,255,255,0.3); border: 1px solid rgba(255,255,255,0.05); text-transform: uppercase; letter-spacing: 1px; }
          .tv-branch-name { font-size: 1.2rem; font-weight: 800; display: flex; align-items: center; gap: 10px; margin-bottom: 12px; color: #fff; opacity: 0.5; text-transform: uppercase; letter-spacing: 1px; }
          .tv-branch-revenue { font-size: 4rem; font-weight: 900; margin-bottom: 8px; letter-spacing: -3px; line-height: 0.9; }
          .tv-branch-orders { font-size: 0.8rem; opacity: 0.3; font-weight: 700; text-transform: uppercase; letter-spacing: 2px; }

          .status-pill { padding: 12px 18px; border-radius: 16px; font-size: 0.85rem; font-weight: 900; display: flex; align-items: center; gap: 15px; background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.05); }
          .status-pill.online { color: #00ff00; border-color: rgba(0, 255, 0, 0.2); }
          .status-pill.offline { color: #ef4444; border-color: rgba(239, 68, 68, 0.2); }

          .tv-inventory-alert-bar { background: rgba(239, 68, 68, 0.1); border: 1px solid rgba(239, 68, 68, 0.2); border-radius: 20px; padding: 15px 30px; display: flex; align-items: center; gap: 20px; }
          .alert-badge { background: #ef4444; color: #fff; padding: 10px 15px; border-radius: 12px; font-weight: 900; font-size: 0.8rem; display: flex; align-items: center; gap: 8px; box-shadow: 0 4px 15px rgba(239, 68, 68, 0.3); }
          .alert-content { display: flex; gap: 30px; overflow-x: auto; flex: 1; padding: 5px 0; scrollbar-width: none; }
          .alert-item { display: flex; align-items: center; gap: 10px; white-space: nowrap; font-size: 0.95rem; }
          .alert-item .name { font-weight: 800; }
          .alert-item .branch { opacity: 0.5; font-size: 0.8rem; }
          .alert-item .level { color: #ef4444; font-weight: 900; }

          .tv-hourly-section { background: rgba(255,255,255,0.01); padding: 30px; border-radius: 24px; border: 1px solid rgba(255,255,255,0.03); }
          .tv-ticker-bar { height: 60px; background: rgba(0,0,0,0.8); border-top: 1px solid rgba(255,255,255,0.05); display: flex; align-items: center; z-index: 20; position: fixed; bottom: 0; left: 0; width: 100%; backdrop-filter: blur(10px); }
          .tv-ticker-content { display: flex; gap: 80px; animation: ticker 60s linear infinite; padding-left: 20px; }
          @keyframes ticker { from { transform: translateX(0); } to { transform: translateX(-50%); } }
          .tv-ticker-item { display: flex; align-items: center; gap: 15px; white-space: nowrap; font-size: 1rem; font-weight: 700; letter-spacing: 0.5px; }

          .oven-indicator-badge { background: rgba(245, 158, 11, 0.1); color: #f59e0b; padding: 8px 15px; border-radius: 12px; font-size: 0.75rem; font-weight: 900; border: 1px solid rgba(245, 158, 11, 0.2); }
          .stock-warning-badge { background: rgba(239, 68, 68, 0.15); color: #ef4444; padding: 8px 15px; border-radius: 12px; font-size: 0.75rem; font-weight: 900; border: 1px solid rgba(239, 68, 68, 0.3); }

          .fullscreen-btn { position: fixed; top: 40px; right: 40px; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); color: #fff; width: 50px; height: 50px; border-radius: 50%; cursor: pointer; display: flex; align-items: center; justify-content: center; z-index: 1000; transition: all 0.3s; }
          .fullscreen-btn:hover { background: rgba(255,255,255,0.1); transform: scale(1.1); border-color: rgba(255,255,255,0.2); }

          @media (max-width: 1024px) {
            .owner-audit-grid { grid-template-columns: 1fr; }
          }

          @media (max-width: 768px) {
            .tv-header { flex-direction: column; align-items: flex-start; gap: 20px; padding: 25px; }
            .tv-global-stats { width: 100%; text-align: left; }
            .tv-main-revenue { font-size: 3.5rem; }
            .tv-grid { grid-template-columns: 1fr; }
            .tv-header h1 { font-size: 1.8rem !important; }
          }
       `}</style>
    </div>
  );
}
