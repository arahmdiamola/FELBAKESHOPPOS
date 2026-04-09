import { formatCurrency, formatDateTime } from '../../utils/formatters';

export default function ReceiptPreview({ transaction, settings, onClose }) {
  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Receipt</h2>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          <div className="receipt-preview">
            <div className="receipt-header">
              {settings.storeLogo && (
                <img src={settings.storeLogo} alt="Logo" style={{ width: 48, height: 48, objectFit: 'contain', margin: '0 auto 8px', display: 'block', filter: 'grayscale(100%)' }} />
              )}
              <h2>{settings.storeName}</h2>
              <div>{settings.storeAddress}</div>
              <div>{settings.storePhone}</div>
              <div style={{ marginTop: 8 }}>Receipt: {transaction.receiptNumber}</div>
              <div>{formatDateTime(transaction.date)}</div>
              <div>Cashier: {transaction.cashierName}</div>
            </div>

            <div className="receipt-items">
              {transaction.items.map((item, i) => (
                <div key={i} className="receipt-item">
                  <span>{item.name} x{item.quantity}</span>
                  <span>{formatCurrency(item.price * item.quantity)}</span>
                </div>
              ))}
            </div>

            <div className="receipt-totals">
              <div className="receipt-total-row">
                <span>Subtotal</span>
                <span>{formatCurrency(transaction.subtotal)}</span>
              </div>
              {transaction.discount > 0 && (
                <div className="receipt-total-row">
                  <span>Discount</span>
                  <span>-{formatCurrency(transaction.discount)}</span>
                </div>
              )}
              {transaction.tax > 0 && (
                <div className="receipt-total-row">
                  <span>Tax</span>
                  <span>{formatCurrency(transaction.tax)}</span>
                </div>
              )}
              <div className="receipt-total-row grand">
                <span>TOTAL</span>
                <span>{formatCurrency(transaction.total)}</span>
              </div>
              <div className="receipt-total-row" style={{ marginTop: 4 }}>
                <span>Paid ({transaction.paymentMethod})</span>
                <span>{formatCurrency(transaction.amountPaid)}</span>
              </div>
              {transaction.change > 0 && (
                <div className="receipt-total-row">
                  <span>Change</span>
                  <span>{formatCurrency(transaction.change)}</span>
                </div>
              )}
            </div>

            <div className="receipt-footer">
              <div>Customer: {transaction.customerName}</div>
              <div style={{ marginTop: 8 }}>{settings.receiptFooter}</div>
            </div>
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Close</button>
          <button className="btn btn-primary" onClick={handlePrint}>🖨️ Print</button>
        </div>
      </div>
    </div>
  );
}
