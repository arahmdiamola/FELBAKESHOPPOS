import BranchSwitcher from './BranchSwitcher';

export default function Header({ title, subtitle, actions }) {
  return (
    <div className="page-header">
      <div className="page-header-left">
        <div className="flex flex-col">
          <h1 className="text-xl font-bold leading-none">{title}</h1>
          {subtitle && <p className="text-xs opacity-50 mt-1">{subtitle}</p>}
        </div>
      </div>

      {/* CENTRAL COMMAND HUB - For Global Admins */}
      <div className="page-header-center">
        <BranchSwitcher />
      </div>
      
      <div className="page-header-actions">
        {actions && <div className="flex items-center gap-2">{actions}</div>}
      </div>
    </div>
  );
}
