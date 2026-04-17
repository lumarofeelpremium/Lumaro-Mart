import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { cacheUtils } from './cache-utils';

type WishlistListener = (ids: string[]) => void;
let wishlistIds: string[] = [];
let listeners: WishlistListener[] = [];
let unsubscribe: (() => void) | null = null;
let currentUserId: string | null = null;

export const wishlistManager = {
  getIds: () => wishlistIds,
  
  subscribe: (userId: string, callback: WishlistListener) => {
    if (currentUserId !== userId) {
      // Reset if user changed
      if (unsubscribe) unsubscribe();
      wishlistIds = [];
      const cached = cacheUtils.getItem(`wishlist_ids_cache_${userId}`);
      if (cached) {
        try {
          wishlistIds = JSON.parse(cached);
        } catch (e) {
          console.error('Error parsing wishlist cache', e);
        }
      }
      
      currentUserId = userId;
      const q = query(collection(db, 'wishlist'), where('userId', '==', userId));
      unsubscribe = onSnapshot(q, (snapshot) => {
        wishlistIds = snapshot.docs.map(doc => doc.data().productId);
        cacheUtils.setItem(`wishlist_ids_cache_${userId}`, wishlistIds);
        listeners.forEach(l => l(wishlistIds));
      });
    }
    
    listeners.push(callback);
    callback(wishlistIds);
    
    return () => {
      listeners = listeners.filter(l => l !== callback);
    };
  }
};
