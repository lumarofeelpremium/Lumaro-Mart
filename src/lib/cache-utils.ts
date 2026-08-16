/**
 * Utility for safe localStorage operations to prevent QuotaExceededError and circular structure crashes
 */

const isPlainObject = (obj: any): boolean => {
  if (typeof obj !== 'object' || obj === null) return false;
  
  // Guard against DOM elements, Windows, Events, and React Fibers
  if (typeof (obj as any).nodeType === 'number' || (obj as any).$$typeof) {
    return false;
  }

  const proto = Object.getPrototypeOf(obj);
  if (proto !== Object.prototype && proto !== null) return false;
  
  // Extra safety: Check if constructor is Object or undefined to filter out minified SDK classes
  if (obj.constructor !== undefined && obj.constructor !== Object) {
    return false;
  }
  
  return true;
};

const sanitizeForStringify = (val: any, seen = new WeakSet<any>()): any => {
  if (val === null || val === undefined) {
    return val;
  }

  const valType = typeof val;
  if (valType !== 'object') {
    if (valType === 'function' || valType === 'symbol') {
      return undefined;
    }
    return val;
  }

  if (seen.has(val)) {
    return undefined; // Break circular reference safely
  }
  seen.add(val);

  if (val instanceof Date) {
    return val.toISOString();
  }

  // Handle Firestore Timestamp
  if (typeof val.seconds === 'number' && typeof val.nanoseconds === 'number') {
    return { seconds: val.seconds, nanoseconds: val.nanoseconds };
  }

  // Handle Firestore DocumentReference (has a path string and firestore property)
  if (typeof val.path === 'string' && val.firestore) {
    return val.path;
  }

  if (Array.isArray(val)) {
    const arrCopy: any[] = [];
    for (const item of val) {
      const sanitizedItem = sanitizeForStringify(item, seen);
      if (sanitizedItem !== undefined) {
        arrCopy.push(sanitizedItem);
      }
    }
    return arrCopy;
  }

  // If it's a plain object, traverse its keys
  if (isPlainObject(val)) {
    const objCopy: any = {};
    for (const key of Object.keys(val)) {
      const propVal = val[key];
      if (typeof propVal === 'function' || typeof propVal === 'symbol') {
        continue;
      }
      const sanitizedProp = sanitizeForStringify(propVal, seen);
      if (sanitizedProp !== undefined) {
        objCopy[key] = sanitizedProp;
      }
    }
    return objCopy;
  }

  // For any other non-plain object (like Firestore internal class instances), do not traverse them!
  return undefined;
};

export const cacheUtils = {
  /**
   * Safely sanitize complex, circular, or non-plain structures into plain JSON objects
   */
  sanitize: (obj: any) => {
    return sanitizeForStringify(obj);
  },

  /**
   * Safe stringify with native replacer & WeakSet to prevent circular structure errors
   */
  safeStringify: (obj: any): string => {
    try {
      const seen = new WeakSet();
      return JSON.stringify(obj, (key, value) => {
        if (value instanceof Date) {
          return value.toISOString();
        }
        if (value && typeof value.seconds === 'number' && typeof value.nanoseconds === 'number') {
          return { seconds: value.seconds, nanoseconds: value.nanoseconds };
        }
        if (value && typeof value.path === 'string' && value.firestore) {
          return value.path;
        }
        if (typeof value === 'function' || typeof value === 'symbol') {
          return undefined;
        }
        if (typeof value === 'object' && value !== null) {
          // Guard against DOM nodes and React elements
          if (typeof (value as any).nodeType === 'number' || (value as any).$$typeof) {
            return undefined;
          }
          if (seen.has(value)) {
            return undefined; // Break circular reference cleanly
          }
          seen.add(value);
        }
        return value;
      });
    } catch (e) {
      console.warn('Safe native stringify failed, falling back to sanitize:', e);
      try {
        const sanitized = sanitizeForStringify(obj);
        return JSON.stringify(sanitized);
      } catch (err) {
        console.error('Final stringify fallback failed:', err);
        return '{}';
      }
    }
  },

  /**
   * Safely set an item in localStorage. 
   * If quota is exceeded, it tries to clear old cache items before retrying.
   */
  setItem: (key: string, value: any) => {
    try {
      const stringValue = typeof value === 'string' ? value : cacheUtils.safeStringify(value);
      
      // If a single item is excessively large (> 1.5MB), avoid filling up the limited 5MB localStorage
      if (stringValue.length > 1.5 * 1024 * 1024) {
        console.warn(`Item '${key}' is too large (${Math.round(stringValue.length / 1024)}KB) for localStorage, skipping cache.`);
        return;
      }

      localStorage.setItem(key, stringValue);
    } catch (e: any) {
      if (e.name === 'QuotaExceededError' || e.name === 'NS_ERROR_DOM_QUOTA_REACHED' || e.code === 22 || e.code === 1014) {
        console.warn('LocalStorage quota exceeded. Clearing non-essential cache...');
        
        // Strategy: Clear older product & home cache items
        const prefixesToClear = [
          'product_detail_', 
          'product_reviews_', 
          'category_prods_', 
          'home_cache',
          'notifications_cache',
          'orders_cache_',
          'wishlist_cache_',
          'admin_products_cache',
          'admin_orders_cache',
          'admin_categories_cache'
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
          if (stringValue.length <= 1.5 * 1024 * 1024) {
            localStorage.setItem(key, stringValue);
          }
        } catch (retryError) {
          // Gracefully suppress repeated quota errors instead of breaking the app
          console.warn('Skipping cache write due to persistent quota limit:', key);
        }
      } else {
        console.warn('Non-fatal error writing to localStorage:', e);
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

