import { NavLink, useLocation } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useSettings } from '../../contexts/SettingsContext';
import { useToast } from '../../contexts/ToastContext';
import { useSafetyShield } from '../../hooks/useSafetyShield';
import { api } from '../../utils/api';
import SyncStatus from '../shared/SyncStatus';
import {
  ShoppingBag, LayoutDashboard, Package, ClipboardList,
  BarChart3,
  Users, Wallet, Settings, LogOut, CalendarClock, Boxes, Menu, ChevronsLeft, Activity, Shield, RotateCcw,
  ChefHat, Wheat
} from 'lucide-react';

const navItems = [
  { to: '/pos', icon: ShoppingBag, label: 'POS Register', moduleId: 'module_pos' },
  { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard', moduleId: 'module_dashboard' },
  { to: '/baking', icon: ChefHat, label: 'Baking Batch', moduleId: 'module_bakery' },
  { to: '/reports', icon: BarChart3, label: 'Analytics Studio', moduleId: 'module_analytics' },
  { section: 'Management' },
  { to: '/products', icon: Package, label: 'Products', moduleId: 'module_products' },
  { to: '/inventory', icon: Boxes, label: 'Inventory', moduleId: 'module_bakery' },
  { to: '/raw-materials', icon: Wheat, label: 'Raw Materials', moduleId: 'module_bakery' },
  { to: '/preorders', icon: CalendarClock, label: 'Pre-Orders', moduleId: 'module_preorders' },
  { to: '/customers', icon: Users, label: 'Customers', moduleId: 'module_customers' },
  { to: '/expenses', icon: Wallet, label: 'Expenses', moduleId: 'module_expenses' },
  { to: '/command-center', icon: Activity, label: 'Mission Control', moduleId: 'module_mission_control' },
  { section: 'System' },
  { to: '/users', icon: Users, label: 'Users' },
  { to: '/settings', icon: Settings, label: 'Settings' },
];

export default function Sidebar() {
  const { currentUser, logout, activeBranch, switchBranch } = useAuth();
  const { settings } = useSettings();
  const { addToast } = useToast();
  const { triggerBackupDownload } = useSafetyShield();
  const location = useLocation();
  const [isCollapsed, setIsCollapsed] = useState(false);

  const handleResetTerminal = async () => {
    if (!confirm("SAFETY SHIELD: This will clear your terminal and fix sync issues. We will download a safety backup for you first. Proceed?")) return;
    
    addToast('Securing terminal data...', 'info');
    const success = await triggerBackupDownload('TERMINAL_RESET');
    
    if (success) {
       addToast('Terminal Secured. Resetting app...', 'success');
       localStorage.clear();
       window.location.reload();
    }
  };

  const visibleNavItems = navItems.filter(item => {
    if (item.section) return true;

    // 1. SYSTEM DEVELOPER / GLOBAL OWNER: Always see everything
    if (currentUser?.role === 'system_admin' || currentUser?.role === 'owner') return true;

    // 2. FEATURE GATEKEEPING: Check if the module is unlocked in the shop license
    // (If no moduleId is defined, the item is considered 'Core' and always visible to appropriate roles)
    if (item.moduleId) {
      try {
        const licenseFeatures = typeof settings.license_features === 'string' 
          ? JSON.parse(settings.license_features) 
          : (settings.license_features || []);
        
        if (!licenseFeatures.includes(item.moduleId)) return false;
      } catch (e) {
        // If license check fails, we default to showing it for resilience, 
        // but log the issue
        console.warn(`[Licensing] Failed to check module: ${item.moduleId}`);
      }
    }

    // 3. ROLE-BASED ACCESS CONTROL (RBAC)
    if (currentUser?.role === 'cashier') {
      const allowedPaths = ['/pos', '/dashboard', '/preorders', '/customers', '/reports'];
      return allowedPaths.includes(item.to);
    }
    
    if (currentUser?.role === 'baker') {
      return ['/baking', '/raw-materials'].includes(item.to);
    }
    
    if (currentUser?.role === 'manager') {
      return !['/users', '/settings'].includes(item.to);
    }
    
    // Default: Owners see everything that is licensed
    return true;
  });

  const finalNavItems = visibleNavItems.filter((item, i) => {
    if (item.section) {
      const nextItem = visibleNavItems[i + 1];
      return nextItem && !nextItem.section;
    }
    return true;
  });

  return (
    <aside className={`sidebar ${isCollapsed ? 'collapsed' : ''}`}>
      <div className="sidebar-brand" style={{ position: 'relative', padding: isCollapsed ? '20px 0' : '20px 16px' }}>
        {isCollapsed ? (
          <button 
            onClick={() => setIsCollapsed(false)}
            style={{ width: '100%', background: 'transparent', border: 'none', color: 'var(--text-sidebar)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            title="Expand Sidebar"
          >
            <Menu size={24} />
          </button>
        ) : (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              {settings.storeLogo ? (
                <img src={settings.storeLogo} alt="Logo" className="sidebar-brand-icon" style={{ background: '#fff', objectFit: 'contain', padding: 2 }} />
              ) : (
                <div className="sidebar-brand-icon">🧁</div>
              )}
              <div className="sidebar-brand-text">
                <span className="sidebar-brand-name">{settings.storeName}</span>
                <span className="sidebar-brand-sub">
                  {currentUser?.role === 'system_admin' ? 'Point of Sale' : (currentUser?.branchName || 'Point of Sale')}
                </span>
              </div>
            </div>
            <button 
              onClick={() => setIsCollapsed(true)}
              style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'var(--text-sidebar)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 4, borderRadius: 6, transition: 'all 0.2s' }}
              title="Collapse Sidebar"
              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.15)' }}
              onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.05)' }}
            >
              <ChevronsLeft size={16} />
            </button>
          </>
        )}
      </div>


      <nav className="sidebar-nav">
        {finalNavItems.map((item, i) => {
          if (item.section) {
            return <div key={i} className="sidebar-section-label">{item.section}</div>;
          }

          const Icon = item.icon;
          const isActive = location.pathname === item.to;

          return (
            <NavLink
              key={item.to}
              to={item.to}
              className={`sidebar-link ${isActive ? 'active' : ''}`}
              title={isCollapsed ? item.label : ''}
              target={item.to === '/command-center' ? '_blank' : undefined}
              rel={item.to === '/command-center' ? 'noopener noreferrer' : undefined}
            >
              <Icon size={18} />
              <span>{item.label}</span>
            </NavLink>
          );
        })}
      </nav>

      <div className="sidebar-footer">
        {!isCollapsed && ['system_admin', 'owner', 'manager'].includes(currentUser?.role) && (
          <div className="sidebar-footer-actions">
            <button 
              onClick={() => triggerBackupDownload('UNIVERSAL_SECURE')} 
              title="Secure Terminal Now"
              style={{
                flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                padding: 8, background: 'rgba(46, 204, 113, 0.1)',
                borderRadius: 8, color: '#2ecc71', fontSize: 10, fontWeight: 800, textTransform: 'uppercase',
                cursor: 'pointer', border: '1px solid rgba(46, 204, 113, 0.2)',
                overflow: 'hidden'
              }}
            >
              <Shield size={14} style={{ flexShrink: 0 }} /> 
              <span style={{ 
                whiteSpace: 'nowrap', 
                overflow: 'hidden', 
                textOverflow: 'ellipsis',
                flex: 1
              }}>Secure Terminal</span>
            </button>
            <button 
              onClick={handleResetTerminal} 
              title="Troubleshoot & Reset App"
              style={{
                flex: '0 0 32px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                padding: 8, background: 'rgba(231, 76, 60, 0.1)', border: '1px solid rgba(231, 76, 60, 0.2)',
                borderRadius: 8, color: '#e74c3c', cursor: 'pointer'
              }}
            >
              <RotateCcw size={14} />
            </button>
          </div>
        )}
        {!isCollapsed && <SyncStatus />}
        {isCollapsed && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <button className="text-white opacity-40 hover:opacity-100" onClick={() => triggerBackupDownload('UNIVERSAL_SECURE')} title="Secure Now" style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#fff' }}>
              <Shield size={16} />
            </button>
            <SyncStatus mini />
          </div>
        )}
        
        <div className="sidebar-user" onClick={logout} title={isCollapsed ? "Logout" : ""}>
          <div className="sidebar-user-avatar">
            {currentUser?.image ? (
              <img src={currentUser.image} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 'inherit' }} />
            ) : (
              currentUser?.name?.charAt(0) || '?'
            )}
          </div>
          <div className="sidebar-user-info">
            <div className="sidebar-user-name">{currentUser?.name}</div>
            <div className="sidebar-user-role">{currentUser?.role}</div>
          </div>
          <LogOut size={16} style={{ color: 'var(--text-sidebar)', opacity: 0.5 }} />
        </div>
      </div>
    </aside>
  );
}
