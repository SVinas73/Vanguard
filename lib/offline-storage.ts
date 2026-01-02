import { Product, Movement } from '@/types';

const STORAGE_KEYS = {
  PRODUCTS: 'vanguard_products_cache',
  MOVEMENTS: 'vanguard_movements_cache',
  PENDING_ACTIONS: 'vanguard_pending_actions',
  LAST_SYNC: 'vanguard_last_sync',
};

export interface PendingAction {
  id: string;
  type: 'CREATE_PRODUCT' | 'UPDATE_PRODUCT' | 'DELETE_PRODUCT' | 'CREATE_MOVEMENT';
  data: any;
  timestamp: number;
  userEmail: string;
}

// ============================================
// CACHE DE PRODUCTOS
// ============================================

export function cacheProducts(products: Product[]): void {
  try {
    localStorage.setItem(STORAGE_KEYS.PRODUCTS, JSON.stringify(products));
    localStorage.setItem(STORAGE_KEYS.LAST_SYNC, new Date().toISOString());
  } catch (error) {
    console.error('Error caching products:', error);
  }
}

export function getCachedProducts(): Product[] {
  try {
    const cached = localStorage.getItem(STORAGE_KEYS.PRODUCTS);
    return cached ? JSON.parse(cached) : [];
  } catch (error) {
    console.error('Error getting cached products:', error);
    return [];
  }
}

// ============================================
// CACHE DE MOVIMIENTOS
// ============================================

export function cacheMovements(movements: Movement[]): void {
  try {
    // Solo guardar los últimos 100 movimientos
    const toCache = movements.slice(0, 100).map(m => ({
      ...m,
      timestamp: m.timestamp instanceof Date ? m.timestamp.toISOString() : m.timestamp,
    }));
    localStorage.setItem(STORAGE_KEYS.MOVEMENTS, JSON.stringify(toCache));
  } catch (error) {
    console.error('Error caching movements:', error);
  }
}

export function getCachedMovements(): Movement[] {
  try {
    const cached = localStorage.getItem(STORAGE_KEYS.MOVEMENTS);
    if (!cached) return [];
    
    const movements = JSON.parse(cached);
    return movements.map((m: any) => ({
      ...m,
      timestamp: new Date(m.timestamp),
    }));
  } catch (error) {
    console.error('Error getting cached movements:', error);
    return [];
  }
}

// ============================================
// ACCIONES PENDIENTES (para sincronizar)
// ============================================

export function addPendingAction(action: Omit<PendingAction, 'id' | 'timestamp'>): void {
  try {
    const pending = getPendingActions();
    const newAction: PendingAction = {
      ...action,
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
    };
    pending.push(newAction);
    localStorage.setItem(STORAGE_KEYS.PENDING_ACTIONS, JSON.stringify(pending));
  } catch (error) {
    console.error('Error adding pending action:', error);
  }
}

export function getPendingActions(): PendingAction[] {
  try {
    const pending = localStorage.getItem(STORAGE_KEYS.PENDING_ACTIONS);
    return pending ? JSON.parse(pending) : [];
  } catch (error) {
    console.error('Error getting pending actions:', error);
    return [];
  }
}

export function removePendingAction(actionId: string): void {
  try {
    const pending = getPendingActions().filter(a => a.id !== actionId);
    localStorage.setItem(STORAGE_KEYS.PENDING_ACTIONS, JSON.stringify(pending));
  } catch (error) {
    console.error('Error removing pending action:', error);
  }
}

export function clearPendingActions(): void {
  try {
    localStorage.removeItem(STORAGE_KEYS.PENDING_ACTIONS);
  } catch (error) {
    console.error('Error clearing pending actions:', error);
  }
}

// ============================================
// UTILIDADES
// ============================================

export function getLastSyncTime(): Date | null {
  try {
    const lastSync = localStorage.getItem(STORAGE_KEYS.LAST_SYNC);
    return lastSync ? new Date(lastSync) : null;
  } catch (error) {
    return null;
  }
}

export function clearAllCache(): void {
  try {
    Object.values(STORAGE_KEYS).forEach(key => {
      localStorage.removeItem(key);
    });
  } catch (error) {
    console.error('Error clearing cache:', error);
  }
}

export function getCacheSize(): string {
  try {
    let total = 0;
    Object.values(STORAGE_KEYS).forEach(key => {
      const item = localStorage.getItem(key);
      if (item) total += item.length;
    });
    return `${(total / 1024).toFixed(2)} KB`;
  } catch (error) {
    return '0 KB';
  }
}