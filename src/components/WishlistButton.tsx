import React, { useState, useEffect } from 'react';
import { Heart } from 'lucide-react';
import { db } from '../firebase';
import { collection, addDoc, deleteDoc, doc, getDocs, serverTimestamp, query, where } from 'firebase/firestore';
import { User } from '../types';
import { cn } from '../lib/utils';
import { wishlistManager } from '../lib/wishlist-manager';
import { handleFirestoreError, OperationType } from '../lib/firestore-utils';

interface WishlistButtonProps {
  user: User | null;
  productId: string;
  className?: string;
}

export const WishlistButton = ({ user, productId, className }: WishlistButtonProps) => {
  const [isInWishlist, setIsInWishlist] = useState(() => {
    if (!user) return false;
    return wishlistManager.getIds().includes(productId);
  });

  useEffect(() => {
    if (!user) {
      setIsInWishlist(false);
      return;
    }

    // Subscribe to global wishlist updates
    const unsub = wishlistManager.subscribe(user.uid, (ids) => {
      setIsInWishlist(ids.includes(productId));
    });

    return () => unsub();
  }, [user, productId]);

  const toggleWishlist = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!user) {
      alert("Please login to add items to wishlist");
      return;
    }

    try {
      if (isInWishlist) {
        // Find the doc ID to delete
        const q = query(
          collection(db, 'wishlist'),
          where('userId', '==', user.uid),
          where('productId', '==', productId)
        );
        const snap = await getDocs(q);
        if (!snap.empty) {
          await deleteDoc(doc(db, 'wishlist', snap.docs[0].id));
        }
      } else {
        await addDoc(collection(db, 'wishlist'), {
          userId: user.uid,
          productId: productId,
          createdAt: serverTimestamp()
        });
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'wishlist');
    }
  };

  return (
    <button
      onClick={toggleWishlist}
      className={cn(
        "w-10 h-10 rounded-2xl flex items-center justify-center transition-all duration-300 shadow-sm",
        isInWishlist 
          ? "bg-red-500 text-white scale-110" 
          : "bg-white/90 text-gray-400 hover:text-red-500 hover:bg-white",
        className
      )}
    >
      <Heart size={20} fill={isInWishlist ? "currentColor" : "none"} />
    </button>
  );
};
