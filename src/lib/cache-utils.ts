/**
 * Utility for safe localStorage operations to prevent QuotaExceededError
 */

export const cacheUtils = {
  /**
   * Safe stringify to avoid circular structure errors
   */
  safeStringify: (obj: any) => {
    const cache = new Set();
    return JSON.stringify(obj, (key, value) => {
      if (typeof value === 'object' && value !== null) {
        if (cache.has(value)) return;
        cache.add(value);
      }
      return value;
    });
  },

  /**
   * Safely set an item in localStorage. 
   * If quota is exceeded, it tries to clear old cache items before retrying.
   */
  setItem: (key: string, value: any) => {
    try {
      const stringValue = typeof value === 'string' ? value : cacheUtils.safeStringify(value);
      localStorage.setItem(key, stringValue);
    } catch (e: any) {
      if (e.name === 'QuotaExceededError' || e.name === 'NS_ERROR_DOM_QUOTA_REACHED') {
        console.warn('LocalStorage quota exceeded. Attempting to clear old cache...');
        
        // Strategy: Clear all items that start with specific prefixes
        const prefixesToClear = [
          'product_detail_', 
          'product_reviews_', 
          'category_prods_', 
          'home_cache',
          'notifications_cache',
          'orders_cache_',
          'wishlist_cache_'
        ];

        try {
          const keys = Object.keys(localStorage);
          keys.forEach(k => {
            if (prefixesToClear.some(p => k.startsWith(p))) {
              localStorage.removeItem(k);
            }
          });

          // Try setting the item again after clearing
          const stringValue = typeof value === 'string' ? value : cacheUtils.safeStringify(value);
          localStorage.setItem(key, stringValue);
          console.log(`Successfully set ${key} after clearing cache.`);
        } catch (retryError) {
          console.error('Failed to set item even after clearing cache:', retryError);
        }
      } else {
        console.error('Error setting item in localStorage:', e);
      }
    }
  },

  getItem: (key: string) => {
    try {
      return localStorage.getItem(key);
    } catch (e) {
      console.error('Error getting item from localStorage:', e);
      return null;
    }
  },

  removeItem: (key: string) => {
    try {
      localStorage.removeItem(key);
    } catch (e) {
      console.error('Error removing item from localStorage:', e);
    }
  }
};
