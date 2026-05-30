/**
 * Utility for safe localStorage operations to prevent QuotaExceededError
 */

export const cacheUtils = {
  /**
   * Safe stringify to avoid circular structure errors
   */
  safeStringify: (obj: any) => {
    try {
      const seen = new WeakSet();
      
      const sanitize = (val: any): any => {
        if (val === null || val === undefined) return val;
        const t = typeof val;
        if (t === 'string' || t === 'number' || t === 'boolean') return val;
        if (t === 'function' || t === 'symbol') return undefined;

        if (seen.has(val)) return '[Circular]';
        
        // Handle common object types
        if (val instanceof Date) {
          return val.toISOString();
        }

        // Handle firestore Timestamp
        if (typeof val.toMillis === 'function') {
          return { seconds: val.seconds, nanoseconds: val.nanoseconds, _type: 'Timestamp' };
        }

        // Handle generic browser native objects or Web API entities
        if (
          typeof window !== 'undefined' && 
          (val === window || val === document || val instanceof Node || val instanceof Event)
        ) {
          return '[Browser Object]';
        }

        // Check constructor names for minified or native objects
        if (val.constructor && typeof val.constructor.name === 'string') {
          const name = val.constructor.name;
          if (name === 'HTMLImageElement' || name === 'Image' || name === 'Y' || name === 'Ka') {
            return `[Class: ${name}]`;
          }
        }

        seen.add(val);

        if (Array.isArray(val)) {
          return val.map(item => sanitize(item));
        }

        // Check if plain object or similar dictionary
        try {
          const res: Record<string, any> = {};
          const keys = Object.keys(val);
          for (const key of keys) {
            res[key] = sanitize(val[key]);
          }
          return res;
        } catch (e) {
          return '[Unserializable Object]';
        }
      };

      const sanitizedResult = sanitize(obj);
      return JSON.stringify(sanitizedResult);
    } catch (e) {
      console.warn('Safe stringify failed, falling back to String():', e);
      return String(obj);
    }
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
