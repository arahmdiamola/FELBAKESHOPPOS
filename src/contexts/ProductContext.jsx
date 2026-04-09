import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { api } from '../utils/api';

const ProductContext = createContext();

export function ProductProvider({ children }) {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);

  const fetchData = useCallback(async () => {
    try {
      const [p, c] = await Promise.all([api.get('/products'), api.get('/categories')]);
      setProducts(p || []);
      setCategories(c || []);
    } catch (e) {
      console.error(e);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const addProduct = useCallback(async (product) => {
    await api.post('/products', product);
    await fetchData();
  }, [fetchData]);

  const addProductsBatch = useCallback(async (productsBatch) => {
    await api.post('/products/batch', { products: productsBatch });
    await fetchData();
  }, [fetchData]);

  const updateProduct = useCallback(async (id, updates) => {
    await api.put(`/products/${id}`, updates);
    await fetchData();
  }, [fetchData]);

  const deleteProduct = useCallback(async (id) => {
    await api.del(`/products/${id}`);
    await fetchData();
  }, [fetchData]);

  const adjustStock = useCallback(async (id, quantity) => {
    await api.put(`/products/${id}/adjust`, { quantity });
    await fetchData();
  }, [fetchData]);

  const deductStock = useCallback(async (items) => {
    await api.post('/products/inventory', { items, direction: 'deduct' });
    await fetchData();
  }, [fetchData]);

  const restoreStock = useCallback(async (items) => {
    await api.post('/products/inventory', { items, direction: 'restore' });
    await fetchData();
  }, [fetchData]);

  const addCategory = useCallback(async (category) => {
    await api.post('/categories', category);
    await fetchData();
  }, [fetchData]);

  const deleteCategory = useCallback(async (id) => {
    // Unimplemented on backend for MVP, leave as placeholder
  }, []);

  const getLowStockProducts = useCallback(() => {
    return products.filter(p => p.reorderPoint > 0 && p.stock <= p.reorderPoint);
  }, [products]);

  return (
    <ProductContext.Provider value={{
      products, categories,
      addProduct, addProductsBatch, updateProduct, deleteProduct,
      adjustStock, deductStock, restoreStock,
      addCategory, deleteCategory, getLowStockProducts,
    }}>
      {children}
    </ProductContext.Provider>
  );
}

export const useProducts = () => useContext(ProductContext);
