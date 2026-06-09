import React, { useState, useEffect, useRef } from 'react';
import { HashRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp, onSnapshot } from 'firebase/firestore';
import { auth, db } from './firebase';
import { handleFirestoreError, OperationType } from './lib/firestore-utils';
import { Home } from './pages/Home';
import { Signup, Login } from './pages/Auth';
import { Categories } from './pages/Categories';
import { Cart } from './pages/Cart';
import { Notifications } from './pages/Notifications';
import { Profile } from './pages/Profile';
import { AdminDashboard } from './pages/AdminDashboard';
import { MyOrders } from './pages/MyOrders';
import { Wishlist } from './pages/Wishlist';
import { OrderConfirmation } from './pages/OrderConfirmation';
import { ProductDetails } from './pages/ProductDetails';
import { BottomNav } from './components/BottomNav';
import { ErrorBoundary } from './components/ErrorBoundary';
import { User, CartItem, Product } from './types';

import firebaseConfig from '../firebase-applet-config.json';

declare const __BUILD_TIME__: number;

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isUpdating, setIsUpdating] = useState(false);
  const isSyncingRef = useRef(false);

  // Auto-Update checker effect
  useEffect(() => {
    let active = true;
    const checkUpdate = async () => {
      try {
        const res = await fetch(`/version.json?t=${Date.now()}`);
        if (!res.ok) return;
        const data = await res.json();
        if (!active) return;

        const serverVersion = Number(data.version);
        const localVersion = typeof __BUILD_TIME__ !== 'undefined' ? Number(__BUILD_TIME__) : 0;

        if (serverVersion && localVersion && serverVersion > localVersion) {
          console.log(`[AutoUpdate] New version detected: ${serverVersion} (local: ${localVersion})`);
          setIsUpdating(true);

          // Clear local cache elements to ensure fresh content is fetched from Firestore
          const keys = Object.keys(localStorage);
          keys.forEach(k => {
            if (
              k.startsWith('product_detail_') ||
              k.startsWith('product_reviews_') ||
              k.startsWith('category_prods_') ||
              k.startsWith('home_cache') ||
              k.startsWith('notifications_cache') ||
              k.includes('cache')
            ) {
              localStorage.removeItem(k);
            }
          });

          // Wait a brief moment for the user to see the update message, then hard reload
          setTimeout(() => {
            window.location.reload();
          }, 1500);
        }
      } catch (err) {
        if (typeof navigator !== 'undefined' && !navigator.onLine) {
          console.warn('[AutoUpdate] Check skipped: Client is offline.');
        } else {
          console.error('[AutoUpdate] Check failed:', err);
        }
      }
    };

    // Run immediately on load
    checkUpdate();

    // Check when user resumes the app (brings tab to foreground)
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        checkUpdate();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Check periodically every 2 minutes
    const interval = setInterval(checkUpdate, 120000);

    return () => {
      active = false;
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      clearInterval(interval);
    };
  }, []);

  // Handle Cart Persistence
  useEffect(() => {
    if (loading) return;

    if (user) {
      const fetchCart = async () => {
        try {
          const cartDoc = await getDoc(doc(db, 'carts', user.uid));
          if (cartDoc.exists()) {
            setCart(cartDoc.data().items || []);
          } else {
            // If user has local cart items but no stored cart, initialize storage
            if (cart.length > 0) {
              await setDoc(doc(db, 'carts', user.uid), {
                items: cart,
                updatedAt: serverTimestamp()
              });
            }
          }
        } catch (error) {
          handleFirestoreError(error, OperationType.GET, `carts/${user.uid}`);
        }
      };
      fetchCart();
    } else {
      // Clear cart on logout to prevent data mixing
      setCart([]);
    }
  }, [user?.uid, loading]);

  // Sync Cart to Firestore
  const syncCartToFirestore = async (newCart: CartItem[]) => {
    if (!user || isSyncingRef.current) return;
    
    isSyncingRef.current = true;
    try {
      // Strip images and large descriptions from cart items to save bandwidth and stay under 1MB limit
      const minimizedCart = newCart.map(({ image, description, ...rest }) => ({
        ...rest,
        // We only need the essential data for cart persistence
      }));

      await setDoc(doc(db, 'carts', user.uid), {
        items: minimizedCart,
        updatedAt: serverTimestamp()
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `carts/${user.uid}`);
    } finally {
      isSyncingRef.current = false;
    }
  };

  useEffect(() => {
    let unsubscribeUser: (() => void) | null = null;

    const unsubscribeAuth = onAuthStateChanged(auth, async (firebaseUser) => {
      if (unsubscribeUser) {
        unsubscribeUser();
        unsubscribeUser = null;
      }

      if (firebaseUser) {
        // Set up real-time listener for user data
        const userRef = doc(db, 'users', firebaseUser.uid);
        unsubscribeUser = onSnapshot(userRef, (userDoc) => {
          if (userDoc.exists()) {
            const data = userDoc.data();
            let role = data.role;
            
            // Force admin role for the specific identities
            const isAdminIdentity = 
              data.phoneNumber === '7830948738' || 
              firebaseUser.email === '7830948738@lumaro.com' ||
              firebaseUser.email === 'shiva1520980@gmail.com';

            if (isAdminIdentity) {
              role = 'admin';
            }

            setUser({
              uid: firebaseUser.uid,
              email: firebaseUser.email || '',
              displayName: firebaseUser.displayName || 'User',
              ...data,
              role
            } as User);
          } else {
            // Document doesn't exist yet
            setUser({
              uid: firebaseUser.uid,
              email: firebaseUser.email || '',
              displayName: firebaseUser.displayName || 'User',
              role: 'user'
            } as User);
          }
          setLoading(false);
        }, (error) => {
          console.error("Error listening to user data:", error);
          setLoading(false);
        });
      } else {
        setUser(null);
        setCart([]);
        setLoading(false);
      }
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeUser) unsubscribeUser();
    };
  }, []);

  const handleAddToCart = (product: Product) => {
    if (product.stock <= 0) return;
    
    let newCart: CartItem[] = [];
    setCart(prev => {
      const existing = prev.find(item => item.id === product.id);
      if (existing) {
        newCart = prev.map(item => 
          item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item
        );
      } else {
        newCart = [...prev, { ...product, quantity: 1 }];
      }
      
      // Update Firestore if user is logged in
      if (user) syncCartToFirestore(newCart);
      return newCart;
    });
  };

  const handleUpdateQuantity = (id: string, quantity: number) => {
    if (quantity <= 0) {
      handleRemoveFromCart(id);
      return;
    }
    
    setCart(prev => {
      const newCart = prev.map(item => item.id === id ? { ...item, quantity } : item);
      if (user) syncCartToFirestore(newCart);
      return newCart;
    });
  };

  const handleRemoveFromCart = (id: string) => {
    setCart(prev => {
      const newCart = prev.filter(item => item.id !== id);
      if (user) syncCartToFirestore(newCart);
      return newCart;
    });
  };

  const handleClearCart = () => {
    setCart([]);
    if (user) syncCartToFirestore([]);
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      setUser(null);
      setCart([]);
    } catch (error) {
      console.error("Logout error:", error);
      // Fallback
      setUser(null);
      setCart([]);
    }
  };

  if (isUpdating) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#F8FBF9] p-6 text-center">
        <div className="relative mb-6">
          <div className="w-16 h-16 rounded-full border-4 border-[#66D2A4]/20 border-t-4 border-t-[#66D2A4] animate-spin"></div>
          <div className="absolute inset-0 flex items-center justify-center">
            <svg className="w-6 h-6 text-[#66D2A4]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 1121.21 7.89H18V4" />
            </svg>
          </div>
        </div>
        <h3 className="text-lg font-bold text-[#1A1A1A] mb-1">नया अपडेट उपलब्ध है!</h3>
        <p className="text-sm text-gray-500 mb-6 font-medium">नवीनतम बदलावों को लागू किया जा रहा है...</p>
        <span className="text-xs text-gray-400 font-mono tracking-wider">Loading latest version...</span>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F8FBF9]">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[#66D2A4]"></div>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <Router>
        <div className="max-w-md mx-auto bg-white min-h-screen relative shadow-2xl shadow-black/10 overflow-x-hidden overflow-y-auto pb-24 mb-safe">
          <Routes>
            <Route path="/" element={<Home user={user} onAddToCart={handleAddToCart} />} />
            <Route path="/signup" element={<Signup setUser={setUser} />} />
            <Route path="/login" element={<Login setUser={setUser} />} />
            <Route path="/categories" element={<Categories user={user} onAddToCart={handleAddToCart} />} />
            <Route path="/cart" element={<Cart 
              user={user}
              setUser={setUser}
              items={cart} 
              onUpdateQuantity={handleUpdateQuantity} 
              onRemove={handleRemoveFromCart}
              onClear={handleClearCart}
            />} />
            <Route path="/product/:id" element={<ProductDetails user={user} onAddToCart={handleAddToCart} />} />
            <Route path="/order-confirmation" element={<OrderConfirmation />} />
            <Route path="/notifications" element={<Notifications />} />
            <Route path="/my-orders" element={<MyOrders user={user} />} />
            <Route path="/wishlist" element={<Wishlist user={user} onAddToCart={handleAddToCart} />} />
            <Route path="/profile" element={<Profile user={user} setUser={setUser} onLogout={handleLogout} />} />
            <Route path="/admin" element={user?.role === 'admin' ? <AdminDashboard /> : <Navigate to="/profile" />} />
          </Routes>
          
          <ConditionalBottomNav cartCount={cart.reduce((acc, item) => acc + item.quantity, 0)} />
        </div>
      </Router>
    </ErrorBoundary>
  );
}

const ConditionalBottomNav = ({ cartCount }: { cartCount: number }) => {
  const { pathname } = useLocation();
  const hideOnPaths = ['/login', '/signup', '/admin'];
  
  if (hideOnPaths.includes(pathname)) return null;
  
  return <BottomNav cartCount={cartCount} />;
};
