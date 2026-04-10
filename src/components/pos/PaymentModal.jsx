import { useState } from 'react';
import { formatCurrency } from '../../utils/formatters';
import { Banknote, CreditCard, Smartphone, BookOpen } from 'lucide-react';

const METHODS = [
  { id: 'cash', name: 'Cash', icon: '💵', Icn: Banknote },
  { id: 'gcash', name: 'GCash', icon: '📱', Icn: Smartphone },
  { id: 'card', name: 'Card', icon: '💳', Icn: CreditCard },
  { id: 'on_account', name: 'On Account', icon: '📒', Icn: BookOpen },
];

export default function PaymentModal({ total, customer, onComplete, isProcessing, onClose }) {
  const [method, setMethod] = useState('cash');
  const [amountPaid, setAmountPaid] = useState('');

  const paid = parseFloat(amountPaid) || 0;
  const change = Math.max(0, paid - total);
  const canPay = (method !== 'cash' || paid >= total) && !isProcessing;

  const quickAmounts = [
    Math.ceil(total / 10) * 10,
    Math.ceil(total / 50) * 50,
    Math.ceil(total / 100) * 100,
    Math.ceil(total / 500) * 500,
  ].filter((v, i, arr) => arr.indexOf(v) === i && v >= total).slice(0, 4);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-lg" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Payment</h2>
          <button className="modal-close" onClick={onClose} disabled={isProcessing}>✕</button>
        </div>
        <div className="modal-body">
          <div className="payment-total">
            <label>TOTAL AMOUNT</label>
            <div className="amount">{formatCurrency(total)}</div>
          </div>

          <div className="payment-methods">
            {METHODS.map(m => (
              <button
                key={m.id}
                className={`payment-method-btn ${method === m.id ? 'active' : ''}`}
                onClick={() => setMethod(m.id)}
                disabled={isProcessing || (m.id === 'on_account' && !customer)}
              >
                <span className="method-icon">{m.icon}</span>
                <span className="method-name">{m.name}</span>
              </button>
            ))}
          </div>

          {method === 'cash' && (
            <>
              <div className="input-group mb-3">
                <label>Amount Received</label>
                <input
                  className="input"
                  type="number"
                  placeholder="Enter amount..."
                  value={amountPaid}
                  onChange={e => setAmountPaid(e.target.value)}
                  autoFocus
                  disabled={isProcessing}
                  style={{ fontSize: '1.3rem', fontWeight: 700, textAlign: 'center' }}
                />
              </div>
              <div className="flex gap-2 mb-3" style={{ flexWrap: 'wrap' }}>
                {quickAmounts.map(amt => (
                  <button
                    key={amt}
                    className="btn btn-secondary btn-sm"
                    onClick={() => setAmountPaid(String(amt))}
                    disabled={isProcessing}
                    style={{ flex: '1 0 auto' }}
                  >
                    {formatCurrency(amt)}
                  </button>
                ))}
              </div>
              {paid >= total && (
                <div className="change-display">
                  <label>CHANGE</label>
                  <div className="change-amount">{formatCurrency(change)}</div>
                </div>
              )}
            </>
          )}
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose} disabled={isProcessing}>Cancel</button>
          <button
            className={`btn btn-primary btn-lg ${isProcessing ? 'loading' : ''}`}
            disabled={!canPay}
            onClick={() => onComplete(method, paid)}
            style={{ minWidth: 200 }}
          >
            {isProcessing ? 'Processing Transaction...' : 'Complete Sale'}
          </button>
        </div>
      </div>
    </div>
  );
}
