import { X } from 'lucide-react';

export default function Modal({ isOpen, onClose, title, children, footer, large }) {
  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div 
        className={`modal ${large ? 'modal-lg' : ''}`} 
        onClick={e => e.stopPropagation()}
      >
        <div className="modal-header">
          <h2>{title}</h2>
          <button className="modal-close" onClick={onClose}>
            <X size={18} />
          </button>
        </div>
        <div className="modal-body" style={{ padding: '0 28px 28px', overflowY: 'auto' }}>
          {children}
        </div>
        {footer && (
          <div className="modal-footer" style={{ padding: '20px 28px', borderTop: '1px solid var(--border-light)', background: 'rgba(0,0,0,0.02)' }}>
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
