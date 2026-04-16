import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { 
  TrendingUp, TrendingDown, ShoppingCart, Users, Award, 
  MapPin, Wifi, WifiOff, Activity, AlertTriangle, Zap,
  ShoppingBag, Minimize, Maximize, Clock, Shield,
  ChevronRight, ArrowRight, Pizza, BarChart2, Volume2, VolumeX
} from 'lucide-react';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, 
  ResponsiveContainer, BarChart, Bar, Cell 
} from 'recharts';
import { formatCurrency } from '../../utils/formatters';
import { api } from '../../utils/api';
import PullToRefresh from '../shared/PullToRefresh';
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
  const [isLoadingLogs, setIsLoadingLogs] = useState(true);
  const [ruinedProduction, setRuinedProduction] = useState([]);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [justSoldBranch, setJustSoldBranch] = useState(null);
  const [activeSlide, setActiveSlide] = useState(1);
  const [activeProduction, setActiveProduction] = useState([]);
  const [summaryData, setSummaryData] = useState(null);
  
  // Achievement System
  const prevRanksRef = useRef({});
  const [rankedUpBranches, setRankedUpBranches] = useState({});
  const [soundEnabled, setSoundEnabled] = useState(() => localStorage.getItem('fel_dashboard_sound') === 'true');
  const [activeToast, setActiveToast] = useState(null);
  const lastSaleIdRef = useRef(null);

  // Audio Engine: Custom Anvil Bell MP3
  const playSoftBell = () => {
    if (!soundEnabled) return;
    try {
      const audio = new Audio('/sounds/wingsoarstudio-anvil-bell-2-wav-485668.mp3');
      audio.volume = 0.5; // Soften to 50% as requested previously
      audio.play().catch(e => console.warn('Audio playback blocked or failed:', e));
    } catch (e) {
      console.warn('Audio initialization failed:', e);
    }
  };

  const toggleSound = () => {
    const newState = !soundEnabled;
    setSoundEnabled(newState);
    localStorage.setItem('fel_dashboard_sound', newState.toString());
    // Play a test ding when turning on so user knows it works
    if (newState) {
       setTimeout(playSoftBell, 100);
    }
  };

  // Slide logic removed for high-density one-screen layout

  // Master Background Fetcher: Truly Global Data
  const fetchGlobalData = useCallback(async () => {
    try {
      const headers = { 
        'X-Branch-Id': 'all',
        'X-User-Role': 'system_admin' // Force full access for dashboard
      };

      // FETCH BUFFER: Use the new summary endpoint for speed and the transactions for live toasts
      const [tx, branchesData, prodData, summary] = await Promise.all([
        api.get('/transactions?limit=200&summary=true', { headers }),
        api.get('/branches', { headers }),
        api.get('/production/logs?status=in_oven', { headers }),
        api.get('/analytics/today-summary', { headers })
      ]);

      setGlobalSales(tx || []);
      setBranches(branchesData || []);
      setSummaryData(summary);
      
      const activeBatches = Array.isArray(prodData) ? prodData : (prodData?.batches || prodData?.logs || []);
      setActiveProduction(activeBatches);
      
      // Secure-only fetching
      const [logs, ruinedData] = await Promise.all([
        api.get('/logs?limit=50', { headers }),
        api.get('/production/logs?status=ruined', { headers })
      ]);
      setAuditLogs(logs || []);
      // v1.2.38: UNPACKING RESILIENCE for Metrics
      const ruinedFiltered = Array.isArray(ruinedData) ? ruinedData : (ruinedData?.batches || ruinedData?.logs || []);
      setRuinedProduction(ruinedFiltered);
      setIsLoadingLogs(false);
    } catch (e) {
      console.error('[Mission Control Master Fetch Error]', e);
    }
  }, [isPublic]);

  useEffect(() => {
    fetchGlobalData();
    const interval = setInterval(fetchGlobalData, 30000); // Relaxed to 30s to be kinder to Free Tier
    return () => clearInterval(interval);
  }, [fetchGlobalData]); // Stable dependency

  // Calculations for Loss
  const lossStats = useMemo(() => {
    if (isPublic) return null;
    
    let totalSunkCost = 0;
    let totalPotentialLoss = 0;

    (ruinedProduction || []).forEach(log => {
      // v1.2.40: NUCLEAR FILTERING - Command center now filters the 100% log pulse locally
      if (log.status !== 'ruined') return;

      // Wasted Ingredients: Sum of material costs (Handling both DB snake_case and payload variants)
      const materialCost = (log.items || []).reduce((sum, item) => {
        const price = item.cost_price ?? item.costPrice ?? 0;
        const qty = item.quantity_used ?? item.quantityUsed ?? 0;
        return sum + (price * qty);
      }, 0);
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
      
      // TRIGGER: If the latest sale is different from what we last saw
      if (lastSaleIdRef.current && topSale.id !== lastSaleIdRef.current) {
        setJustSoldBranch(topSale.branchId);
        
        // Trigger Toast
        const branchName = branches.find(b => b.id === topSale.branchId)?.name || 'Branch';
        setActiveToast({ branchName, total: topSale.total, id: topSale.id });
        
        playSoftBell(); // Ring the bell!
        
        setTimeout(() => setJustSoldBranch(null), 3000);
        setTimeout(() => setActiveToast(null), 5000); // Toast stays 5 seconds
      }
      
      lastSaleIdRef.current = topSale.id;
    }
  }, [globalSales[0]?.id, soundEnabled]);

  const stats = getTodayStats();

  const globalLowStock = useMemo(() => {
    return getLowStockProducts().map(p => ({
      ...p,
      branchName: branches.find(b => b.id === p.branchId)?.name || 'Unknown'
    }));
  }, [products, branches, getLowStockProducts]);

  // Branch Performance Analysis
  const branchPerformance = useMemo(() => {
    // CALCULATE BRANCH REVENUE (Using Server-Side Summary)
    const currentRanks = branches.map(b => {
      const stats = summaryData?.branchStats?.find(s => s.branchId === b.id);
      return {
        ...b,
        revenue: stats?.revenue || 0,
        orders: stats?.count || 0
      };
    }).sort((a, b) => b.revenue - a.revenue);

    const finalData = currentRanks.map((b, index) => {
       const criticalProducts = globalLowStock.filter(p => p.branchId === b.id);
       const batchesInOven = activeProduction.filter(p => p.branchId === b.id);
       
       // Trust the server's tightened 2-minute isOnline signal
       const isOnline = b.isOnline;

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
    if (!summaryData) return { data: [], total: 0, peakHour: 'None', todayTxCount: 0 };

    const data = summaryData.hourlyPulse.map(p => ({
      hour: parseInt(p.hour),
      hourLabel: p.hour > 12 ? `${p.hour - 12} PM` : p.hour === '12' ? '12 PM' : p.hour === '00' ? '12 AM' : `${parseInt(p.hour)} AM`,
      revenue: p.revenue
    }));

    const peak = [...data].sort((a, b) => b.revenue - a.revenue)[0];
    const peakHour = (peak && peak.revenue > 0) ? peak.hourLabel : 'None';

    return { 
      data, 
      total: summaryData.revenue || 0, 
      peakHour, 
      todayTxCount: summaryData.orderCount || 0 
    };
  }, [summaryData]);

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
      <PullToRefresh onRefresh={fetchGlobalData}>
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
            <div style={{ display: 'flex', alignItems: 'center', gap: 15 }}>
              <button 
                className={`tv-icon-button ${soundEnabled ? 'active-pulse' : ''}`} 
                onClick={toggleSound}
                title={soundEnabled ? "Mute Sound" : "Enable Sale Alerts"}
                style={{ color: soundEnabled ? '#FFD700' : 'rgba(255,255,255,0.3)', background: 'none', border: 'none', cursor: 'pointer' }}
              >
                {soundEnabled ? <Volume2 size={24} /> : <VolumeX size={24} />}
              </button>
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
            {pulseMetrics.todayTxCount.toLocaleString()} TX
          </div>
        </div>
      </div>

      {/* Unified Dashboard Screen */}

      <div className="tv-viewport high-density-mode">
        {/* SALES TOAST (Bottom Left) */}

        {/* MAIN BRANCH GRID */}
        <div className="tv-dense-grid-header">
           <MapPin size={18} /> GLOBAL UNIT PERFORMANCE (LIVE)
        </div>

        <div className="tv-branch-grid-compact">
          {branchPerformance.map((branch, index) => (
            <div 
              key={branch.id} 
              className={`tv-unit-tile ${justSoldBranch === branch.id ? 'just-sold' : ''} ${branch.isOnline ? 'is-live' : 'is-offline'} ${rankedUpBranches[branch.id] ? 'ranked-up' : ''}`}
            >
              <div className="tile-header">
                <span className="tile-rank">#{branch.rank}</span>
                <div className={`tile-status-orb ${branch.isOnline ? 'pulse' : ''}`} />
              </div>
              
              <div className="tile-body">
                <div className="tile-name">{branch.name}</div>
                <div className="tile-revenue">{formatCurrency(branch.revenue)}</div>
                <div className="tile-meta">
                  <span>{branch.orders} TX</span>
                  {branch.activeBatches > 0 && <span className="tile-oven">🥧 {branch.activeBatches}</span>}
                </div>
              </div>

              {branch.criticalStock && <div className="tile-alert-badge"><AlertTriangle size={10} /></div>}
            </div>
          ))}
        </div>

        <div className="tv-bottom-metrics">
          {/* OWNER ONLY: INTELLIGENCE ROW (Restored) */}
          {!isPublic && (
            <div className="tv-intelligence-row">
              <div className="intelligence-card">
                  <div className="card-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--accent-gold)' }}>
                        <Activity size={14} color="var(--accent-gold)" /> LIVE AUDIT FEED
                      </span>
                      <button 
                        onClick={fetchGlobalData}
                        style={{ background: 'none', border: 'none', color: 'var(--accent-gold)', cursor: 'pointer', opacity: 0.6 }}
                        title="Sync Now"
                      >
                        <Zap size={10} />
                      </button>
                  </div>
                  <div className="audit-list-mini">
                      {auditLogs.slice(0, 10).map(log => (
                        <div key={log.id} className="audit-item-mini">
                            <div className="audit-time-mini">{new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                          <div className="audit-branch-mini">{log.branchName || log.branch_name || 'System'}</div>
                          <div className="audit-msg-mini">
                            <strong style={{ opacity: 0.9 }}>{log.userName || log.user_name || log.username}</strong>: {(() => {
                              const details = typeof log.details === 'string' ? JSON.parse(log.details) : log.details;
                              switch(log.action) {
                                case 'SALE_COMPLETED':
                                  return `Sold items worth ${formatCurrency(details?.total || 0)}`;
                                case 'PRODUCT_UPDATED':
                                  return `Modified ${details?.name || 'a product'}`;
                                case 'EXPENSE_RECORDED':
                                  return `Recorded ${formatCurrency(details?.amount || 0)} for ${details?.category || 'expenses'}`;
                                case 'PRODUCTION_SPOILAGE':
                                  return `Recorded waste (${details?.reason || 'damaged'}): ${details?.product || 'Unknown'}`;
                                case 'LOGIN':
                                  return 'Signed into the system';
                                case 'LOGOUT':
                                  return 'Signed out';
                                case 'PRODUCTION_STARTED':
                                  return `Started baking ${details?.product || 'items'}`;
                                case 'PRODUCTION_FINISHED':
                                  return `Finished baking ${details?.product || 'items'}`;
                                case 'PREORDER_CREATED':
                                  return `Created preorder for ${details?.customer || 'Customer'}`;
                                default:
                                  return log.action.replace(/_/g, ' ').toLowerCase();
                              }
                            })()}
                          </div>
                        </div>
                      ))}
                      {auditLogs.length === 0 && !isLoadingLogs && (
                        <div style={{ opacity: 0.4, padding: '20px 10px', fontSize: '0.75rem', textAlign: 'center', letterSpacing: '1px' }}>
                          NO RECENT ACTIVITY DETECTED
                        </div>
                      )}
                      {isLoadingLogs && (
                        <div style={{ opacity: 0.4, padding: '20px 10px', fontSize: '0.75rem', textAlign: 'center' }}>
                          SCANNING EMPIRE...
                        </div>
                      )}
                  </div>
              </div>

              <div className="intelligence-card">
                   <div className="card-title" style={{ color: '#ff4d4d' }}>
                       <AlertTriangle size={14} color="#ff4d4d" /> PRODUCTION LOSS (7D)
                   </div>
                   <div className="loss-grid-compact">
                       <div className="loss-mini-box">
                         <span className="label">WASTED INGREDIENTS</span>
                         <span className="value">{formatCurrency(lossStats?.totalSunkCost || 0)}</span>
                       </div>
                       <div className="loss-mini-box">
                         <span className="label">LOST SALES</span>
                         <span className="value">{formatCurrency(lossStats?.totalPotentialLoss || 0)}</span>
                       </div>
                   </div>
                  <div className="ruined-list-mini" style={{ marginTop: 10 }}>
                    {ruinedProduction.slice(0, 3).map(p => (
                      <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', opacity: 0.8, borderBottom: '1px solid rgba(255,255,255,0.03)', padding: '2px 0' }}>
                        <span>{p.productName}</span>
                        <span className="danger-text">-{formatCurrency((p.quantityProduced || p.estimatedYield) * (products.find(prod => prod.id === p.productId)?.price || 0))}</span>
                      </div>
                    ))}
                  </div>
              </div>
            </div>
          )}

          {/* DAILY BUSINESS PULSE - Simplified for readability */}
          <div className="tv-sparkline-section">
            <div className="sparkline-label" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Activity size={14} /> TODAY'S SALES PULSE
              </span>
              {(() => {
                const data = pulseMetrics.data;
                if (data.length < 2) return null;
                const latest = data[data.length - 1].revenue;
                const prev = data[data.length - 2].revenue;
                
                return (
                  <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                    <span className="peak-hour-badge">🏆 PEAK: {pulseMetrics.peakHour}</span>
                    {latest > prev * 1.1 && <span className="trend-badge-up">🔥 TRENDING UP</span>}
                    {latest < prev * 0.9 && <span className="trend-badge-down">❄️ COOLING DOWN</span>}
                    {Math.abs(latest - prev) <= prev * 0.1 && <span className="trend-badge-steady">✨ STEADY</span>}
                  </div>
                );
              })()}
            </div>
            <ResponsiveContainer width="100%" height={100}>
                <AreaChart data={pulseMetrics.data} margin={{ top: 5, right: 5, left: 5, bottom: 20 }}>
                    <defs>
                      <linearGradient id="tvPulse" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#D4763C" stopOpacity={0.4}/>
                        <stop offset="95%" stopColor="#D4763C" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <XAxis 
                      dataKey="hourLabel" 
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 10 }}
                      interval={3}
                    />
                    <Tooltip 
                      contentStyle={{ background: '#1a1a1a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', fontSize: '12px' }}
                      itemStyle={{ color: '#D4763C' }}
                      labelStyle={{ color: 'rgba(255,255,255,0.5)' }}
                    />
                    <Area 
                      type="monotone" 
                      dataKey="revenue" 
                      stroke="#D4763C" 
                      strokeWidth={3} 
                      fill="url(#tvPulse)" 
                      isAnimationActive={true}
                      animationDuration={1500} 
                    />
                </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      </PullToRefresh>

      {/* FIXED OVERLAYS (Outside PullToRefresh to avoid transform bugs) */}
      {activeToast && (
        <div className="tv-sales-toast">
          <div className="toast-icon"><ShoppingCart size={20} /></div>
          <div className="toast-content">
            <div className="toast-label">NEW PURCHASE</div>
            <div className="toast-detail">
              <span className="toast-branch">{activeToast.branchName}</span>
              <span className="toast-amount">{formatCurrency(activeToast.total)}</span>
            </div>
          </div>
        </div>
      )}

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
