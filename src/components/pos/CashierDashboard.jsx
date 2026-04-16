import React, { useState, useEffect, useMemo } from 'react';
import { 
  Zap, Clock, ShoppingBag, TrendingUp, AlertTriangle, 
  CheckCircle, ArrowRight, Pizza, Flame, Star
} from 'lucide-react';
import { api } from '../../utils/api';
import { formatCurrency } from '../../utils/formatters';

export default function CashierDashboard({ activeBranch, settings, products, onClose }) {
  const [localProduction, setLocalProduction] = useState([]);
  const [localSales, setLocalSales] = useState([]);
  const branchGoal = parseFloat(settings?.branchGoal || 25000);
  const [activePromo, setActivePromo] = useState(0);

  const promos = [
    { title: "MORNING RUSH", text: "Offer ₱10 discount on Coffee with any Bread!", icon: <Clock size={24} /> },
    { title: "BREAD BUNDLE", text: "Buy 5 Pandesal, get 1 FREE Spanish Bread!", icon: <Pizza size={24} /> },
    { title: "LOYALTY BOOST", text: "Remind customers to use their phone number for points!", icon: <Star size={24} /> }
  ];

  useEffect(() => {
    const fetchLocalData = async () => {
      try {
        const headers = { 'X-Branch-Id': activeBranch };
        const [prod, sales] = await Promise.all([
          api.get('/production/logs?status=in_oven', { headers }),
          api.get('/transactions/today', { headers })
        ]);
        setLocalProduction(prod || []);
        setLocalSales(sales || []);
      } catch (e) {
        console.error('Failed to fetch cashier dashboard data', e);
      }
    };

    fetchLocalData();
    const interval = setInterval(fetchLocalData, 15000);
    const promoInterval = setInterval(() => {
        setActivePromo(prev => (prev + 1) % promos.length);
    }, 8000);

    return () => {
        clearInterval(interval);
        clearInterval(promoInterval);
    };
  }, [activeBranch]);

  const todayRevenue = useMemo(() => {
    return localSales.reduce((sum, s) => sum + s.total, 0);
  }, [localSales]);

  const progressPercent = Math.min(100, (todayRevenue / branchGoal) * 100);

  const localLowStock = useMemo(() => {
      return products.filter(p => p.branchId === activeBranch && p.stock <= p.reorderPoint && p.stock > 0);
  }, [products, activeBranch]);

  return (
    <div className="cashier-deck-overlay">
      <div className="deck-header">
        <div className="deck-brand">
          <Zap className="text-yellow-400" fill="currentColor" />
          <span>CASHIER FLIGHT DECK</span>
        </div>
        <button className="deck-close" onClick={onClose}>EXIT DASHBOARD</button>
      </div>

      <div className="deck-grid">
        {/* WIDGET 1: BRANCH MISSION */}
        <div className="deck-card mission-card">
          <div className="card-label">BRANCH SALES MISSION</div>
          <div className="mission-content">
             <div className="revenue-display">
                <span className="current">{formatCurrency(todayRevenue)}</span>
                <span className="separator">/</span>
                <span className="goal">{formatCurrency(branchGoal)}</span>
             </div>
             <div className="progress-container">
                <div className="progress-bar" style={{ width: `${progressPercent}%` }}>
                    <div className="progress-glow" />
                </div>
             </div>
             <div className="mission-status">
                {progressPercent >= 100 ? "MISSION ACCOMPLISHED! 🏆" : `${progressPercent.toFixed(1)}% OF DAILY TARGET`}
             </div>
          </div>
        </div>

        {/* WIDGET 2: OVEN MONITOR */}
        <div className="deck-card oven-card">
          <div className="card-label">LIVE OVEN MONITOR</div>
          <div className="oven-list">
            {localProduction.length > 0 ? localProduction.slice(0, 4).map(p => (
              <div key={p.id} className="oven-item">
                <div className="oven-info">
                    <span className="emoji">{p.emoji || '🥯'}</span>
                    <span className="name">{p.productName}</span>
                </div>
                <div className="oven-timer">
                   <Clock size={16} />
                   <span>{new Date(p.estimatedReadyTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                </div>
              </div>
            )) : (
              <div className="empty-oven">
                 <Flame size={48} opacity={0.2} />
                 <p>No active baking sessions</p>
              </div>
            )}
          </div>
        </div>

        {/* WIDGET 3: SMART PROMO */}
        <div className="deck-card promo-card">
          <div className="card-label">SUGGESTIVE SELL TIP</div>
          <div className="promo-content">
             <div className="promo-icon">{promos[activePromo].icon}</div>
             <div className="promo-text">
                <div className="promo-title">{promos[activePromo].title}</div>
                <div className="promo-desc">{promos[activePromo].text}</div>
             </div>
          </div>
        </div>

        {/* WIDGET 4: CRITICAL STOCK */}
        <div className="deck-card stock-card">
          <div className="card-label">CRITICAL STOCK (PUSH FIRST)</div>
          <div className="stock-list">
             {localLowStock.length > 0 ? localLowStock.slice(0, 5).map(p => (
               <div key={p.id} className="stock-item">
                  <span className="name">{p.name}</span>
                  <span className="value">{p.stock} {p.unit} LEFT</span>
               </div>
             )) : (
               <div className="stock-all-good">
                  <CheckCircle size={32} color="var(--success)" />
                  <p>Inventory levels stable</p>
               </div>
             )}
          </div>
        </div>
      </div>

      <style jsx>{`
        .cashier-deck-overlay { position: fixed; inset: 0; background: #080808; color: #fff; z-index: 9999; padding: 20px; font-family: 'Inter', sans-serif; display: flex; flex-direction: column; }
        .deck-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 30px; border-bottom: 1px solid rgba(255,255,255,0.05); padding-bottom: 15px; }
        .deck-brand { display: flex; align-items: center; gap: 12px; font-weight: 900; letter-spacing: 2px; font-size: 1.2rem; }
        .deck-close { background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); color: #fff; padding: 8px 20px; border-radius: 8px; cursor: pointer; font-weight: 800; font-size: 0.8rem; transition: all 0.2s; }
        .deck-close:hover { background: #ef4444; border-color: #ef4444; }

        .deck-grid { display: grid; grid-template-columns: 1.2fr 1fr; grid-template-rows: 1fr 1fr; gap: 20px; flex: 1; min-height: 0; }
        .deck-card { background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.05); border-radius: 24px; padding: 24px; display: flex; flex-direction: column; overflow: hidden; }
        .card-label { font-size: 0.75rem; font-weight: 900; color: rgba(255,255,255,0.3); text-transform: uppercase; letter-spacing: 2px; margin-bottom: 20px; border-left: 3px solid var(--accent); padding-left: 12px; }

        .mission-card { background: linear-gradient(135deg, rgba(212, 118, 60, 0.05), rgba(0,0,0,0)); }
        .revenue-display { display: flex; align-items: baseline; gap: 10px; margin-bottom: 15px; flex-wrap: wrap; }
        .current { font-size: clamp(2rem, 8vw, 4rem); font-weight: 900; letter-spacing: -2px; }
        .separator { font-size: 1.5rem; opacity: 0.2; }
        .goal { font-size: 1.5rem; opacity: 0.4; font-weight: 700; }
        .progress-container { height: 12px; background: rgba(255,255,255,0.05); border-radius: 10px; overflow: hidden; margin-bottom: 12px; }
        .progress-bar { height: 100%; background: var(--accent); border-radius: 10px; position: relative; }
        .progress-glow { position: absolute; inset: 0; background: linear-gradient(90deg, transparent, rgba(255,255,255,0.3), transparent); animation: sweep 3s infinite; }
        @keyframes sweep { from { transform: translateX(-100%); } to { transform: translateX(100%); } }
        .mission-status { font-weight: 900; font-size: 0.8rem; color: var(--accent); }

        .oven-list { display: flex; flex-direction: column; gap: 10px; overflow-y: auto; }
        .oven-item { background: rgba(255,255,255,0.03); padding: 12px 16px; border-radius: 12px; display: flex; justify-content: space-between; align-items: center; border: 1px solid rgba(255,255,255,0.03); }
        .oven-info { display: flex; align-items: center; gap: 12px; }
        .oven-info .emoji { font-size: 1.2rem; }
        .oven-info .name { font-weight: 800; font-size: 0.95rem; }
        .oven-timer { display: flex; align-items: center; gap: 6px; color: var(--accent); font-weight: 900; background: rgba(212,118,60,0.1); padding: 4px 10px; border-radius: 8px; font-size: 0.8rem; }
        .empty-oven { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; opacity: 0.5; gap: 10px; font-weight: 700; }

        .promo-card { background: linear-gradient(135deg, rgba(59, 130, 246, 0.05), rgba(0,0,0,0)); justify-content: center; }
        .promo-content { display: flex; align-items: center; gap: 20px; }
        .promo-icon { background: var(--accent); color: #fff; width: 60px; height: 60px; border-radius: 16px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; box-shadow: 0 10px 20px rgba(0,0,0,0.3); }
        .promo-title { font-weight: 900; font-size: 1.2rem; color: var(--accent); margin-bottom: 2px; }
        .promo-desc { font-size: 0.95rem; opacity: 0.8; font-weight: 600; line-height: 1.3; }

        .stock-list { display: flex; flex-direction: column; gap: 8px; overflow-y: auto; }
        .stock-item { display: flex; justify-content: space-between; align-items: center; padding: 10px 16px; background: rgba(239, 68, 68, 0.05); border: 1px solid rgba(239, 68, 68, 0.1); border-radius: 10px; }
        .stock-item .name { font-weight: 700; font-size: 0.9rem; }
        .stock-item .value { font-weight: 900; color: #ef4444; font-size: 0.85rem; }
        .stock-all-good { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 10px; opacity: 0.6; font-weight: 700; }

        /* MOBILE OPTIMIZATION */
        @media (max-width: 768px) {
            .cashier-deck-overlay { padding: 15px; }
            .deck-header { margin-bottom: 20px; }
            .deck-brand span { font-size: 1rem; }
            .deck-grid { 
                grid-template-columns: 1fr !important;
                grid-template-rows: auto !important;
                display: flex;
                flex-direction: column;
                overflow-y: auto;
                padding-bottom: 40px;
            }
            .deck-card { min-height: 180px; padding: 20px; }
            .promo-content { gap: 15px; }
            .promo-icon { width: 50px; height: 50px; }
            .promo-title { font-size: 1rem; }
            .promo-desc { font-size: 0.85rem; }
        }
      `}</style>
    </div>
  );
}
