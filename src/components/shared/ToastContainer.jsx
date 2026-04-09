import { useToast } from '../../contexts/ToastContext';
import { CheckCircle, AlertTriangle, Info, XCircle } from 'lucide-react';

const icons = {
  success: <CheckCircle size={18} />,
  error: <XCircle size={18} />,
  warning: <AlertTriangle size={18} />,
  info: <Info size={18} />,
};

const colors = {
  success: { bg: '#E8F5E9', border: '#4CAF50', color: '#2E7D32' },
  error: { bg: '#FDEDEB', border: '#E74C3C', color: '#C62828' },
  warning: { bg: '#FFF8E1', border: '#F5A623', color: '#E65100' },
  info: { bg: '#E3F2FD', border: '#5B9BD5', color: '#1565C0' },
};

export default function ToastContainer() {
  const { toasts } = useToast();

  return (
    <div style={{
      position: 'fixed',
      top: 20,
      right: 20,
      zIndex: 9999,
      display: 'flex',
      flexDirection: 'column',
      gap: 8,
    }}>
      {toasts.map(toast => {
        const c = colors[toast.type] || colors.info;
        return (
          <div
            key={toast.id}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '12px 18px',
              background: c.bg,
              border: `1px solid ${c.border}`,
              borderRadius: 12,
              color: c.color,
              fontWeight: 700,
              fontSize: '0.85rem',
              boxShadow: '0 4px 16px rgba(0,0,0,0.1)',
              animation: 'slideIn 0.25s ease',
              minWidth: 240,
            }}
          >
            {icons[toast.type]}
            {toast.message}
          </div>
        );
      })}
    </div>
  );
}
