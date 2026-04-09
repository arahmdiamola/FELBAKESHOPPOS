// Calculate cart subtotal
export const calcSubtotal = (items) => {
  return items.reduce((sum, item) => {
    const itemDiscount = item.discount || 0;
    return sum + (item.price * item.quantity * (1 - itemDiscount / 100));
  }, 0);
};

// Calculate tax
export const calcTax = (amount, taxRate) => {
  return amount * (taxRate / 100);
};

// Calculate cart-level discount
export const calcCartDiscount = (subtotal, type, value) => {
  if (!value || value <= 0) return 0;
  if (type === 'percentage') {
    return subtotal * Math.min(value, 100) / 100;
  }
  return Math.min(value, subtotal);
};
