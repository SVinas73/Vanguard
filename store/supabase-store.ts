import { create } from 'zustand';
import { supabase } from '@/lib/supabase';
import { Product, Movement, StockPrediction } from '@/types';
import { predictAllProducts } from '@/lib/ai';

interface InventoryState {
  // Data
  products: Product[];
  movements: Movement[];
  predictions: Record<string, StockPrediction>;
  
  // UI State
  currentUser: string;
  isLoading: boolean;
  error: string | null;
  
  // Actions - Products
  fetchProducts: () => Promise<void>;
  addProduct: (product: Omit<Product, 'stock'>) => Promise<void>;
  updateProduct: (codigo: string, updates: Partial<Product>) => Promise<void>;
  deleteProduct: (codigo: string) => Promise<void>;
  
  // Actions - Movements
  fetchMovements: () => Promise<void>;
  addMovement: (movement: Omit<Movement, 'id' | 'timestamp' | 'usuario'>, userEmail: string) => Promise<void>;
  
  // Actions - General
  refreshPredictions: () => void;
  setCurrentUser: (user: string) => void;
  clearError: () => void;
}

export const useInventoryStore = create<InventoryState>()((set, get) => ({
  // Initial state
  products: [],
  movements: [],
  predictions: {},
  currentUser: '',
  isLoading: false,
  error: null,

  // Fetch all products from Supabase
  fetchProducts: async () => {
    set({ isLoading: true, error: null });
    try {
      const { data, error } = await supabase
        .from('productos')
        .select('*')
        .order('codigo');

      if (error) throw error;

      const products: Product[] = (data || []).map((p) => ({
        codigo: p.codigo,
        descripcion: p.descripcion,
        precio: parseFloat(p.precio) || 0,
        categoria: p.categoria,
        stock: p.stock || 0,
        stockMinimo: p.stock_minimo || 5,
      }));

      set({ products, isLoading: false });
      get().refreshPredictions();
    } catch (error: any) {
      set({ error: error.message, isLoading: false });
    }
  },

  // Add product to Supabase
  addProduct: async (product) => {
    set({ isLoading: true, error: null });
    try {
      const { error } = await supabase.from('productos').insert({
        codigo: product.codigo,
        descripcion: product.descripcion,
        precio: product.precio,
        categoria: product.categoria,
        stock: 0,
        stock_minimo: product.stockMinimo,
      });

      if (error) throw error;

      // Refresh products list
      await get().fetchProducts();
    } catch (error: any) {
      set({ error: error.message, isLoading: false });
    }
  },

  // Update product in Supabase
  updateProduct: async (codigo, updates) => {
    set({ isLoading: true, error: null });
    try {
      const updateData: any = {};
      if (updates.descripcion !== undefined) updateData.descripcion = updates.descripcion;
      if (updates.precio !== undefined) updateData.precio = updates.precio;
      if (updates.categoria !== undefined) updateData.categoria = updates.categoria;
      if (updates.stock !== undefined) updateData.stock = updates.stock;
      if (updates.stockMinimo !== undefined) updateData.stock_minimo = updates.stockMinimo;

      const { error } = await supabase
        .from('productos')
        .update(updateData)
        .eq('codigo', codigo);

      if (error) throw error;

      // Refresh products list
      await get().fetchProducts();
    } catch (error: any) {
      set({ error: error.message, isLoading: false });
    }
  },

  // Delete product from Supabase
  deleteProduct: async (codigo) => {
    set({ isLoading: true, error: null });
    try {
      const { error } = await supabase
        .from('productos')
        .delete()
        .eq('codigo', codigo);

      if (error) throw error;

      // Refresh products list
      await get().fetchProducts();
    } catch (error: any) {
      set({ error: error.message, isLoading: false });
    }
  },

  // Fetch all movements from Supabase
  fetchMovements: async () => {
    set({ isLoading: true, error: null });
    try {
      const { data, error } = await supabase
        .from('movimientos')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      const movements: Movement[] = (data || []).map((m) => ({
        id: m.id,
        codigo: m.codigo,
        tipo: m.tipo as 'entrada' | 'salida',
        cantidad: m.cantidad,
        usuario: m.usuario_email || 'Sistema',
        timestamp: new Date(m.created_at),
        notas: m.notas,
        costoCompra: m.costo_compra ? parseFloat(m.costo_compra) : undefined,
      }));

      set({ movements, isLoading: false });
      get().refreshPredictions();
    } catch (error: any) {
      set({ error: error.message, isLoading: false });
    }
  },

  // Add movement to Supabase
  addMovement: async (movementData, userEmail) => {
    set({ isLoading: true, error: null });
    try {
      // First, get the product to get its ID and current stock
      const { data: productData, error: productError } = await supabase
        .from('productos')
        .select('id, stock')
        .eq('codigo', movementData.codigo)
        .single();

      if (productError) throw productError;

      // Calculate new stock
      const currentStock = productData.stock || 0;
      const newStock = movementData.tipo === 'entrada'
        ? currentStock + movementData.cantidad
        : Math.max(0, currentStock - movementData.cantidad);

      // Insert movement
      const { error: movementError } = await supabase.from('movimientos').insert({
        producto_id: productData.id,
        codigo: movementData.codigo,
        tipo: movementData.tipo,
        cantidad: movementData.cantidad,
        costo_compra: movementData.costoCompra || null,
        notas: movementData.notas || null,
        usuario_email: userEmail,
      });

      if (movementError) throw movementError;

      // Update product stock
      const { error: updateError } = await supabase
        .from('productos')
        .update({ stock: newStock })
        .eq('codigo', movementData.codigo);

      if (updateError) throw updateError;

      // Refresh data
      await get().fetchProducts();
      await get().fetchMovements();
    } catch (error: any) {
      set({ error: error.message, isLoading: false });
    }
  },

  // Refresh predictions (local calculation)
  refreshPredictions: () => {
    const { products, movements } = get();
    const predictions = predictAllProducts(products, movements);
    set({ predictions });
  },

  // Set current user
  setCurrentUser: (user) => set({ currentUser: user }),

  // Clear error
  clearError: () => set({ error: null }),
}));