// Currency formatter — Philippine Peso
export const formatCurrency = (amount) => {
  return new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
    minimumFractionDigits: 2,
  }).format(amount || 0);
};

// Date formatter
export const formatDate = (dateStr) => {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
};

// Date + time
export const formatDateTime = (dateStr) => {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

// Short time
export const formatTime = (dateStr) => {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
  });
};

// Number with commas
export const formatNumber = (num) => {
  return new Intl.NumberFormat('en-US').format(num || 0);
};

// Unique Device ID for offline collision prevention
const getDeviceId = () => {
  let id = localStorage.getItem('fel_device_id');
  if (!id) {
    id = Math.random().toString(36).substring(2, 6).toUpperCase();
    localStorage.setItem('fel_device_id', id);
  }
  return id;
};

// Receipt number generator
export const generateReceiptNumber = () => {
  const now = new Date();
  const device = getDeviceId();
  const dateStr = now.toISOString().slice(2, 10).replace(/-/g, '');
  const randomSuffix = Math.floor(Math.random() * 999).toString().padStart(3, '0');
  return `RC-${device}-${dateStr}-${randomSuffix}`;
};

// CSV Export Utility
export const exportToCSV = (data, filename, columns) => {
  if (!data || !data.length) return;
  
  // Create headers
  const headers = columns.map(col => col.header).join(',');
  
  // Format rows
  const rows = data.map(row => {
    return columns.map(col => {
      let val = col.accessor(row);
      // Escape quotes and wrap in quotes if contains comma
      if (typeof val === 'string') {
        val = val.replace(/"/g, '""');
        if (val.includes(',') || val.includes('\n') || val.includes('"')) {
          val = `"${val}"`;
        }
      }
      return val;
    }).join(',');
  });
  
  const csvContent = [headers, ...rows].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `${filename}_${new Date().toISOString().slice(0, 10)}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};
