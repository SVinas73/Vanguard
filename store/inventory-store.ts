import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { Product, Movement, StockPrediction } from '@/types';
import { SAMPLE_PRODUCTS, SAMPLE_MOVEMENTS } from '@/lib/constants';
import { predictAllProducts } from '@/lib/ai';

interface InventoryState {
  // Data
  products: Product[];
  movements: Movement[];
  predictions: Record<string, StockPrediction>;
  
  // UI State
  currentUser: string;
  isLoading: boolean;
  
  // Actions - Products
  addProduct: (product: Product) => void;
  updateProduct: (codigo: string, updates: Partial<Product>) => void;
  deleteProduct: (codigo: string) => void;
  
  // Actions - Movements
  addMovement: (movement: Omit<Movement, 'id' | 'timestamp' | 'usuario'>) => void;
  
  // Actions - General
  refreshPredictions: () => void;
  setCurrentUser: (user: string) => void;
  resetToSample: () => void;
}

export const useInventoryStore = create<InventoryState>()(
  persist(
    (set, get) => ({
      // Initial state
      products: SAMPLE_PRODUCTS,
      movements: SAMPLE_MOVEMENTS,
      predictions: {},
      currentUser: 'Santiago',
      isLoading: false,

      // Product actions
      addProduct: (product) => {
        set((state) => ({
          products: [...state.products, { ...product, stock: 0 }],
        }));
        get().refreshPredictions();
      },

      updateProduct: (codigo, updates) => {
        set((state) => ({
          products: state.products.map((p) =>
            p.codigo === codigo ? { ...p, ...updates } : p
          ),
        }));
        get().refreshPredictions();
      },

      deleteProduct: (codigo) => {
        set((state) => ({
          products: state.products.filter((p) => p.codigo !== codigo),
          movements: state.movements.filter((m) => m.codigo !== codigo),
        }));
        get().refreshPredictions();
      },

      // Movement actions
      addMovement: (movementData) => {
        const state = get();
        const newMovement: Movement = {
          ...movementData,
          id: state.movements.length + 1,
          timestamp: new Date(),
          usuario: state.currentUser,
        };

        // Update stock
        const updatedProducts = state.products.map((p) => {
          if (p.codigo === movementData.codigo) {
            const newStock =
              movementData.tipo === 'entrada'
                ? p.stock + movementData.cantidad
                : Math.max(0, p.stock - movementData.cantidad);
            return { ...p, stock: newStock };
          }
          return p;
        });

        set({
          movements: [...state.movements, newMovement],
          products: updatedProducts,
        });
        
        get().refreshPredictions();
      },

      // Refresh predictions
      refreshPredictions: () => {
        const { products, movements } = get();
        const predictions = predictAllProducts(products, movements);
        set({ predictions });
      },

      // Set user
      setCurrentUser: (user) => set({ currentUser: user }),

      // Reset to sample data
      resetToSample: () => {
        set({
          products: SAMPLE_PRODUCTS,
          movements: SAMPLE_MOVEMENTS,
        });
        get().refreshPredictions();
      },
    }),
    {
      name: 'inventory-storage',
      partialize: (state) => ({
        products: state.products,
        movements: state.movements,
        currentUser: state.currentUser,
      }),
    }
  )
);

// Initialize predictions on load
if (typeof window !== 'undefined') {
  const state = useInventoryStore.getState();
  state.refreshPredictions();
}
