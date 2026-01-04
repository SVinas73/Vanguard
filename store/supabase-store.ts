import { create } from 'zustand';
import { supabase } from '@/lib/supabase';
import { Product, Movement, StockPrediction } from '@/types';
import { predictAllProducts } from '@/lib/ai';
import { 
  cacheProducts, 
  getCachedProducts, 
  cacheMovements, 
  getCachedMovements,
  addPendingAction,
  getPendingActions,
  removePendingAction 
} from '@/lib/offline-storage';

interface InventoryState {
  // Data
  products: Product[];
  movements: Movement[];
  predictions: Record<string, StockPrediction>;
  
  // UI State
  currentUser: string;
  isLoading: boolean;
  error: string | null;
  isOffline: boolean;
  
  // Actions - Products
  fetchProducts: () => Promise<void>;
  addProduct: (product: Omit<Product, 'stock'>, userEmail: string) => Promise<void>;
  updateProduct: (codigo: string, updates: Partial<Product>, userEmail: string) => Promise<void>;
  deleteProduct: (codigo: string, userEmail: string) => Promise<void>;
  
  // Actions - Movements
  fetchMovements: () => Promise<void>;
  addMovement: (movement: Omit<Movement, 'id' | 'timestamp' | 'usuario'>, userEmail: string) => Promise<void>;
  
  // Actions - Lotes
  fetchLotes: (codigo: string) => Promise<any[]>;
  
  // Actions - Auditoria
  fetchAuditoria: (codigo?: string) => Promise<any[]>;
  
  // Actions - Offline
  syncPendingActions: () => Promise<void>;
  
  // Actions - General
  refreshPredictions: () => void;
  setCurrentUser: (user: string) => void;
  clearError: () => void;
}

// Función auxiliar para registrar en auditoría
async function registrarAuditoria(
  tabla: string,
  accion: string,
  codigo: string | null,
  datosAnteriores: any,
  datosNuevos: any,
  usuarioEmail: string
) {
  try {
    await supabase.from('auditoria').insert({
      tabla,
      accion,
      codigo,
      datos_anteriores: datosAnteriores,
      datos_nuevos: datosNuevos,
      usuario_email: usuarioEmail,
    });
  } catch (error) {
    console.error('Error registrando auditoría:', error);
  }
}

// Verificar si hay conexión
function isOnline(): boolean {
  return typeof navigator !== 'undefined' ? navigator.onLine : true;
}

