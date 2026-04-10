import SyncStatusPill from '../shared/SyncStatusPill';

export default function Header({ title, subtitle, actions }) {
  return (
    <div className="page-header">
      <div className="page-header-left">
        <h1>{title}</h1>
        {subtitle && <p>{subtitle}</p>}
      </div>
      
      <div className="page-header-actions">
        <SyncStatusPill />
        {actions && <div className="flex items-center gap-2">{actions}</div>}
      </div>
    </div>
  );
}
