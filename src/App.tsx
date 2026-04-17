import React, { useState, useEffect, useRef } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
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

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [cart, setCart] = useState<CartItem[]>([]);
  const isSyncingRef = useRef(false);

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
      await setDoc(doc(db, 'carts', user.uid), {
        items: newCart,
        updatedAt: serverTimestamp()
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `carts/${user.uid}`);
    } finally {
      isSyncingRef.current = false;
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        // Fetch user role and additional data from Firestore
        try {
          const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
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
            // If user exists in Auth but not in Firestore (shouldn't happen with proper signup)
            setUser({
              uid: firebaseUser.uid,
              email: firebaseUser.email || '',
              displayName: firebaseUser.displayName || 'User',
              role: 'user'
            } as User);
          }
        } catch (error) {
          console.error("Error fetching user data:", error);
          setUser({
            uid: firebaseUser.uid,
            email: firebaseUser.email || '',
            displayName: firebaseUser.displayName || 'User',
            role: 'user'
          } as User);
        }
      } else {
        setUser(null);
        setCart([]); // Critical: Clear cart state on logout
      }
      setLoading(false);
    });

    return () => unsubscribe();
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
        <div className="max-w-md mx-auto bg-white min-h-screen relative shadow-2xl shadow-black/10 overflow-hidden">
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
          
          <BottomNav cartCount={cart.reduce((acc, item) => acc + item.quantity, 0)} />
        </div>
      </Router>
    </ErrorBoundary>
  );
}
