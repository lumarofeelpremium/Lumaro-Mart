import React, { useState, useEffect, useRef, useMemo } from 'react';
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
import ScrollToTop from './components/ScrollToTop';
import { User, CartItem, Product, Category, Banner } from './types';
import { cacheUtils } from './lib/cache-utils';

import firebaseConfig from '../firebase-applet-config.json';

const updateLocalCache = (newData: any) => {
  setTimeout(() => {
    try {
      const currentCacheStr = cacheUtils.getItem('home_cache');
      const currentCache = currentCacheStr ? JSON.parse(currentCacheStr) : {};
      if (newData.allProducts) {
        newData.allProducts = newData.allProducts.slice(0, 60);
      }
      const combined = { ...currentCache, ...newData };
      cacheUtils.setItem('home_cache', combined);
    } catch (e) {
      console.warn('Silent cache update failure in App:', e);
    }
  }, 800);
};

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [cart, setCart] = useState<CartItem[]>([]);
  const isSyncingRef = useRef(false);

  // Centralized real-time store for lightning fast routing Transitions
  const [categories, setCategories] = useState<Category[]>([]);
  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [banners, setBanners] = useState<Banner[]>([]);
  const [initialDataLoading, setInitialDataLoading] = useState(true);
  const [productsLimit, setProductsLimit] = useState(100); // Start with batch to load instantly

  // Progressive background expansion of product limit after first paint
  useEffect(() => {
    const timer = setTimeout(() => {
      setProductsLimit(1000); // Fully load remaining products in the background
    }, 2200);
    return () => clearTimeout(timer);
  }, []);

  // Centralized real-time listener for products with progressive limit
  useEffect(() => {
    const unsubAllProds = onSnapshot(query(collection(db, 'products'), limit(productsLimit)), (snapshot) => {
      const prods = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product));
      setAllProducts(prods);
      setInitialDataLoading(false);
      updateLocalCache({ allProducts: prods });
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'products'));

    return () => {
      unsubAllProds();
    };
  }, [productsLimit]);

  // Centralized real-time listener for Categories and Banners
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

    return () => {
      unsubCats();
      unsubBanners();
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

  // Category visibility filtering for customer/user store views
  const visibleCategories = useMemo(() => {
    return categories.filter(c => c.isActive !== false);
  }, [categories]);

  const activeCategoryNameSet = useMemo(() => {
    if (categories.length === 0) return null;
    return new Set(categories.filter(c => c.isActive !== false).map(c => c.name.trim().toLowerCase()));
  }, [categories]);

  const visibleProducts = useMemo(() => {
    if (!activeCategoryNameSet) return allProducts;
    return allProducts.filter(p => {
      if (!p.category) return true;
      return activeCategoryNameSet.has(p.category.trim().toLowerCase());
    });
  }, [allProducts, activeCategoryNameSet]);

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
        <ScrollToTop />
        <div className="max-w-md mx-auto bg-white min-h-screen relative shadow-2xl shadow-black/10 overflow-x-hidden pb-24">
          <Routes>
            <Route path="/" element={<Home user={user} onAddToCart={handleAddToCart} categories={visibleCategories} allProducts={visibleProducts} banners={banners} initialDataLoading={initialDataLoading} />} />
            <Route path="/signup" element={<Signup setUser={setUser} />} />
            <Route path="/login" element={<Login setUser={setUser} />} />
            <Route path="/categories" element={<Categories user={user} onAddToCart={handleAddToCart} categories={visibleCategories} allProducts={visibleProducts} />} />
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
