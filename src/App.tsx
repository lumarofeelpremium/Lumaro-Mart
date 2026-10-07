import React, { useState, useEffect, useRef, useMemo } from 'react';
import { HashRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp, onSnapshot, collection, query, limit, orderBy, where } from 'firebase/firestore';
import { auth, db } from './firebase';
import { handleFirestoreError, OperationType, onQuotaExhaustedChange } from './lib/firestore-utils';
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
import { MobileBackButtonSync } from './components/MobileBackButtonSync';
import { NotificationPermissionBanner } from './components/NotificationPermissionBanner';
import { setupForegroundPushListener } from './lib/fcm-utils';
import { User, CartItem, Product, Category, Banner, DeliveryLocation, ProductVariant } from './types';
import { getStoredDeliveryLocation, setStoredDeliveryLocation, getStateFromPincode } from './lib/location-utils';
import { cacheUtils } from './lib/cache-utils';
import { sortVariantsByWeight } from './lib/utils';

import firebaseConfig from '../firebase-applet-config.json';

const updateLocalCache = (newData: any) => {
  setTimeout(() => {
    try {
      const currentCacheStr = cacheUtils.getItem('home_cache');
      const currentCache = currentCacheStr ? JSON.parse(currentCacheStr) : {};
      const toCache = { ...newData };
      if (toCache.allProducts && Array.isArray(toCache.allProducts)) {
        // Strip heavy base64 strings so localStorage doesn't hit quota, but PRESERVE all products!
        toCache.allProducts = toCache.allProducts.map((p: any) => ({
          ...p,
          image: p.image && typeof p.image === 'string' && p.image.startsWith('data:') ? '' : p.image
        }));
      }
      const combined = { ...currentCache, ...toCache };
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
  const [isQuotaExhausted, setIsQuotaExhausted] = useState(false);
  const [deliveryLocation, setDeliveryLocation] = useState<DeliveryLocation | null>(() => getStoredDeliveryLocation());

  // Auto-sync delivery location if user has saved pincode in their profile
  useEffect(() => {
    if (user?.pincode && !deliveryLocation) {
      const inferred = getStateFromPincode(user.pincode) || undefined;
      const loc: DeliveryLocation = {
        pincode: user.pincode,
        state: inferred,
        label: inferred ? `${inferred} - ${user.pincode}` : `Pincode ${user.pincode}`
      };
      setDeliveryLocation(loc);
      setStoredDeliveryLocation(loc);
    }
  }, [user?.pincode]);

  useEffect(() => {
    const unsub = onQuotaExhaustedChange((exhausted) => {
      setIsQuotaExhausted(exhausted);
    });
    return () => unsub();
  }, []);

  // Listen for FCM Push messages received in foreground
  useEffect(() => {
    const unsubPush = setupForegroundPushListener((payload) => {
      console.log('[App] Foreground push message received:', payload);
    });
    return () => {
      if (unsubPush) unsubPush();
    };
  }, []);

  // Real-time listener for Customer's Orders to trigger Instant Browser & Phone Notifications
  const previousOrderStatuses = useRef<Record<string, string>>({});
  const isOrdersInitRef = useRef(true);

  useEffect(() => {
    if (!user?.uid) return;

    isOrdersInitRef.current = true;
    previousOrderStatuses.current = {};

    const q = query(collection(db, 'orders'), where('userId', '==', user.uid));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      if (isOrdersInitRef.current) {
        snapshot.docs.forEach(docSnap => {
          previousOrderStatuses.current[docSnap.id] = docSnap.data().status;
        });
        isOrdersInitRef.current = false;
        return;
      }

      snapshot.docChanges().forEach((change) => {
        const orderData = change.doc.data();
        const orderId = change.doc.id;
        const currentStatus = orderData.status;
        const oldStatus = previousOrderStatuses.current[orderId];

        if (change.type === 'modified' && oldStatus && oldStatus !== currentStatus) {
          previousOrderStatuses.current[orderId] = currentStatus;

          const statusTitles: Record<string, { title: string; message: string }> = {
            confirmed: {
              title: `Order Confirmed! (#${orderId.slice(-6).toUpperCase()})`,
              message: `Aapka order confirm ho gaya hai aur pack kiya ja raha hai.`
            },
            packed: {
              title: `Order Packed! (#${orderId.slice(-6).toUpperCase()})`,
              message: `Aapka order pack ho chuka hai aur delivery ke liye ready hai.`
            },
            out_for_delivery: {
              title: `Order Out for Delivery! 🚚 (#${orderId.slice(-6).toUpperCase()})`,
              message: `Aapka order delivery person ke sath nikal chuka hai. Jaldi hi pahuchega!`
            },
            delivered: {
              title: `Order Delivered! 🎉 (#${orderId.slice(-6).toUpperCase()})`,
              message: `Aapka order deliver ho gaya hai. Lumaro Mart se shopping ke liye dhanyawad!`
            },
            canceled: {
              title: `Order Canceled (#${orderId.slice(-6).toUpperCase()})`,
              message: `Aapka order cancel kar diya gaya hai.`
            }
          };

          const info = statusTitles[currentStatus];
          if (info) {
            try {
              const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3');
              audio.volume = 0.6;
              audio.play().catch(() => {});
            } catch (_) {}

            if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
              try {
                new Notification(info.title, {
                  body: info.message,
                  icon: '/favicon.ico',
                  tag: `order-${orderId}`
                });
              } catch (_) {}
            }
          }
        } else if (change.type === 'added') {
          previousOrderStatuses.current[orderId] = currentStatus;
        }
      });
    }, (err) => {
      console.warn('Customer order notification listener error:', err);
    });

    return () => unsubscribe();
  }, [user?.uid]);

  // Centralized real-time listener for ALL products without artificial limits
  useEffect(() => {
    const unsubAllProds = onSnapshot(collection(db, 'products'), (snapshot) => {
      const prods = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product));
      setAllProducts(prods);
      setInitialDataLoading(false);
      updateLocalCache({ allProducts: prods });
    }, (error) => {
      setInitialDataLoading(false);
      handleFirestoreError(error, OperationType.LIST, 'products');
    });

    return () => {
      unsubAllProds();
    };
  }, []);

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

    // 2. Setup stream from Firestore for all categories
    const unsubCats = onSnapshot(collection(db, 'categories'), (snapshot) => {
      let cats = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Category));
      cats.sort((a, b) => {
        const orderA = a.order ?? 999;
        const orderB = b.order ?? 999;
        if (orderA !== orderB) return orderA - orderB;
        return a.name.localeCompare(b.name);
      });
      setCategories(cats);
      setInitialDataLoading(false);
      updateLocalCache({ categories: cats });
    }, (error) => {
      setInitialDataLoading(false);
      handleFirestoreError(error, OperationType.LIST, 'categories');
    });

    const unsubBanners = onSnapshot(query(collection(db, 'banners'), where('active', '==', true), limit(20)), (snapshot) => {
      const bannersData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Banner));
      const sortedBanners = bannersData.sort((a, b) => {
        const timeA = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
        const timeB = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
        return timeB - timeA;
      });
      setBanners(sortedBanners);
      setInitialDataLoading(false);
      updateLocalCache({ banners: sortedBanners });
    }, (error) => {
      setInitialDataLoading(false);
      handleFirestoreError(error, OperationType.LIST, 'banners');
    });

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

  const handleAddToCart = (product: Product, quantityToAdd: number = 1, variant?: ProductVariant) => {
    const selectedVariant = variant || (product.hasVariants && product.variants && product.variants.length > 0 ? sortVariantsByWeight(product.variants)[0] : undefined);
    const effectiveStock = selectedVariant?.stock !== undefined ? selectedVariant.stock : product.stock;
    if (effectiveStock <= 0 || quantityToAdd <= 0) return;

    const cartItemId = selectedVariant ? `${product.id}_${selectedVariant.id || selectedVariant.weight}` : product.id;
    const effectivePrice = selectedVariant ? selectedVariant.price : product.price;
    const effectiveDiscountPrice = selectedVariant ? selectedVariant.discountPrice : product.discountPrice;
    
    let newCart: CartItem[] = [];
    setCart(prev => {
      const existing = prev.find(item => (item.cartItemId || item.id) === cartItemId);
      if (existing) {
        newCart = prev.map(item => 
          (item.cartItemId || item.id) === cartItemId ? { ...item, quantity: item.quantity + quantityToAdd } : item
        );
      } else {
        const newCartItem: CartItem = {
          ...product,
          id: cartItemId,
          cartItemId: cartItemId,
          productId: product.id,
          price: effectivePrice,
          discountPrice: effectiveDiscountPrice,
          stock: effectiveStock,
          selectedVariant: selectedVariant,
          quantity: quantityToAdd
        };
        newCart = [...prev, newCartItem];
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

  const hiddenCategoryNameSet = useMemo(() => {
    return new Set(
      categories
        .filter(c => c.isActive === false)
        .map(c => (c.name || '').trim().toLowerCase())
    );
  }, [categories]);

  const visibleProducts = useMemo(() => {
    if (hiddenCategoryNameSet.size === 0) return allProducts;
    return allProducts.filter(p => {
      if (!p.category) return true;
      return !hiddenCategoryNameSet.has(p.category.trim().toLowerCase());
    });
  }, [allProducts, hiddenCategoryNameSet]);

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
        <MobileBackButtonSync />
        <div className="max-w-md mx-auto bg-white min-h-screen relative shadow-2xl shadow-black/10 overflow-x-hidden pb-24">
          {isQuotaExhausted && (
            <div className="bg-amber-600/95 backdrop-blur-xs text-white text-[11px] font-semibold py-1.5 px-3 flex items-center justify-between sticky top-0 z-50 shadow-xs">
              <span className="truncate">Offline Mode: Serving local cache until daily quota resets.</span>
              <button 
                onClick={() => setIsQuotaExhausted(false)}
                className="text-white hover:text-amber-200 font-bold ml-2 text-xs"
                title="Dismiss"
              >
                ✕
              </button>
            </div>
          )}
          <Routes>
            <Route path="/" element={<Home 
              user={user} 
              onAddToCart={handleAddToCart} 
              categories={visibleCategories} 
              allProducts={visibleProducts} 
              banners={banners} 
              initialDataLoading={initialDataLoading}
              deliveryLocation={deliveryLocation}
              onSelectDeliveryLocation={setDeliveryLocation}
            />} />
            <Route path="/signup" element={<Signup setUser={setUser} />} />
            <Route path="/login" element={<Login setUser={setUser} />} />
            <Route path="/categories" element={<Categories 
              user={user} 
              onAddToCart={handleAddToCart} 
              categories={visibleCategories} 
              allProducts={visibleProducts}
              deliveryLocation={deliveryLocation}
              onSelectDeliveryLocation={setDeliveryLocation}
            />} />
            <Route path="/cart" element={<Cart 
              user={user}
              setUser={setUser}
              items={cart} 
              onUpdateQuantity={handleUpdateQuantity} 
              onRemove={handleRemoveFromCart}
              onClear={handleClearCart}
              deliveryLocation={deliveryLocation}
              onSelectDeliveryLocation={setDeliveryLocation}
            />} />
            <Route path="/product/:id" element={<ProductDetails 
              user={user} 
              onAddToCart={handleAddToCart}
              deliveryLocation={deliveryLocation}
              onSelectDeliveryLocation={setDeliveryLocation}
            />} />
            <Route path="/order-confirmation" element={<OrderConfirmation />} />
            <Route path="/notifications" element={<Notifications />} />
            <Route path="/my-orders" element={<MyOrders user={user} />} />
            <Route path="/wishlist" element={<Wishlist user={user} onAddToCart={handleAddToCart} />} />
            <Route path="/profile" element={<Profile user={user} setUser={setUser} onLogout={handleLogout} />} />
            <Route path="/admin" element={user?.role === 'admin' ? <AdminDashboard /> : <Navigate to="/profile" />} />
          </Routes>
          
          <NotificationPermissionBanner user={user} />
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
