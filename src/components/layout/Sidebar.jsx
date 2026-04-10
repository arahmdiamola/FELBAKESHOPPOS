import { NavLink, useLocation } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useSettings } from '../../contexts/SettingsContext';
import { api } from '../../utils/api';
import SyncStatus from '../shared/SyncStatus';
import {
  ShoppingBag, LayoutDashboard, Package, ClipboardList,
  Users, Wallet, Settings, LogOut, CalendarClock, Boxes, Menu, ChevronsLeft
} from 'lucide-react';

const navItems = [
  { to: '/pos', icon: ShoppingBag, label: 'POS Register' },
  { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/reports', icon: ClipboardList, label: 'Reports' },
  { section: 'Management' },
  { to: '/products', icon: Package, label: 'Products' },
  { to: '/inventory', icon: Boxes, label: 'Inventory' },
  { to: '/preorders', icon: CalendarClock, label: 'Pre-Orders' },
  { to: '/customers', icon: Users, label: 'Customers' },
  { to: '/expenses', icon: Wallet, label: 'Expenses' },
  { section: 'System' },
  { to: '/users', icon: Users, label: 'Users' },
  { to: '/settings', icon: Settings, label: 'Settings' },
];

export default function Sidebar() {
  const { currentUser, logout, activeBranch, switchBranch } = useAuth();
  const { settings } = useSettings();
  const location = useLocation();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [branches, setBranches] = useState([]);

  useEffect(() => {
    if (currentUser?.role === 'system_admin') {
      api.get('/branches')
        .then(data => {
          const sorted = data.sort((a, b) => a.name.localeCompare(b.name));
          setBranches(sorted);
        })
        .catch(console.error);
    }
  }, [currentUser]);

  const handleBranchChange = (e) => {
    switchBranch(e.target.value);
  };

  const visibleNavItems = navItems.filter(item => {
    if (item.section) return true;
    if (currentUser?.role === 'cashier') {
      return !['/reports', '/expenses', '/users', '/settings'].includes(item.to);
    }
    if (currentUser?.role === 'manager') {
      return !['/users', '/settings'].includes(item.to);
    }
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
    <aside className={`sidebar glass-sidebar ${isCollapsed ? 'collapsed' : ''}`}>
      <div className="sidebar-brand" style={{ position: 'relative', padding: isCollapsed ? '26px 0' : '26px 20px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
        {isCollapsed ? (
          <button 
            onClick={() => setIsCollapsed(false)}
            className="sidebar-toggle-btn"
            title="Expand"
          >
            <Menu size={24} />
          </button>
        ) : (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              {settings.storeLogo ? (
                <img src={settings.storeLogo} alt="Logo" className="sidebar-brand-icon" style={{ background: '#fff', objectFit: 'contain', padding: 2, borderRadius: 10 }} />
              ) : (
                <div className="sidebar-brand-icon" style={{ borderRadius: 10 }}>🧁</div>
              )}
              <div className="sidebar-brand-text">
                <span className="sidebar-brand-name" style={{ fontWeight: 800, fontSize: '1.2rem', letterSpacing: '-0.5px' }}>{settings.storeName}</span>
                <span className="sidebar-brand-sub" style={{ opacity: 0.5, fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  {currentUser?.role === 'system_admin' ? 'Central' : (currentUser?.branchName || 'Active')}
                </span>
              </div>
            </div>
            <button 
              onClick={() => setIsCollapsed(true)}
              className="sidebar-collapse-toggle"
              title="Collapse"
            >
              <ChevronsLeft size={16} />
            </button>
          </>
        )}
      </div>

      {currentUser?.role === 'system_admin' && !isCollapsed && (
        <div style={{ padding: '20px 20px 10px' }}>
          <select 
            className="select-ios" 
            value={activeBranch}
            onChange={handleBranchChange}
          >
            <option value="all">🌐 All Branches</option>
            {branches.map(b => (
              <option key={b.id} value={b.id}>🏢 {b.name}</option>
            ))}
          </select>
        </div>
      )}

      <nav className="sidebar-nav" style={{ padding: '16px 12px' }}>
        {finalNavItems.map((item, i) => {
          if (item.section) {
            return <div key={i} className="sidebar-section-label" style={{ paddingLeft: 12, marginTop: 24, textTransform: 'uppercase', fontSize: '0.65rem', letterSpacing: '1px', opacity: 0.4 }}>{item.section}</div>;
          }

          const Icon = item.icon;
          const isActive = location.pathname === item.to;

          return (
            <NavLink
              key={item.to}
              to={item.to}
              className={`sidebar-link-ios ${isActive ? 'active' : ''}`}
              title={isCollapsed ? item.label : ''}
              style={{ margin: '4px 0', borderRadius: 12 }}
            >
              <Icon size={20} strokeWidth={isActive ? 2.5 : 2} />
              <span style={{ fontWeight: isActive ? 700 : 500 }}>{item.label}</span>
            </NavLink>
          );
        })}
      </nav>

      <div className="sidebar-footer" style={{ borderTop: '1px solid rgba(255,255,255,0.05)', background: 'transparent' }}>
        {!isCollapsed && <SyncStatus />}
        {isCollapsed && <div style={{ display: 'flex', justifyContent: 'center', padding: '10px 0' }}><SyncStatus mini /></div>}
        
        <div className="sidebar-user glass-user-pill" onClick={logout} title={isCollapsed ? "Logout" : ""} style={{ margin: '12px', borderRadius: 16 }}>
          <div className="sidebar-user-avatar" style={{ background: 'var(--accent-gradient)', boxShadow: '0 4px 12px rgba(0,0,0,0.2)' }}>
            {currentUser?.name?.charAt(0) || '?'}
          </div>
          <div className="sidebar-user-info">
            <div className="sidebar-user-name" style={{ fontWeight: 700 }}>{currentUser?.name}</div>
            <div className="sidebar-user-role" style={{ opacity: 0.5 }}>{currentUser?.role}</div>
          </div>
          <LogOut size={16} style={{ color: '#fff', opacity: 0.4 }} />
        </div>
      </div>
    </aside>
  );
}
