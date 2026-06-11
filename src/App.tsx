import React, { useState, useEffect, useRef } from 'react';
import { HashRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp, onSnapshot, collection, query, limit, orderBy, where } from 'firebase/firestore';
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
import { User, CartItem, Product, Category, Banner } from './types';

import firebaseConfig from '../firebase-applet-config.json';

declare const __BUILD_TIME__: number;

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isUpdating, setIsUpdating] = useState(false);
  const isSyncingRef = useRef(false);

  // Centralized real-time store for lightning fast routing Transitions
  const [categories, setCategories] = useState<Category[]>([]);
  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [banners, setBanners] = useState<Banner[]>([]);
  const [initialDataLoading, setInitialDataLoading] = useState(true);

  // Centralized real-time listener for Categories, Products and Banners
  useEffect(() => {
    // 1. First feed from localCache immediately for a 0ms paint
    const cachedHome = localStorage.getItem('home_cache');
    if (cachedHome) {
      try {
        const { categories: cachedCats, allProducts: cachedProds, banners: cachedBanners } = JSON.parse(cachedHome);
        if (cachedCats && Array.isArray(cachedCats)) setCategories(cachedCats);
        if (cachedProds && Array.isArray(cachedProds)) setAllProducts(cachedProds);
        if (cachedBanners && Array.isArray(cachedBanners)) setBanners(cachedBanners);
        setInitialDataLoading(false);
      } catch (err) {
        console.error('Error loading initial cached data in App', err);
      }
    }

    // 2. Setup uninterrupted stream from Firestore
    const unsubCats = onSnapshot(collection(db, 'categories'), (snapshot) => {
      let cats = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Category));
      cats.sort((a, b) => {
        const orderA = a.order ?? 999;
        const orderB = b.order ?? 999;
        if (orderA !== orderB) return orderA - orderB;
        return a.name.localeCompare(b.name);
      });
      setCategories(cats);
      updateLocalCache({ categories: cats });
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'categories'));

    const unsubAllProds = onSnapshot(query(collection(db, 'products'), limit(1000)), (snapshot) => {
      const prods = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product));
      setAllProducts(prods);
      setInitialDataLoading(false);
      updateLocalCache({ allProducts: prods });
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'products'));

    const unsubBanners = onSnapshot(query(collection(db, 'banners'), where('active', '==', true)), (snapshot) => {
      const bannersData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Banner));
      const sortedBanners = bannersData.sort((a, b) => {
        const timeA = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
        const timeB = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
        return timeB - timeA;
      });
      setBanners(sortedBanners);
      updateLocalCache({ banners: sortedBanners });
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'banners'));

    const updateLocalCache = (newData: any) => {
      // Defer synchronous localStorage writes to avoid main-thread rendering bottlenecks
      setTimeout(() => {
        try {
          const currentCache = JSON.parse(localStorage.getItem('home_cache') || '{}');
          // Slice cached products slightly to respect localStorage limit and optimize parsing
          if (newData.allProducts) {
            newData.allProducts = newData.allProducts.slice(0, 60);
          }
          localStorage.setItem('home_cache', JSON.stringify({ ...currentCache, ...newData }));
        } catch (e) {
          console.warn('Silent cache update failure in App:', e);
        }
      }, 800);
    };

    return () => {
      unsubCats();
      unsubAllProds();
      unsubBanners();
    };
  }, []);

  // Auto-Update checker effect
  useEffect(() => {
    let active = true;
    let firstCheckTimeout: any;
    let interval: any;

    const checkUpdate = async () => {
      try {
        const res = await fetch(`/version.json?t=${Date.now()}`);
        if (!res.ok) return;
        const data = await res.json();
        if (!active) return;

        const serverVersion = Number(data.version);
        const localVersion = typeof __BUILD_TIME__ !== 'undefined' ? Number(__BUILD_TIME__) : 0;

        if (serverVersion && localVersion && serverVersion > localVersion) {
          // Check for reload protection loop
          const now = Date.now();
          const lastReload = sessionStorage.getItem('last_auto_update_reload');
          if (lastReload && now - Number(lastReload) < 30000) {
            console.warn('[AutoUpdate] Blocked potential infinite reload loop.');
            return;
          }

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

          // Mark reload timestamp to prevent infinite reload loop
          sessionStorage.setItem('last_auto_update_reload', String(now));

          // Wait a brief moment for the user to see the update message, then hard reload
          setTimeout(() => {
            window.location.reload();
          }, 1500);
        }
      } catch (err) {
        console.warn('[AutoUpdate] Check skipped or failed info:', err);
      }
    };

    // Delay the very first startup check by 5 seconds so it doesn't run during critical rendering path
    firstCheckTimeout = setTimeout(() => {
      checkUpdate();
    }, 5000);

    // Check when user resumes the app (brings tab to foreground)
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        checkUpdate();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Check periodically every 15 minutes (900,000 ms) instead of 2 minutes to conserve battery, data, and CPU on mobile
    interval = setInterval(checkUpdate, 900000);

    return () => {
      active = false;
      clearTimeout(firstCheckTimeout);
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
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
        <div className="max-w-md mx-auto bg-white min-h-screen relative shadow-2xl shadow-black/10 overflow-x-hidden pb-24">
          <Routes>
            <Route path="/" element={<Home user={user} onAddToCart={handleAddToCart} categories={categories} allProducts={allProducts} banners={banners} initialDataLoading={initialDataLoading} />} />
            <Route path="/signup" element={<Signup setUser={setUser} />} />
            <Route path="/login" element={<Login setUser={setUser} />} />
            <Route path="/categories" element={<Categories user={user} onAddToCart={handleAddToCart} categories={categories} allProducts={allProducts} />} />
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
