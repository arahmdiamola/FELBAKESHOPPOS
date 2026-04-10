import { useState, useMemo } from 'react';
import { Search, ShoppingCart, X, Trash2, Pause, Play, Receipt, User, Percent, StickyNote, CheckCircle, Star } from 'lucide-react';
import { useProducts } from '../../contexts/ProductContext';
import { useCustomers } from '../../contexts/CustomerContext';
import { useOrders } from '../../contexts/OrderContext';
import { useAuth } from '../../contexts/AuthContext';
import { useSettings } from '../../contexts/SettingsContext';
import { useToast } from '../../contexts/ToastContext';
import { formatCurrency, generateReceiptNumber } from '../../utils/formatters';
import { calcSubtotal, calcTax, calcCartDiscount } from '../../utils/calculations';
import { v4 as uuidv4 } from 'uuid';
import PaymentModal from './PaymentModal';
import ReceiptPreview from './ReceiptPreview';
import Modal from '../shared/Modal';
import ProcessingOverlay from '../shared/ProcessingOverlay';

export default function POSTerminal() {
  const { products, categories, deductStock } = useProducts();
  const { customers, adjustBalance, recordVisit } = useCustomers();
  const { transactions, addTransaction } = useOrders();
  const { currentUser } = useAuth();
  const { settings } = useSettings();
  const { addToast } = useToast();

  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [cart, setCart] = useState([]);
  const [cartDiscount, setCartDiscount] = useState({ type: 'percentage', value: 0 });
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [notes, setNotes] = useState('');
  const [showPayment, setShowPayment] = useState(false);
  const [showReceipt, setShowReceipt] = useState(false);
  const [lastTransaction, setLastTransaction] = useState(null);
  const [heldOrders, setHeldOrders] = useState([]);
  const [showHeld, setShowHeld] = useState(false);
  const [showCustomerPicker, setShowCustomerPicker] = useState(false);
  const [showDiscount, setShowDiscount] = useState(false);
  const [showNotes, setShowNotes] = useState(false);
  const [customerSearch, setCustomerSearch] = useState('');
  const [isFlashSale, setIsFlashSale] = useState(false);
  const [showSuccessCheckout, setShowSuccessCheckout] = useState(false);
  const [successTransaction, setSuccessTransaction] = useState(null);

  const customerOrderCount = useMemo(() => {
    if (!selectedCustomer) return 0;
    return transactions.filter(t => t.customerId === selectedCustomer.id).length;
  }, [selectedCustomer, transactions]);

  const filteredProducts = useMemo(() => {
    const freqMap = {};
    (transactions || []).forEach(t => {
      (t.items || []).forEach(item => {
        freqMap[item.productId] = (freqMap[item.productId] || 0) + item.quantity;
      });
    });

    let filtered = [...products];
    if (selectedCategory) filtered = filtered.filter(p => p.categoryId === selectedCategory);
    if (search.trim()) {
      const q = search.toLowerCase();
      filtered = filtered.filter(p => p.name.toLowerCase().includes(q));
    }
    
    filtered.sort((a, b) => {
      const freqA = freqMap[a.id] || 0;
      const freqB = freqMap[b.id] || 0;
      if (freqB !== freqA) return freqB - freqA;
      return a.name.localeCompare(b.name);
    });

    let rank = 1;
    filtered.forEach(p => {
      p.isTopSelling = false;
      const freq = freqMap[p.id] || 0;
      if (freq > 0 && rank <= 3 && !search.trim() && !selectedCategory) {
        p.isTopSelling = rank;
        rank++;
      }
    });

    return filtered;
  }, [products, selectedCategory, search, transactions]);

  const filteredCustomers = useMemo(() => {
    if (!customerSearch.trim()) return customers;
    const q = customerSearch.toLowerCase();
    return customers.filter(c =>
      c.name.toLowerCase().includes(q) || c.phone?.includes(q)
    );
  }, [customers, customerSearch]);

  const [isProcessing, setIsProcessing] = useState(false);

  const subtotal = calcSubtotal(cart);
  const discount = calcCartDiscount(subtotal, cartDiscount.type, cartDiscount.value);
  const flashSaleDiscount = isFlashSale ? (subtotal * (settings.flashSalePercent / 100)) : 0;
  const taxableAmount = subtotal - discount - flashSaleDiscount;
  const tax = calcTax(taxableAmount, settings.taxRate);
  const total = taxableAmount + tax;

  const addToCart = (product) => {
    if (product.stock <= 0) {
      addToast('Out of stock!', 'error');
      return;
    }
    setCart(prev => {
      const existing = prev.find(i => i.productId === product.id);
      if (existing) {
        if (existing.quantity >= product.stock) {
          addToast('Not enough stock', 'warning');
          return prev;
        }
        return prev.map(i => i.productId === product.id ? { ...i, quantity: i.quantity + 1 } : i);
      }
      return [...prev, {
        id: uuidv4(),
        productId: product.id,
        name: product.name,
        price: product.price,
        costPrice: product.costPrice,
        quantity: 1,
        unit: product.unit,
        discount: 0,
      }];
    });
  };

  const updateQuantity = (itemId, delta) => {
    setCart(prev => prev.map(i => {
      if (i.id === itemId) {
        const newQty = Math.max(1, i.quantity + delta);
        const product = products.find(p => p.id === i.productId);
        if (product && newQty > product.stock) {
          addToast('Not enough stock', 'warning');
          return i;
        }
        return { ...i, quantity: newQty };
      }
      return i;
    }));
  };

  const removeFromCart = (itemId) => setCart(prev => prev.filter(i => i.id !== itemId));

  const clearCart = () => {
    setCart([]);
    setCartDiscount({ type: 'percentage', value: 0 });
    setSelectedCustomer(null);
    setNotes('');
  };

  const holdOrder = () => {
    if (cart.length === 0) return;
    setHeldOrders(prev => [...prev, {
      id: uuidv4(), items: cart, customer: selectedCustomer,
      discount: cartDiscount, notes, time: new Date().toISOString(),
    }]);
    clearCart();
    addToast('Order held', 'success');
  };

  const recallOrder = (orderId) => {
    const order = heldOrders.find(o => o.id === orderId);
    if (order) {
      setCart(order.items);
      setSelectedCustomer(order.customer);
      setCartDiscount(order.discount);
      setNotes(order.notes);
      setHeldOrders(prev => prev.filter(o => o.id !== orderId));
      setShowHeld(false);
    }
  };

  const completePayment = async (paymentMethod, amountPaid) => {
    if (isProcessing) return;
    setIsProcessing(true);
    try {
      const transaction = {
        id: uuidv4(),
        receiptNumber: generateReceiptNumber(),
        items: cart.map(i => ({ ...i, total: i.price * i.quantity * (1 - (i.discount || 0) / 100) })),
        subtotal, discount, tax, total, paymentMethod,
        amountPaid: paymentMethod === 'cash' ? amountPaid : total,
        change: paymentMethod === 'cash' ? Math.max(0, amountPaid - total) : 0,
        customerId: selectedCustomer?.id || null,
        customerName: selectedCustomer?.name || 'Walk-in Customer',
        cashierId: currentUser.id,
        cashierName: currentUser.name,
        date: new Date().toISOString(),
        status: 'completed',
        notes,
      };

      // 1. IMPROVED: Parallel Background Execution
      const tasks = [
        addTransaction(transaction),
        deductStock(cart.map(i => ({ productId: i.productId, quantity: i.quantity })))
      ];

      if (paymentMethod === 'on_account' && selectedCustomer) {
        tasks.push(adjustBalance(selectedCustomer.id, total));
      }
      if (selectedCustomer) {
        tasks.push(recordVisit(selectedCustomer.id, total));
      }

      // 2. Perform all saves in parallel
      await Promise.all(tasks);

      // 3. Instant UI feedback
      setSuccessTransaction(transaction);
      setShowSuccessCheckout(true);
      setShowPayment(false); 
      
      setCart([]);
      setCartDiscount({ type: 'percentage', value: 0 });
      setSelectedCustomer(null);
      setNotes('');
      setLastTransaction(transaction);
      setIsFlashSale(false); 
    } catch (error) {
      console.error('Checkout failed:', error);
      addToast('Failed to complete sale', 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="pos-layout">
      {/* Product Area */}
      <div className="pos-products">
        <div className="pos-products-header">
          <div className="search-bar">
            <Search />
            <input
              id="pos-search"
              type="text"
              placeholder="Search products..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              autoFocus
            />
          </div>
          <div className="pos-categories">
            <button className={`pos-category-btn ${!selectedCategory ? 'active' : ''}`} onClick={() => setSelectedCategory(null)}>All</button>
            {categories.map(cat => (
              <button
                key={cat.id}
                className={`pos-category-btn ${selectedCategory === cat.id ? 'active' : ''}`}
                onClick={() => setSelectedCategory(cat.id)}
              >
                <span>{cat.emoji}</span>
                {cat.name}
              </button>
            ))}
          </div>
        </div>

        <div className="pos-grid">
          {filteredProducts.map(product => (
            <div 
              key={product.id} 
              className={`pos-product-card ${product.isTopSelling ? 'top-seller' : ''} ${product.stock <= 0 ? 'out-of-stock' : product.stock <= product.reorderPoint ? 'glow-low-stock' : ''}`}
              onClick={() => addToCart(product)}
            >
              {product.stock <= 0 ? (
                <div className="top-badge" style={{ background: '#454545', right: 'auto', left: 8, transform: 'translateX(-4px)' }}>EMPTY</div>
              ) : product.stock <= product.reorderPoint ? (
                <div className="top-badge" style={{ background: 'var(--danger)', right: 'auto', left: 8, transform: 'translateX(-4px)' }}>LOW</div>
              ) : null}
              {product.isTopSelling === 1 && <div className="top-badge">🏆 #1 Seller</div>}
              {product.isTopSelling === 2 && <div className="top-badge">🔥 Hot Item</div>}
              {product.isTopSelling === 3 && <div className="top-badge">⭐ Popular</div>}
              
              {product.image ? (
                <div style={{ width: 80, height: 80, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 4 }}>
                  <img 
                    src={product.image} 
                    alt={product.name} 
                    loading="lazy" 
                    style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 'var(--radius-md)' }} 
                  />
                </div>
              ) : (
                <div className="product-emoji" style={{ fontSize: '2.5rem' }}>{product.emoji}</div>
              )}

              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4, width: '100%' }}>
                <div className="product-name" style={{ minHeight: '2.4em', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {product.name}
                </div>
                <div className="product-price">{formatCurrency(product.price)}</div>
              </div>

              <div className={`product-stock ${product.stock <= product.reorderPoint ? 'low' : ''}`} style={{ marginTop: 'auto', paddingTop: 8, fontSize: '0.7rem' }}>
                {product.stock} {product.unit}
              </div>
            </div>
          ))}
          {filteredProducts.length === 0 && (
            <div className="empty-state" style={{ gridColumn: '1 / -1' }}>
              <Search size={48} />
              <h3>No products found</h3>
              <p>Try a different search or category</p>
            </div>
          )}
        </div>
      </div>

      {/* Cart */}
      <div className="pos-cart">
        <div className="pos-cart-header">
          <h3>
            <ShoppingCart size={20} />
            Current Sale
            {cart.length > 0 && <span className="cart-count">{cart.length}</span>}
          </h3>
          {cart.length > 0 && (
            <button className="btn btn-ghost btn-sm" onClick={clearCart}>
              <Trash2 size={16} /> Clear
            </button>
          )}
        </div>

        <div className="pos-cart-customer">
          {selectedCustomer ? (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div style={{ position: 'relative' }}>
                  <User size={18} style={{ color: 'var(--accent)' }} />
                  {customerOrderCount >= settings.vipThreshold && (
                    <div style={{ position: 'absolute', top: -5, right: -5, background: '#FFD700', borderRadius: '50%', padding: 1, border: '1px solid #fff' }}>
                      <Star size={8} fill="#2C1810" />
                    </div>
                  )}
                </div>
                <div>
                  <div className="text-sm font-bold flex items-center gap-2">
                    {selectedCustomer.name}
                    {customerOrderCount >= settings.vipThreshold && <span className="vip-badge"><Star size={8} fill="currentColor" /> REGULAR</span>}
                  </div>
                  <div className="text-xs text-muted">{customerOrderCount} Lifetime Orders</div>
                </div>
              </div>
              <button className="btn btn-ghost btn-icon btn-sm" onClick={() => setSelectedCustomer(null)}>
                <X size={14} />
              </button>
            </div>
          ) : (
            <button className="btn btn-secondary btn-sm btn-block" onClick={() => setShowCustomerPicker(true)}>
              <User size={16} /> Add Customer
            </button>
          )}
        </div>

        <div className="pos-cart-items">
          {cart.length === 0 ? (
            <div className="cart-empty">
              <ShoppingCart size={48} />
              <p>Cart is empty</p>
              <p className="text-sm text-muted">Tap products to add them</p>
            </div>
          ) : (
            cart.map(item => (
              <div key={item.id} className="cart-item">
                <div className="cart-item-info">
                  <div className="item-name">{item.name}</div>
                  <div className="item-price">{formatCurrency(item.price)} / {item.unit}</div>
                </div>
                <div className="cart-item-qty">
                  <button onClick={() => updateQuantity(item.id, -1)}>−</button>
                  <span className="qty-value">{item.quantity}</span>
                  <button onClick={() => updateQuantity(item.id, 1)}>+</button>
                </div>
                <div className="cart-item-total">{formatCurrency(item.price * item.quantity)}</div>
                <button className="cart-item-remove" onClick={() => removeFromCart(item.id)}>
                  <X size={14} />
                </button>
              </div>
            ))
          )}
        </div>

        {cart.length > 0 && (
          <div className="pos-cart-summary">
            {/* Flash Sale Toggle - Admin/Manager Only */}
            {['system_admin', 'owner', 'manager'].includes(currentUser?.role) && (
              <div className="flex items-center justify-between mb-4 p-2" style={{ background: isFlashSale ? 'var(--danger-light)' : 'rgba(0,0,0,0.02)', borderColor: isFlashSale ? 'var(--danger)' : 'transparent', borderRadius: 12, border: '1px solid transparent' }}>
                <div className="flex items-center gap-2">
                  <Percent size={14} className={isFlashSale ? 'flash-sale-active' : ''} />
                  <span className={`text-xs font-bold ${isFlashSale ? 'flash-sale-active' : ''}`}>
                    Flash Sale ({settings.flashSalePercent}% OFF)
                  </span>
                </div>
                <button 
                  className={`switch ${isFlashSale ? 'active' : ''}`}
                  onClick={() => setIsFlashSale(!isFlashSale)}
                  style={{ width: 40, height: 20, background: isFlashSale ? 'var(--danger)' : 'var(--border)', borderRadius: 10, position: 'relative', cursor: 'pointer', border: 'none' }}
                >
                  <div style={{ position: 'absolute', left: isFlashSale ? 22 : 2, top: 2, width: 16, height: 16, background: '#fff', borderRadius: '50%', transition: 'all 0.2s' }} />
                </button>
              </div>
            )}

            <div className="cart-summary-row"><span>Subtotal</span><span>{formatCurrency(subtotal)}</span></div>
            {flashSaleDiscount > 0 && (
              <div className="cart-summary-row" style={{ color: 'var(--danger)' }}>
                <span>Flash Sale Discount</span><span>-{formatCurrency(flashSaleDiscount)}</span>
              </div>
            )}
            {discount > 0 && (
              <div className="cart-summary-row" style={{ color: 'var(--success)' }}>
                <span>Discount</span><span>-{formatCurrency(discount)}</span>
              </div>
            )}
            {tax > 0 && (
              <div className="cart-summary-row"><span>Tax ({settings.taxRate}%)</span><span>{formatCurrency(tax)}</span></div>
            )}
            <div className="cart-summary-row total"><span>Total</span><span>{formatCurrency(total)}</span></div>
          </div>
        )}

        <div className="pos-cart-actions">
          <button className="btn btn-pay" disabled={cart.length === 0} onClick={() => setShowPayment(true)} id="btn-pay">
            <Receipt size={22} /> Charge {formatCurrency(total)}
          </button>
          <div className="cart-action-buttons">
            <button className="btn btn-secondary btn-sm" onClick={() => setShowDiscount(true)} disabled={cart.length === 0}>
              <Percent size={14} /> Discount
            </button>
            <button className="btn btn-secondary btn-sm" onClick={holdOrder} disabled={cart.length === 0}>
              <Pause size={14} /> Hold
            </button>
            <button className="btn btn-secondary btn-sm" onClick={() => setShowHeld(true)} disabled={heldOrders.length === 0}>
              <Play size={14} /> Recall ({heldOrders.length})
            </button>
            <button className="btn btn-secondary btn-sm" onClick={() => setShowNotes(true)}>
              <StickyNote size={14} />
            </button>
          </div>
        </div>
      </div>

      {/* Modals */}
      <ProcessingOverlay isProcessing={isProcessing} message="Finalizing Transaction..." />
      {showPayment && <PaymentModal total={total} customer={selectedCustomer} onComplete={completePayment} isProcessing={isProcessing} onClose={() => setShowPayment(false)} />}
      {showReceipt && lastTransaction && (
        <ReceiptPreview 
          transaction={lastTransaction} 
          settings={settings} 
          onClose={() => setShowReceipt(false)} 
        />
      )}

      {/* Success Celebration Modal */}
      {showSuccessCheckout && successTransaction && (
        <Modal 
          onClose={() => { setShowSuccessCheckout(false); setSuccessTransaction(null); }}
          title="Payment Success"
          maxWidth="500px"
        >
          <div style={{ textAlign: 'center', padding: '20px 0' }}>
            <div className="success-check-anim">
              <CheckCircle size={48} />
            </div>
            <h2 style={{ fontSize: '1.8rem', fontWeight: 900, marginBottom: 8 }}>Sale Completed!</h2>
            <div style={{ fontSize: '1.1rem', color: 'var(--text-secondary)', marginBottom: 24 }}>
              Total Received: <span style={{ fontWeight: 800, color: 'var(--success)' }}>{formatCurrency(successTransaction.total)}</span>
            </div>
            
            <div style={{ border: '1px solid var(--border-light)', borderRadius: 16, overflow: 'hidden', marginBottom: 24, maxHeight: 300, overflowY: 'auto', background: '#fff' }}>
              <ReceiptPreview 
                transaction={successTransaction} 
                settings={settings} 
                onClose={() => {}} 
                isEmbed 
              />
            </div>
            
            <button 
              className="btn btn-primary btn-block" 
              style={{ padding: 16, fontSize: '1.1rem', fontWeight: 800 }}
              onClick={() => { setShowSuccessCheckout(false); setSuccessTransaction(null); }}
            >
              START NEW SALE
            </button>
          </div>
        </Modal>
      )}

      <Modal isOpen={showCustomerPicker} onClose={() => setShowCustomerPicker(false)} title="Select Customer">
        <div className="search-bar mb-4">
          <Search />
          <input placeholder="Search customers..." value={customerSearch} onChange={e => setCustomerSearch(e.target.value)} />
        </div>
        <div style={{ maxHeight: 300, overflow: 'auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {filteredCustomers.map(c => (
            <button key={c.id} className="held-order-card" onClick={() => { setSelectedCustomer(c); setShowCustomerPicker(false); setCustomerSearch(''); }} style={{ textAlign: 'left' }}>
              <div className="font-bold">{c.name}</div>
              <div className="text-sm text-muted">{c.phone}</div>
            </button>
          ))}
        </div>
      </Modal>

      <Modal isOpen={showDiscount} onClose={() => setShowDiscount(false)} title="Apply Discount"
        footer={<button className="btn btn-primary" onClick={() => setShowDiscount(false)}>Apply</button>}>
        <div className="form-grid">
          <div className="input-group">
            <label>Discount Type</label>
            <select className="select" value={cartDiscount.type} onChange={e => setCartDiscount(prev => ({ ...prev, type: e.target.value }))}>
              <option value="percentage">Percentage (%)</option>
              <option value="fixed">Fixed Amount (₱)</option>
            </select>
          </div>
          <div className="input-group">
            <label>Value</label>
            <input className="input" type="number" min="0" value={cartDiscount.value} onChange={e => setCartDiscount(prev => ({ ...prev, value: parseFloat(e.target.value) || 0 }))} />
          </div>
        </div>
      </Modal>

      <Modal isOpen={showNotes} onClose={() => setShowNotes(false)} title="Order Notes"
        footer={<button className="btn btn-primary" onClick={() => setShowNotes(false)}>Save</button>}>
        <div className="input-group">
          <label>Notes (special requests, packaging, etc.)</label>
          <textarea className="input" rows={4} value={notes} onChange={e => setNotes(e.target.value)} placeholder="Add notes..." />
        </div>
      </Modal>

      <Modal isOpen={showHeld} onClose={() => setShowHeld(false)} title={`Held Orders (${heldOrders.length})`}>
        {heldOrders.length === 0 ? (
          <div className="empty-state"><p>No held orders</p></div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {heldOrders.map(order => (
              <div key={order.id} className="held-order-card" onClick={() => recallOrder(order.id)}>
                <div className="flex justify-between items-center mb-2">
                  <span className="font-bold">{order.customer?.name || 'Walk-in'}</span>
                  <span className="text-sm text-muted">{new Date(order.time).toLocaleTimeString()}</span>
                </div>
                <div className="text-sm text-muted">{order.items.length} items • {formatCurrency(order.items.reduce((s, i) => s + i.price * i.quantity, 0))}</div>
              </div>
            ))}
          </div>
        )}
      </Modal>
    </div>
  );
}
