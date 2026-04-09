import { useState, useRef } from 'react';
import Modal from '../shared/Modal';
import { v4 as uuidv4 } from 'uuid';
import { Upload, AlertCircle } from 'lucide-react';

export default function BatchUploadModal({ isOpen, onClose, onUpload, categories }) {
  const [fileData, setFileData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [errorStatus, setErrorStatus] = useState('');
  const fileInputRef = useRef(null);

  // Vanilla CSV parser handling basic quotes and structural integrity
  const parseCSV = (text) => {
    const lines = text.split(/\r?\n/).filter(line => line.trim() !== '');
    if (lines.length < 2) return [];

    const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/"/g, ''));
    
    const requiredHeaders = ['name', 'price'];
    const missing = requiredHeaders.filter(h => !headers.includes(h));
    if (missing.length > 0) {
      throw new Error(`Missing required columns: ${missing.join(', ')}`);
    }

    const data = [];
    for (let i = 1; i < lines.length; i++) {
      // Split ignoring commas inside quotes
      const rowRegex = /(".*?"|[^",\s]+)(?=\s*,|\s*$)/g;
      
      // Simpler safe split fallback if regex is unreliable for empty fields
      const cols = [];
      let current = '';
      let inQuotes = false;
      for (let char of lines[i]) {
        if (char === '"') inQuotes = !inQuotes;
        else if (char === ',' && !inQuotes) {
          cols.push(current);
          current = '';
        } else {
          current += char;
        }
      }
      cols.push(current);

      const obj = {};
      headers.forEach((header, index) => {
        let val = cols[index] ? cols[index].trim() : '';
        if (val.startsWith('"') && val.endsWith('"')) {
          val = val.substring(1, val.length - 1);
        }
        obj[header] = val;
      });
      data.push(obj);
    }
    return data;
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setErrorStatus('');
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target.result;
        const parsed = parseCSV(text);
        
        // Map and validate
        const mapped = parsed.map((row, idx) => {
          if (!row.name || !row.price) return null; // Skip heavily malformed rows

          // Match category string natively, fallback to first category if missing
          const catNameTarget = (row.category || '').toLowerCase().trim();
          const matchedCat = categories.find(c => c.name.toLowerCase().trim() === catNameTarget);
          const fallbackCat = categories[0] || { id: uuidv4(), name: 'Default' };

          return {
            id: uuidv4(),
            name: row.name,
            categoryId: matchedCat ? matchedCat.id : fallbackCat.id,
            price: parseFloat(row.price) || 0,
            costPrice: parseFloat(row.costPrice) || 0,
            stock: parseInt(row.stock) || 0,
            unit: row.unit || 'pc',
            reorderPoint: parseInt(row.reorderpoint || row.reorder_point) || 0,
            emoji: row.emoji || '📦',
            _rawCategoryString: row.category || 'N/A' // For preview only
          };
        }).filter(Boolean);

        setFileData(mapped);
      } catch (err) {
        setErrorStatus(err.message);
      }
    };
    reader.readAsText(file);
  };

  const handleConfirm = async () => {
    if (fileData.length === 0) return;
    setLoading(true);
    try {
      await onUpload(fileData);
      setFileData([]);
      if (fileInputRef.current) fileInputRef.current.value = '';
      onClose();
    } finally {
      setLoading(false);
    }
  };

  const closeModal = () => {
    setFileData([]);
    setErrorStatus('');
    if (fileInputRef.current) fileInputRef.current.value = '';
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={closeModal} title="Batch Import Products (CSV)">
      <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        
        {fileData.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 20px', border: '2px dashed var(--border)', borderRadius: 'var(--radius-lg)' }}>
            <Upload size={32} style={{ margin: '0 auto 10px', color: 'var(--primary)' }} />
            <h3>Upload CSV File</h3>
            <p className="text-muted" style={{ marginBottom: 20 }}>
              File must contain header row. Required columns: <code>name</code>, <code>price</code>.<br/>
              Optional: <code>category</code>, <code>costPrice</code>, <code>stock</code>, <code>unit</code>, <code>emoji</code>.
            </p>
            <input 
              type="file" 
              accept=".csv" 
              onChange={handleFileUpload} 
              style={{ display: 'none' }} 
              ref={fileInputRef}
              id="csv-upload"
            />
            <label htmlFor="csv-upload" className="btn btn-primary" style={{ cursor: 'pointer' }}>
              Select File
            </label>
            {errorStatus && (
              <div style={{ marginTop: 16, color: 'var(--danger)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                <AlertCircle size={16} /> {errorStatus}
              </div>
            )}
          </div>
        ) : (
          <>
            <div style={{ padding: '12px 16px', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-md)', fontWeight: 500 }}>
              Ready to import {fileData.length} valid products
            </div>
            
            <div className="table-responsive" style={{ maxHeight: '400px', overflowY: 'auto' }}>
              <table className="table" style={{ fontSize: '0.9rem' }}>
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Category (Matched)</th>
                    <th>Price</th>
                    <th>Stock</th>
                  </tr>
                </thead>
                <tbody>
                  {fileData.map((row, i) => (
                    <tr key={i}>
                      <td>{row.emoji} {row.name}</td>
                      <td>
                        <span className="badge badge-amber">
                          {categories.find(c => c.id === row.categoryId)?.name || 'Default'}
                        </span>
                        {categories.find(c => c.id === row.categoryId)?.name.toLowerCase() !== row._rawCategoryString.toLowerCase() && (
                          <span className="text-xs text-muted" style={{ display: 'block', marginTop: 4 }}>
                            (was '{row._rawCategoryString}')
                          </span>
                        )}
                      </td>
                      <td>₱{row.price}</td>
                      <td>{row.stock} {row.unit}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', marginTop: 10 }}>
              <button className="btn btn-secondary" onClick={() => setFileData([])} disabled={loading}>
                Cancel & Re-upload
              </button>
              <button className="btn btn-primary" onClick={handleConfirm} disabled={loading}>
                {loading ? 'Injecting Data...' : `Confirm Import All (${fileData.length})`}
              </button>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}
