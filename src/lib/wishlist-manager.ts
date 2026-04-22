import { collection, query, where, onSnapshot, limit } from 'firebase/firestore';
import { db } from '../firebase';
import { cacheUtils } from './cache-utils';
import { handleFirestoreError, OperationType } from './firestore-utils';

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
      const q = query(
        collection(db, 'wishlist'), 
        where('userId', '==', userId),
        limit(100)
      );
      unsubscribe = onSnapshot(q, (snapshot) => {
        wishlistIds = snapshot.docs.map(doc => doc.data().productId);
        cacheUtils.setItem(`wishlist_ids_cache_${userId}`, wishlistIds);
        listeners.forEach(l => l(wishlistIds));
      }, (error) => {
        handleFirestoreError(error, OperationType.LIST, 'wishlist');
      });
    }
    
    listeners.push(callback);
    callback(wishlistIds);
    
    return () => {
      listeners = listeners.filter(l => l !== callback);
      if (listeners.length === 0 && unsubscribe) {
        unsubscribe();
        unsubscribe = null;
        currentUserId = null;
      }
    };
  }
};
