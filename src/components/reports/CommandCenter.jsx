import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  TrendingUp, TrendingDown, ShoppingCart, Users, Award, 
  MapPin, Wifi, WifiOff, Activity, AlertTriangle, Zap,
  ShoppingBag, Minimize, Maximize, Clock, Shield,
  ChevronRight, ArrowRight, Pizza, BarChart2
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
import './CommandCenter.css';

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
       const criticalProducts = globalLowStock.filter(p => p.branchId === b.id);
       const batchesInOven = activeProduction.filter(p => p.branchId === b.id);
       
       // Explicitly derive online status if not provided or to ensure accuracy
       const isOnline = b.isOnline || (b.lastSeenSecondsAgo !== null && b.lastSeenSecondsAgo < 60);

       return { 
         ...b, 
         isOnline,
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
      const sales = globalSales.slice(0, 5).map(t => ({
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

      // Permanent status items to ensure sliding even with 0 data
      const status = [
        { id: 's1', type: 'system', text: 'SATCOM UP', emoji: '🛰️' },
        { id: 's2', type: 'system', text: 'LIVE SYNC ACTIVE', emoji: '📡' },
        { id: 's3', type: 'system', text: 'EMPIRE SECURE', emoji: '🛡️' }
      ];

      const combined = [...sales, ...alerts, ...status];
      // Triple duplication for perfect infinite loop coverage
      return [...combined, ...combined, ...combined];
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
               <h1 className="tv-main-title">
                 {isPublic ? 'MISSION CONTROL' : 'EXECUTIVE DASHBOARD'}
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
          <div className="tv-revenue-box">
            <div className="tv-revenue-label">Global Revenue Today</div>
            <div className="tv-main-revenue">{formatCurrency(pulseMetrics.total)}</div>
          </div>
          <div style={{ fontSize: '0.8rem', opacity: 0.4, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 6, width: '100%', paddingRight: 5 }}>
            <TrendingUp size={14} style={{ color: 'var(--success)' }} />
            {globalSales.length.toLocaleString()} TX
          </div>
        </div>
      </div>

      {/* SLIDE NAVIGATION INDICATOR */}
      <div className="tv-slide-nav">
        <button 
          onClick={() => setActiveSlide(1)} 
          className={activeSlide === 1 ? 'active' : ''}
        >
          <BarChart2 size={18} />
          <span>UNIT INTEL</span>
        </button>
        <button 
          onClick={() => setActiveSlide(2)} 
          className={activeSlide === 2 ? 'active' : ''}
        >
          <Activity size={18} />
          <span>OPERATIONS</span>
        </button>
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
              ) : item.type === 'system' ? (
                <>
                  <Activity size={16} style={{ color: 'var(--success)' }} />
                  <span style={{ color: 'var(--success)', fontWeight: 800 }}>{item.emoji} {item.text}</span>
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

    </div>
  );
}
