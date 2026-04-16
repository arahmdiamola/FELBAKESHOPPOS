import { useState, useRef, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { api } from '../../utils/api';
import { Globe, Building, ChevronDown, Check, Search, MapPin } from 'lucide-react';
import './BranchSwitcher.css';

export default function BranchSwitcher() {
  const { currentUser, activeBranch, switchBranch } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [branches, setBranches] = useState([]);
  const [search, setSearch] = useState('');
  const dropdownRef = useRef(null);

  const isGlobalAdmin = currentUser?.role === 'system_admin' || (currentUser?.role === 'owner' && !currentUser?.branchId);

  useEffect(() => {
    if (isGlobalAdmin) {
      api.get('/branches')
        .then(data => setBranches(data.sort((a,b) => a.name.localeCompare(b.name))))
        .catch(console.error);
    }
  }, [isGlobalAdmin]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (!isGlobalAdmin) return null;

  const currentBranch = activeBranch === 'all' 
    ? { name: 'All Branches', icon: Globe }
    : { name: branches.find(b => b.id === activeBranch)?.name || 'Loading...', icon: Building };

  const filteredBranches = branches.filter(b => 
    b.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="branch-hub-container" ref={dropdownRef}>
      <button 
        className={`branch-hub-pill ${activeBranch === 'all' ? 'global-active' : ''}`}
        onClick={() => setIsOpen(!isOpen)}
      >
        <div className="pill-icon">
          {activeBranch === 'all' ? <Globe size={16} className="pulse-slow" /> : <Building size={16} />}
        </div>
        <div className="pill-info">
          <span className="pill-label">Environment</span>
          <span className="pill-value">{currentBranch.name}</span>
        </div>
        <ChevronDown size={14} className={`pill-chevron ${isOpen ? 'rotated' : ''}`} />
      </button>

      {isOpen && (
        <div className="branch-hub-dropdown animate-scale-in">
          <div className="hub-search">
            <Search size={14} />
            <input 
              placeholder="Search branches..." 
              value={search}
              onChange={e => setSearch(e.target.value)}
              autoFocus
            />
          </div>

          <div className="hub-options-list">
            <button 
              className={`hub-option ${activeBranch === 'all' ? 'active' : ''}`}
              onClick={() => { switchBranch('all'); setIsOpen(false); }}
            >
              <div className="option-icon"><Globe size={16} /></div>
              <div className="option-meta">
                <span className="option-name">Global Mission View</span>
                <span className="option-sub">Aggregated data from across the empire</span>
              </div>
              {activeBranch === 'all' && <Check size={16} className="text-accent" />}
            </button>

            <div className="hub-divider">SELECT LOCATION</div>

            {filteredBranches.map(b => (
              <button 
                key={b.id}
                className={`hub-option ${activeBranch === b.id ? 'active' : ''}`}
                onClick={() => { switchBranch(b.id); setIsOpen(false); }}
              >
                <div className="option-icon"><Building size={16} /></div>
                <div className="option-meta">
                  <span className="option-name">{b.name}</span>
                  <span className="option-sub flex items-center gap-1">
                    <MapPin size={10} /> {b.address || 'Local Branch'}
                  </span>
                </div>
                {activeBranch === b.id && <Check size={16} className="text-accent" />}
              </button>
            ))}

            {filteredBranches.length === 0 && search && (
              <div className="hub-empty">No branches match "{search}"</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
