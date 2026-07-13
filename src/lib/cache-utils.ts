/**
 * Utility for safe localStorage operations to prevent QuotaExceededError
 */

const isPlainObject = (obj: any): boolean => {
  if (typeof obj !== 'object' || obj === null) return false;
  const proto = Object.getPrototypeOf(obj);
  if (proto !== Object.prototype && proto !== null) return false;
  
  // Extra safety: Check if constructor is Object or undefined to filter out minified SDK classes
  if (obj.constructor !== undefined && obj.constructor !== Object) {
    return false;
  }
  
  return true;
};

const sanitizeForStringify = (val: any, seen = new Set<any>()): any => {
  if (val === null || val === undefined) {
    return val;
  }

  const valType = typeof val;
  if (valType !== 'object') {
    return val;
  }

  if (seen.has(val)) {
    return '[Circular]';
  }

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
    seen.add(val);
    const arrCopy = [];
    for (const item of val) {
      arrCopy.push(sanitizeForStringify(item, seen));
    }
    seen.delete(val);
    return arrCopy;
  }

  // If it's a plain object, traverse its keys
  if (isPlainObject(val)) {
    seen.add(val);
    const objCopy: any = {};
    for (const key of Object.keys(val)) {
      const propVal = val[key];
      if (typeof propVal === 'function' || typeof propVal === 'symbol') {
        continue;
      }
      objCopy[key] = sanitizeForStringify(propVal, seen);
    }
    seen.delete(val);
    return objCopy;
  }

  // If it's some other non-plain object (like Firestore internal class instances), do not traverse them!
  const constructorName = val.constructor?.name || 'Object';
  if (constructorName === 'HTMLImageElement' || constructorName === 'Image') {
    return `[Image: ${val.src || ''}]`;
  }
  
  if (typeof val.toString === 'function') {
    try {
      const str = val.toString();
      if (str !== '[object Object]') {
        return str;
      }
    } catch (e) {
      // Ignore toString errors and fallback to [Class: Name]
    }
  }

  return `[Class: ${constructorName}]`;
};

export const cacheUtils = {
  /**
   * Safely sanitize complex, circular, or non-plain structures into plain JSON objects
   */
  sanitize: (obj: any) => {
    return sanitizeForStringify(obj);
  },

  /**
   * Safe stringify to avoid circular structure errors
   */
  safeStringify: (obj: any) => {
    try {
      const sanitized = sanitizeForStringify(obj);
      return JSON.stringify(sanitized);
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