export const useInventoryStore = create<InventoryState>()((set, get) => ({
  // Initial state
  products: [],
  movements: [],
  predictions: {},
  currentUser: '',
  isLoading: false,
  error: null,
  isOffline: false,

  // Fetch all products from Supabase
  fetchProducts: async () => {
    set({ isLoading: true, error: null });
    
    // Si no hay conexión, usar cache
    if (!isOnline()) {
      const cachedProducts = getCachedProducts();
      if (cachedProducts.length > 0) {
        set({ products: cachedProducts, isLoading: false, isOffline: true });
        get().refreshPredictions();
        return;
      }
    }
    
    try {
      const { data, error } = await supabase
        .from('productos')
        .select(`
          *,
          almacen:almacenes(id, codigo, nombre)
        `)
        .order('codigo');

      if (error) throw error;

      // Obtener imágenes
      const { data: imagenesData } = await supabase
        .from('imagenes_productos')
        .select('producto_codigo, url')
        .eq('es_principal', true);

      const imagenesMap = new Map(
        (imagenesData || []).map(img => [img.producto_codigo, img.url])
      );

      const products: Product[] = (data || []).map((p) => ({
        codigo: p.codigo,
        descripcion: p.descripcion,
        precio: parseFloat(p.precio) || 0,
        categoria: p.categoria,
        stock: p.stock || 0,
        stockMinimo: p.stock_minimo || 5,
        costoPromedio: p.costo_promedio ? parseFloat(p.costo_promedio) : 0,
        creadoPor: p.creado_por,
        creadoAt: p.creado_at,
        actualizadoPor: p.actualizado_por,
        actualizadoAt: p.actualizado_at,
        imagenUrl: imagenesMap.get(p.codigo) || null,
        almacenId: p.almacen_id,
        almacen: p.almacen,
      }));

      set({ products, isLoading: false, isOffline: false });
      cacheProducts(products); // Guardar en cache
      get().refreshPredictions();
    } catch (error: any) {
      // Si falla, intentar usar cache
      const cachedProducts = getCachedProducts();
      if (cachedProducts.length > 0) {
        set({ products: cachedProducts, isLoading: false, isOffline: true, error: null });
        get().refreshPredictions();
      } else {
        set({ error: error.message, isLoading: false });
      }
    }
  },

  // Add product to Supabase
  addProduct: async (product, userEmail) => {
    set({ isLoading: true, error: null });
    
    // Si no hay conexión, guardar acción pendiente
    if (!isOnline()) {
      addPendingAction({
        type: 'CREATE_PRODUCT',
        data: product,
        userEmail,
      });
      
      // Actualizar estado local
      const newProduct: Product = {
        ...product,
        stock: 0,
        costoPromedio: 0,
      };
      const currentProducts = get().products;
      set({ 
        products: [...currentProducts, newProduct], 
        isLoading: false,
        isOffline: true 
      });
      cacheProducts([...currentProducts, newProduct]);
      return;
    }
    
    try {
      const newProduct = {
        codigo: product.codigo,
        descripcion: product.descripcion,
        precio: product.precio,
        categoria: product.categoria,
        stock: 0,
        stock_minimo: product.stockMinimo,
        costo_promedio: 0,
        creado_por: userEmail,
        creado_at: new Date().toISOString(),
        actualizado_por: userEmail,
        actualizado_at: new Date().toISOString(),
      };

      const { error } = await supabase.from('productos').insert(newProduct);

      if (error) throw error;

      // Registrar en auditoría
      await registrarAuditoria(
        'productos',
        'CREAR',
        product.codigo,
        null,
        newProduct,
        userEmail
      );

      await get().fetchProducts();
    } catch (error: any) {
      set({ error: error.message, isLoading: false });
    }
  },

  // Update product in Supabase
  updateProduct: async (codigo, updates, userEmail) => {
    set({ isLoading: true, error: null });
    
    // Si no hay conexión, guardar acción pendiente
    if (!isOnline()) {
      addPendingAction({
        type: 'UPDATE_PRODUCT',
        data: { codigo, updates },
        userEmail,
      });
      
      // Actualizar estado local
      const currentProducts = get().products.map(p => 
        p.codigo === codigo ? { ...p, ...updates } : p
      );
      set({ products: currentProducts, isLoading: false, isOffline: true });
      cacheProducts(currentProducts);
      return;
    }
    
    try {
      // Obtener datos actuales para auditoría
      const { data: currentProduct } = await supabase
        .from('productos')
        .select('*')
        .eq('codigo', codigo)
        .single();

      // Si se está cambiando el precio, guardar en historial
      if (updates.precio !== undefined && currentProduct && currentProduct.precio !== updates.precio) {
        await supabase.from('historial_precios').insert({
          codigo: codigo,
          precio_anterior: currentProduct.precio,
          precio_nuevo: updates.precio,
          usuario: userEmail,
          motivo: 'Actualización manual',
        });
      }

      const updateData: any = {
        actualizado_por: userEmail,
        actualizado_at: new Date().toISOString(),
      };
      
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

      // Registrar en auditoría
      await registrarAuditoria(
        'productos',
        'ACTUALIZAR',
        codigo,
        currentProduct,
        updateData,
        userEmail
      );

      await get().fetchProducts();
    } catch (error: any) {
      set({ error: error.message, isLoading: false });
    }
  },

  // Delete product from Supabase
  deleteProduct: async (codigo, userEmail) => {
    set({ isLoading: true, error: null });
    
    // Si no hay conexión, guardar acción pendiente
    if (!isOnline()) {
      addPendingAction({
        type: 'DELETE_PRODUCT',
        data: { codigo },
        userEmail,
      });
      
      // Actualizar estado local
      const currentProducts = get().products.filter(p => p.codigo !== codigo);
      set({ products: currentProducts, isLoading: false, isOffline: true });
      cacheProducts(currentProducts);
      return;
    }
    
    try {
      // Obtener datos actuales para auditoría
      const { data: currentProduct } = await supabase
        .from('productos')
        .select('*')
        .eq('codigo', codigo)
        .single();

      const { error } = await supabase
        .from('productos')
        .delete()
        .eq('codigo', codigo);

      if (error) throw error;

      // Registrar en auditoría
      await registrarAuditoria(
        'productos',
        'ELIMINAR',
        codigo,
        currentProduct,
        null,
        userEmail
      );

      await get().fetchProducts();
    } catch (error: any) {
      set({ error: error.message, isLoading: false });
    }
  },

  // Fetch all movements from Supabase
  fetchMovements: async () => {
    set({ isLoading: true, error: null });
    
    // Si no hay conexión, usar cache
    if (!isOnline()) {
      const cachedMovements = getCachedMovements();
      if (cachedMovements.length > 0) {
        set({ movements: cachedMovements, isLoading: false, isOffline: true });
        get().refreshPredictions();
        return;
      }
    }
    
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

      set({ movements, isLoading: false, isOffline: false });
      cacheMovements(movements); // Guardar en cache
      get().refreshPredictions();
    } catch (error: any) {
      // Si falla, intentar usar cache
      const cachedMovements = getCachedMovements();
      if (cachedMovements.length > 0) {
        set({ movements: cachedMovements, isLoading: false, isOffline: true, error: null });
        get().refreshPredictions();
      } else {
        set({ error: error.message, isLoading: false });
      }
    }
  },

  // Add movement to Supabase (con lotes FIFO)
  addMovement: async (movementData, userEmail) => {
    set({ isLoading: true, error: null });
    
    // Si no hay conexión, guardar acción pendiente
    if (!isOnline()) {
      addPendingAction({
        type: 'CREATE_MOVEMENT',
        data: movementData,
        userEmail,
      });
      
      // Actualizar estado local
      const newMovement: Movement = {
        id: Date.now(),
        codigo: movementData.codigo,
        tipo: movementData.tipo,
        cantidad: movementData.cantidad,
        usuario: userEmail,
        timestamp: new Date(),
        notas: movementData.notas,
        costoCompra: movementData.costoCompra,
      };
      
      const currentMovements = get().movements;
      const currentProducts = get().products.map(p => {
        if (p.codigo === movementData.codigo) {
          const newStock = movementData.tipo === 'entrada' 
            ? p.stock + movementData.cantidad 
            : Math.max(0, p.stock - movementData.cantidad);
          return { ...p, stock: newStock };
        }
        return p;
      });
      
      set({ 
        movements: [newMovement, ...currentMovements],
        products: currentProducts,
        isLoading: false,
        isOffline: true 
      });
      cacheMovements([newMovement, ...currentMovements]);
      cacheProducts(currentProducts);
      get().refreshPredictions();
      return;
    }
    
    try {
      // Get the product
      const { data: productData, error: productError } = await supabase
        .from('productos')
        .select('id, stock, costo_promedio')
        .eq('codigo', movementData.codigo)
        .single();

      if (productError) throw productError;

      const currentStock = productData.stock || 0;
      const currentCostoPromedio = productData.costo_promedio || 0;
      let newStock = currentStock;
      let newCostoPromedio = currentCostoPromedio;

      if (movementData.tipo === 'entrada') {
        // ===== ENTRADA: Crear lote y recalcular costo promedio =====
        const costoCompra = movementData.costoCompra || 0;
        
        // Crear lote
        const { error: loteError } = await supabase.from('lotes').insert({
          codigo: movementData.codigo,
          cantidad_inicial: movementData.cantidad,
          cantidad_disponible: movementData.cantidad,
          costo_unitario: costoCompra,
          usuario: userEmail,
          notas: movementData.notas || null,
        });

        if (loteError) throw loteError;

        // Calcular nuevo costo promedio ponderado
        const valorActual = currentStock * currentCostoPromedio;
        const valorNuevo = movementData.cantidad * costoCompra;
        newStock = currentStock + movementData.cantidad;
        newCostoPromedio = newStock > 0 ? (valorActual + valorNuevo) / newStock : 0;

      } else {
        // ===== SALIDA: Descontar de lotes FIFO =====
        let cantidadRestante = movementData.cantidad;
        
        // Obtener lotes disponibles ordenados por fecha (más viejo primero)
        const { data: lotes, error: lotesError } = await supabase
          .from('lotes')
          .select('*')
          .eq('codigo', movementData.codigo)
          .gt('cantidad_disponible', 0)
          .order('fecha_compra', { ascending: true });

        if (lotesError) throw lotesError;

        // Descontar de cada lote
        for (const lote of (lotes || [])) {
          if (cantidadRestante <= 0) break;

          const descontar = Math.min(cantidadRestante, lote.cantidad_disponible);
          
          const { error: updateLoteError } = await supabase
            .from('lotes')
            .update({ cantidad_disponible: lote.cantidad_disponible - descontar })
            .eq('id', lote.id);

          if (updateLoteError) throw updateLoteError;

          cantidadRestante -= descontar;
        }

        newStock = Math.max(0, currentStock - movementData.cantidad);
        // El costo promedio se mantiene igual en salidas
      }

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

      // Update product stock and costo promedio
      const { error: updateError } = await supabase
        .from('productos')
        .update({ 
          stock: newStock,
          costo_promedio: newCostoPromedio,
          actualizado_por: userEmail,
          actualizado_at: new Date().toISOString(),
        })
        .eq('codigo', movementData.codigo);

      if (updateError) throw updateError;

      // Registrar en auditoría
      await registrarAuditoria(
        'movimientos',
        movementData.tipo.toUpperCase(),
        movementData.codigo,
        { stock_anterior: currentStock },
        { 
          stock_nuevo: newStock, 
          cantidad: movementData.cantidad,
          costo_compra: movementData.costoCompra 
        },
        userEmail
      );

      // Refresh data
      await get().fetchProducts();
      await get().fetchMovements();
    } catch (error: any) {
      set({ error: error.message, isLoading: false });
    }
  },

  // Fetch lotes for a product
  fetchLotes: async (codigo: string) => {
    if (!isOnline()) return [];
    
    try {
      const { data, error } = await supabase
        .from('lotes')
        .select('*')
        .eq('codigo', codigo)
        .order('fecha_compra', { ascending: true });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching lotes:', error);
      return [];
    }
  },

  // Fetch auditoría
  fetchAuditoria: async (codigo?: string) => {
    if (!isOnline()) return [];
    
    try {
      let query = supabase
        .from('auditoria')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);

      if (codigo) {
        query = query.eq('codigo', codigo);
      }

      const { data, error } = await query;

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching auditoria:', error);
      return [];
    }
  },

  // Sincronizar acciones pendientes
  syncPendingActions: async () => {
    if (!isOnline()) return;
    
    const pendingActions = getPendingActions();
    if (pendingActions.length === 0) return;
    
    for (const action of pendingActions) {
      try {
        switch (action.type) {
          case 'CREATE_PRODUCT':
            await get().addProduct(action.data, action.userEmail);
            break;
          case 'UPDATE_PRODUCT':
            await get().updateProduct(action.data.codigo, action.data.updates, action.userEmail);
            break;
          case 'DELETE_PRODUCT':
            await get().deleteProduct(action.data.codigo, action.userEmail);
            break;
          case 'CREATE_MOVEMENT':
            await get().addMovement(action.data, action.userEmail);
            break;
        }
        removePendingAction(action.id);
      } catch (error) {
        console.error('Error syncing action:', action, error);
      }
    }
    
    // Refrescar datos después de sincronizar
    await get().fetchProducts();
    await get().fetchMovements();
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