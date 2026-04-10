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

      {currentUser?.role === 'system_admin' && !isCollapsed && (
        <div style={{ padding: '0 20px', marginBottom: '16px' }}>
          <select 
            className="select" 
            style={{ width: '100%', background: 'rgba(255,255,255,0.1)', borderColor: 'rgba(255,255,255,0.1)', color: 'var(--text-sidebar)', outline: 'none' }}
            value={activeBranch}
            onChange={handleBranchChange}
          >
            <option value="all" style={{ color: '#000' }}>🌐 All Branches</option>
            {branches.map(b => (
              <option key={b.id} value={b.id} style={{ color: '#000' }}>🏢 {b.name} {b.address ? `- ${b.address}` : ''}</option>
            ))}
          </select>
        </div>
      )}

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
            >
              <Icon size={18} />
              <span>{item.label}</span>
            </NavLink>
          );
        })}
      </nav>

      <div style={{ marginTop: 'auto' }}>
        {!isCollapsed && <SyncStatus />}
        {isCollapsed && <div style={{ display: 'flex', justifyContent: 'center', padding: '10px 0' }}><SyncStatus mini /></div>}
      </div>

      <div className="sidebar-footer">
        <div className="sidebar-user" onClick={logout} title={isCollapsed ? "Logout" : ""}>
          <div className="sidebar-user-avatar">
            {currentUser?.name?.charAt(0) || '?'}
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
