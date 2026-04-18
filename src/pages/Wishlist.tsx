import React, { useState, useEffect } from 'react';
import { ChevronLeft, Heart, ShoppingCart, Trash2, Loader2, Plus } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { db } from '../firebase';
import { collection, query, where, onSnapshot, doc, getDoc, deleteDoc, addDoc, getDocs, writeBatch } from 'firebase/firestore';
import { motion, AnimatePresence } from 'motion/react';
import { User, Product } from '../types';
import { handleFirestoreError, OperationType } from '../lib/firestore-utils';
import { Button } from '../components/ui/Base';
import { cn } from '../lib/utils';
import { cacheUtils } from '../lib/cache-utils';

import { WishlistButton } from '../components/WishlistButton';

import { wishlistManager } from '../lib/wishlist-manager';

export const Wishlist = ({ user, onAddToCart }: { user: User | null, onAddToCart: (p: Product) => void }) => {
  const navigate = useNavigate();
  const [wishlistItems, setWishlistItems] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [isClearing, setIsClearing] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  // Load cached wishlist on mount
  useEffect(() => {
    if (!user) return;
    const cachedWishlist = cacheUtils.getItem(`wishlist_cache_${user.uid}`);
    if (cachedWishlist) {
      try {
        setWishlistItems(JSON.parse(cachedWishlist));
        setLoading(false);
      } catch (e) {
        console.error('Error parsing wishlist cache', e);
      }
    }
  }, [user]);

  useEffect(() => {
    if (!user) {
      navigate('/login');
      return;
    }

    // Use global wishlist manager to listen for IDs
    const unsubscribe = wishlistManager.subscribe(user.uid, async (productIds) => {
      if (productIds.length === 0) {
        setWishlistItems([]);
        setLoading(false);
        return;
      }

      // Fetch product details for each ID
      try {
        const productPromises = productIds.map(id => getDoc(doc(db, 'products', id)));
        const productSnapshots = await Promise.all(productPromises);
        const products = productSnapshots
          .filter(snap => snap.exists())
          .map(snap => ({ id: snap.id, ...snap.data() } as Product));
        
        setWishlistItems(products);
        if (user) {
          cacheUtils.setItem(`wishlist_cache_${user.uid}`, products);
        }
      } catch (error) {
        console.error("Error fetching wishlist products:", error);
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, [user, navigate]);

  const removeFromWishlist = async (productId: string) => {
    if (!user) return;
    try {
      const q = query(
        collection(db, 'wishlist'),
        where('userId', '==', user.uid),
        where('productId', '==', productId)
      );
      const querySnapshot = await getDocs(q);
      querySnapshot.forEach(async (document) => {
        await deleteDoc(doc(db, 'wishlist', document.id));
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'wishlist');
    }
  };

  const clearWishlist = async () => {
    if (!user || wishlistItems.length === 0 || isClearing) return;
    
    setIsClearing(true);
    setShowClearConfirm(false);
    try {
      const q = query(
        collection(db, 'wishlist'),
        where('userId', '==', user.uid)
      );
      const querySnapshot = await getDocs(q);
      
      if (querySnapshot.empty) {
        setIsClearing(false);
        return;
      }

      // Use a batch for efficiency
      const batch = writeBatch(db);
      querySnapshot.docs.forEach((doc) => {
        batch.delete(doc.ref);
      });
      
      await batch.commit();
      
      // Explicitly clear local state and cache
      setWishlistItems([]);
      cacheUtils.removeItem(`wishlist_cache_${user.uid}`);
      cacheUtils.removeItem(`wishlist_ids_cache_${user.uid}`);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'wishlist');
    } finally {
      setIsClearing(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F8FBF9] flex items-center justify-center">
        <Loader2 className="animate-spin text-[#66D2A4]" size={40} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8FBF9] pb-32">
      <div className="bg-white px-6 py-6 flex items-center justify-between border-b border-gray-100 sticky top-0 z-50">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => navigate(-1)}
            className="w-10 h-10 bg-[#F0F7F4] rounded-xl flex items-center justify-center text-gray-600"
          >
            <ChevronLeft size={20} />
          </button>
          <h1 className="text-lg font-bold text-[#1A1A1A]">My Wishlist</h1>
        </div>
        
        {wishlistItems.length > 0 && (
          <div className="flex gap-2">
            <AnimatePresence>
              {showClearConfirm ? (
                <motion.div 
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  className="flex gap-2"
                >
                  <button 
                    onClick={() => setShowClearConfirm(false)}
                    className="text-[10px] font-bold text-gray-400 bg-gray-100 px-3 py-2 rounded-xl"
                  >
                    Cancel
                  </button>
                  <button 
                    onClick={clearWishlist}
                    disabled={isClearing}
                    className="text-[10px] font-bold text-white bg-red-500 px-3 py-2 rounded-xl"
                  >
                    Confirm Clear
                  </button>
                </motion.div>
              ) : (
                <button 
                  onClick={() => setShowClearConfirm(true)}
                  disabled={isClearing}
                  className={cn(
                    "text-xs font-bold px-4 py-2 rounded-xl transition-colors flex items-center gap-2",
                    isClearing 
                      ? "bg-gray-100 text-gray-400 cursor-not-allowed" 
                      : "bg-red-50 text-red-500 hover:bg-red-100"
                  )}
                >
                  Clear All
                </button>
              )}
            </AnimatePresence>
          </div>
        )}
      </div>

      <div className="px-6 pt-6">
        {wishlistItems.length === 0 ? (
          <div className="text-center py-20">
            <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center mx-auto mb-4 shadow-sm">
              <Heart size={32} className="text-gray-200" />
            </div>
            <h2 className="text-xl font-bold text-gray-400">Your wishlist is empty</h2>
            <p className="text-sm text-gray-400 mt-2">Save items you like for later!</p>
            <Button 
              variant="ghost" 
              className="mt-6 text-[#66D2A4]"
              onClick={() => navigate('/')}
            >
              Explore Products
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4">
            {wishlistItems.map((product) => (
              <motion.div
                key={product.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white rounded-[32px] p-4 shadow-sm border border-gray-50 flex flex-col h-full relative group"
              >
                <button 
                  onClick={() => removeFromWishlist(product.id)}
                  className="absolute top-2 right-2 z-10 w-8 h-8 bg-white/90 text-red-500 rounded-xl flex items-center justify-center shadow-sm hover:bg-red-500 hover:text-white transition-all"
                >
                  <Trash2 size={16} />
                </button>

                <div 
                  className="relative aspect-square mb-3 rounded-2xl overflow-hidden bg-gray-100 flex items-center justify-center cursor-pointer"
                  onClick={() => navigate(`/product/${product.id}`)}
                >
                  {product.image ? (
                    <img 
                      src={product.image} 
                      alt={product.name} 
                      className="w-full h-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <Plus size={24} className="text-gray-300" />
                  )}
                </div>
                
                <h4 className="font-bold text-sm text-[#1A1A1A] mb-1 line-clamp-1">{product.name}</h4>
                <p className={cn(
                  "text-[10px] mb-2 font-bold",
                  product.stock > 0 ? "text-gray-400" : "text-red-500"
                )}>
                  {product.stock > 0 ? `${product.stock} in stock` : "Out of Stock"}
                </p>
                
                <div className="flex justify-between items-center mt-auto">
                  <span className="font-bold text-[#66D2A4]">₹{product.price}</span>
                  <button 
                    disabled={product.stock <= 0}
                    onClick={() => {
                      if (product.stock > 0) onAddToCart(product);
                    }}
                    className={cn(
                      "text-white p-2 rounded-xl transition-colors",
                      product.stock > 0 ? "bg-[#66D2A4] hover:bg-[#55b88e]" : "bg-gray-300 cursor-not-allowed"
                    )}
                  >
                    <Plus size={16} />
                  </button>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
