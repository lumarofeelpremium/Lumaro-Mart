import React, { useState, useEffect, useRef } from 'react';
import { ChevronLeft, ChevronUp, ChevronDown, Users, Package, TrendingUp, ShieldCheck, Edit2, Trash2, Plus, X, Layers, AlertTriangle, Search, Settings, CheckCircle, ShoppingBag, XCircle, Clock, Send, Bell, FileText, Printer, Download, Filter, Phone } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button, Input } from '../components/ui/Base';
import { User, Product, Category, Order, AppSettings, Banner } from '../types';
import { auth, db } from '../firebase';
import { collection, onSnapshot, doc, addDoc, updateDoc, deleteDoc, query, orderBy, serverTimestamp, setDoc, where, getDoc, increment, writeBatch } from 'firebase/firestore';
import { motion, AnimatePresence } from 'motion/react';
import { Image, Loader2, Star, Layout } from 'lucide-react';
import { handleFirestoreError, OperationType } from '../lib/firestore-utils';
import { compressImage } from '../lib/utils';
import * as XLSX from 'xlsx';
import { useReactToPrint } from 'react-to-print';

export const AdminDashboard = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'users' | 'products' | 'orders' | 'categories' | 'settings' | 'banners' | 'reports'>('orders');
  const [users, setUsers] = useState<User[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [banners, setBanners] = useState<Banner[]>([]);
  const [appSettings, setAppSettings] = useState<AppSettings>({ whatsappNumber: '', whatsappEnabled: true });
  const [orderSearchQuery, setOrderSearchQuery] = useState('');
  const [productSearchQuery, setProductSearchQuery] = useState('');
  const [stockThreshold, setStockThreshold] = useState(5);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [isAddingProduct, setIsAddingProduct] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [isAddingCategory, setIsAddingCategory] = useState(false);
  const [editingBanner, setEditingBanner] = useState<Banner | null>(null);
  const [isAddingBanner, setIsAddingBanner] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [selectedUserStats, setSelectedUserStats] = useState<User | null>(null);
  const [deleteConfirmation, setDeleteConfirmation] = useState<{ id: string, type: 'product' | 'category' | 'banner' | 'user', name: string } | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const isInitialLoad = React.useRef(true);
  const notificationAudio = React.useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    // Preload notification sound
    notificationAudio.current = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3');
  }, []);

  useEffect(() => {
    if (successMessage) {
      const timer = setTimeout(() => setSuccessMessage(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [successMessage]);

  useEffect(() => {
    if (!auth.currentUser) return;

    const unsubUsers = onSnapshot(query(collection(db, 'users'), orderBy('displayName')), (snapshot) => {
      setUsers(snapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() } as User)));
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'users'));

    const unsubProducts = onSnapshot(query(collection(db, 'products'), orderBy('name')), (snapshot) => {
      setProducts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product)));
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'products'));

    const unsubCategories = onSnapshot(collection(db, 'categories'), (snapshot) => {
      let cats = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Category));
      
      // Sort by order field, then by name
      cats.sort((a, b) => {
        const orderA = a.order ?? 999;
        const orderB = b.order ?? 999;
        if (orderA !== orderB) return orderA - orderB;
        return a.name.localeCompare(b.name);
      });
      
      setCategories(cats);
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'categories'));

    const unsubOrders = onSnapshot(query(collection(db, 'orders'), orderBy('createdAt', 'desc')), (snapshot) => {
      const newOrders = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Order));
      
      // Play sound for NEW orders arriving while dashboard is open
      if (!isInitialLoad.current) {
        snapshot.docChanges().forEach((change) => {
          if (change.type === 'added') {
            const orderData = change.doc.data();
            // Verify it's actually a new order (timestamp check)
            const orderTime = orderData.createdAt?.toMillis() || Date.now();
            if (Date.now() - orderTime < 10000) { // dentro de los últimos 10 segundos
              notificationAudio.current?.play().catch(e => console.log('Audio playback failed:', e));
              
              // Browser Notification
              if ("Notification" in window && Notification.permission === "granted") {
                new Notification("New Order Received!", {
                  body: `Order from ${orderData.userName || 'Customer'} - ₹${orderData.total}`,
                  icon: '/favicon.ico'
                });
              }
            }
          }
        });
      }
      
      setOrders(newOrders);
      isInitialLoad.current = false;
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'orders'));

    const unsubSettings = onSnapshot(doc(db, 'settings', 'global'), (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data() as AppSettings;
        setAppSettings(data);
        if (data.stockThreshold !== undefined) {
          setStockThreshold(data.stockThreshold);
        }
      }
    }, (error) => handleFirestoreError(error, OperationType.GET, 'settings/global'));

    const unsubBanners = onSnapshot(query(collection(db, 'banners')), (snapshot) => {
      const bannersData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Banner));
      // Sort in-memory to avoid index requirements
      const sortedBanners = bannersData.sort((a, b) => {
        const timeA = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
        const timeB = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
        return timeB - timeA;
      });
      setBanners(sortedBanners);
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'banners'));

    return () => {
      unsubUsers();
      unsubProducts();
      unsubCategories();
      unsubOrders();
      unsubSettings();
      unsubBanners();
    };
  }, [auth.currentUser]);

  const handleSaveProduct = async (productData: any) => {
    try {
      if (editingProduct) {
        await updateDoc(doc(db, 'products', editingProduct.id), productData);
        setSuccessMessage('Product updated successfully!');
      } else {
        const productRef = await addDoc(collection(db, 'products'), {
          ...productData,
          salesCount: 0,
          createdAt: serverTimestamp()
        });
        setSuccessMessage('Product added successfully!');
        
        // Add notification for users
        await addDoc(collection(db, 'notifications'), {
          title: 'New Product Added!',
          message: `${productData.name} is now available in ${productData.category}. Check it out!`,
          type: 'new_product',
          createdAt: serverTimestamp(),
          productId: productRef.id
        });
      }
      setEditingProduct(null);
      setIsAddingProduct(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'products');
    }
  };

  const handleDeleteProduct = (product: Product) => {
    setDeleteConfirmation({ id: product.id, type: 'product', name: product.name });
  };

  const handleSaveCategory = async (categoryData: any) => {
    try {
      if (editingCategory) {
        await updateDoc(doc(db, 'categories', editingCategory.id), categoryData);
        setSuccessMessage('Category updated successfully!');
      } else {
        await addDoc(collection(db, 'categories'), {
          ...categoryData,
          order: categories.length, // Set order to current length to put it at the end
          createdAt: serverTimestamp()
        });
        setSuccessMessage('Category added successfully!');
      }
      setEditingCategory(null);
      setIsAddingCategory(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'categories');
    }
  };

  const handleDeleteCategory = (category: Category) => {
    setDeleteConfirmation({ id: category.id, type: 'category', name: category.name });
  };

  const handleReorderCategory = async (categoryId: string, direction: 'up' | 'down') => {
    const index = categories.findIndex(c => c.id === categoryId);
    if (index === -1) return;

    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= categories.length) return;

    try {
      const batch = writeBatch(db);
      
      // To ensure a perfect sort, we update the order of ALL items base on their new positions
      // This also fixes categories that have no 'order' field yet
      categories.forEach((cat, i) => {
        let targetOrder = i;
        if (i === index) targetOrder = newIndex;
        else if (i === newIndex) targetOrder = index;
        
        // Only update if necessary to save operations
        if (cat.order !== targetOrder) {
          batch.update(doc(db, 'categories', cat.id), { order: targetOrder });
        }
      });

      await batch.commit();
      setSuccessMessage('Category sequence updated!');
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `categories/${categoryId}`);
    }
  };

  const handleNormalizeCategoryOrders = async () => {
    try {
      const batch = writeBatch(db);
      categories.forEach((cat, index) => {
        batch.update(doc(db, 'categories', cat.id), { order: index });
      });
      await batch.commit();
      setSuccessMessage('All category orders synchronized!');
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'categories/all');
    }
  };

  const handleSaveBanner = async (bannerData: any) => {
    try {
      if (editingBanner) {
        await updateDoc(doc(db, 'banners', editingBanner.id), bannerData);
        setSuccessMessage('Banner updated successfully!');
      } else {
        await addDoc(collection(db, 'banners'), {
          ...bannerData,
          createdAt: serverTimestamp()
        });
        setSuccessMessage('Banner added successfully!');
      }
      setEditingBanner(null);
      setIsAddingBanner(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'banners');
    }
  };

  const handleDeleteBanner = (banner: Banner) => {
    setDeleteConfirmation({ id: banner.id, type: 'banner', name: banner.title });
  };

  const confirmDelete = async () => {
    if (!deleteConfirmation) return;
    const { id, type } = deleteConfirmation;
    try {
      let collectionName = '';
      switch (type) {
        case 'product': collectionName = 'products'; break;
        case 'category': collectionName = 'categories'; break;
        case 'banner': collectionName = 'banners'; break;
        case 'user': collectionName = 'users'; break;
      }
      await deleteDoc(doc(db, collectionName, id));
      setSuccessMessage(`${type.charAt(0).toUpperCase() + type.slice(1)} deleted successfully!`);
      setDeleteConfirmation(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `${type}s/${id}`);
    }
  };

  const handleUpdateOrderStatus = async (orderId: string, newStatus: Order['status']) => {
    try {
      const orderRef = doc(db, 'orders', orderId);
      const orderSnap = await getDoc(orderRef);
      
      if (!orderSnap.exists()) return;
      
      const orderData = orderSnap.data() as Order;
      const oldStatus = orderData.status;
      
      // If status hasn't changed, do nothing
      if (oldStatus === newStatus) return;
      
      const batch = writeBatch(db);
      
      // Handle Stock Restoration/Reduction based on status change
      // Case 1: Order is being canceled (Restore Stock)
      if (newStatus === 'canceled' && oldStatus !== 'canceled') {
        orderData.items.forEach(item => {
          const productRef = doc(db, 'products', item.id);
          batch.update(productRef, {
            stock: increment(item.quantity)
          });
        });
      }
      // Case 2: Order was canceled but is now being re-activated (Reduce Stock again)
      else if (oldStatus === 'canceled' && newStatus !== 'canceled') {
        orderData.items.forEach(item => {
          const productRef = doc(db, 'products', item.id);
          batch.update(productRef, {
            stock: increment(-item.quantity)
          });
        });
      }
      
      // Update the order status
      batch.update(orderRef, { status: newStatus });
      
      // Award Loyalty Points on Delivery
      if (newStatus === 'delivered' && oldStatus !== 'delivered' && orderData.pointsEarned && orderData.pointsEarned > 0) {
        const userRef = doc(db, 'users', orderData.userId);
        batch.update(userRef, {
          loyaltyPoints: increment(orderData.pointsEarned)
        });
      }

      // Case 3: Reverting from delivered (Revoke points)
      if (oldStatus === 'delivered' && newStatus !== 'delivered' && orderData.pointsEarned && orderData.pointsEarned > 0) {
        const userRef = doc(db, 'users', orderData.userId);
        batch.update(userRef, {
          loyaltyPoints: increment(-orderData.pointsEarned)
        });
      }
      
      await batch.commit();
      setSuccessMessage(`Order status updated to ${newStatus}`);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `orders/${orderId}`);
    }
  };

  const handleUpdateSettings = async (newSettings: AppSettings) => {
    try {
      await setDoc(doc(db, 'settings', 'global'), newSettings);
      return true;
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'settings/global');
      return false;
    }
  };

  const handleUpdateStockThreshold = async (newThreshold: number) => {
    setStockThreshold(newThreshold);
    try {
      await updateDoc(doc(db, 'settings', 'global'), {
        stockThreshold: newThreshold
      });
    } catch (error) {
      console.error("Error updating stock threshold:", error);
    }
  };

  return (
    <div className="min-h-screen bg-[#F8FBF9] pb-32">
      <div className="bg-white px-6 pt-12 pb-6 rounded-b-[40px] shadow-sm mb-6">
        <div className="flex items-center gap-4 mb-6">
          <button 
            onClick={() => navigate(-1)}
            className="w-10 h-10 bg-[#F0F7F4] rounded-xl flex items-center justify-center text-gray-600"
          >
            <ChevronLeft size={20} />
          </button>
          <h1 className="text-xl font-bold text-[#1A1A1A]">Admin Backend</h1>
        </div>

        <div className="grid grid-cols-4 gap-2">
          <StatCard icon={Users} label="Users" value={users.length.toString()} color="bg-blue-50 text-blue-600" />
          <StatCard icon={Package} label="Products" value={products.length.toString()} color="bg-green-50 text-green-600" />
          <StatCard icon={Layers} label="Cats" value={categories.length.toString()} color="bg-orange-50 text-orange-600" />
          <StatCard icon={Layout} label="Banners" value={banners.length.toString()} color="bg-pink-50 text-pink-600" />
        </div>
      </div>

      <div className="px-6">
        <div className="flex gap-2 mb-6 overflow-x-auto no-scrollbar pb-2">
          <TabButton active={activeTab === 'orders'} onClick={() => setActiveTab('orders')} label="Orders" />
          <TabButton active={activeTab === 'reports'} onClick={() => setActiveTab('reports')} label="Sales Report" />
          <TabButton active={activeTab === 'products'} onClick={() => setActiveTab('products')} label="Products" />
          <TabButton active={activeTab === 'categories'} onClick={() => setActiveTab('categories')} label="Categories" />
          <TabButton active={activeTab === 'banners'} onClick={() => setActiveTab('banners')} label="Banners" />
          <TabButton active={activeTab === 'users'} onClick={() => setActiveTab('users')} label="Users" />
          <TabButton active={activeTab === 'settings'} onClick={() => setActiveTab('settings')} label="Settings" />
        </div>

        <div className="bg-white rounded-3xl p-4 shadow-sm border border-gray-50">
          {activeTab === 'users' && (
            <UserList 
              users={users} 
              onDelete={(u) => setDeleteConfirmation({ id: u.uid, type: 'user', name: u.displayName })} 
              onViewOrders={(user) => setSelectedUserStats(user)}
            />
          )}
          {activeTab === 'products' && (
            <ProductList 
              products={products} 
              onEdit={setEditingProduct} 
              onDelete={handleDeleteProduct}
              onAdd={() => setIsAddingProduct(true)}
              stockThreshold={stockThreshold}
              onThresholdChange={handleUpdateStockThreshold}
              searchQuery={productSearchQuery}
              onSearchChange={setProductSearchQuery}
            />
          )}
          {activeTab === 'categories' && (
            <CategoryList 
              categories={categories} 
              onEdit={setEditingCategory} 
              onDelete={handleDeleteCategory}
              onAdd={() => setIsAddingCategory(true)}
              onReorder={handleReorderCategory}
              onNormalize={handleNormalizeCategoryOrders}
            />
          )}
          {activeTab === 'orders' && (
            <OrderList 
              orders={orders} 
              onUpdateStatus={handleUpdateOrderStatus}
              searchQuery={orderSearchQuery}
              onSearchChange={setOrderSearchQuery}
              onViewDetails={setSelectedOrder}
            />
          )}
          {activeTab === 'reports' && (
            <SalesReport orders={orders} />
          )}
          {activeTab === 'banners' && (
            <BannerList 
              banners={banners} 
              onEdit={setEditingBanner} 
              onDelete={handleDeleteBanner}
              onAdd={() => setIsAddingBanner(true)}
            />
          )}
          {activeTab === 'settings' && (
            <SettingsTab 
              settings={appSettings} 
              onSave={handleUpdateSettings} 
              onTestNotification={() => {
                // To unlock audio on some browsers, we need user interaction
                if (notificationAudio.current) {
                  notificationAudio.current.play()
                    .then(() => {
                      if ("Notification" in window && Notification.permission === "granted") {
                        new Notification("Lumaro Mart Admin", {
                          body: "Testing notifications! They are working correctly.",
                          icon: '/favicon.ico'
                        });
                      }
                    })
                    .catch(e => console.error("Audio test failed:", e));
                }
              }}
            />
          )}
        </div>
      </div>

      <AnimatePresence>
        {successMessage && (
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-6 left-1/2 -translate-x-1/2 z-[200] bg-[#1A1A1A] text-white px-6 py-3 rounded-2xl shadow-xl flex items-center gap-3 border border-white/10"
          >
            <div className="w-6 h-6 bg-[#66D2A4] rounded-full flex items-center justify-center">
              <CheckCircle size={14} className="text-white" />
            </div>
            <span className="text-sm font-bold">{successMessage}</span>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {(editingProduct || isAddingProduct) && (
          <ProductFormModal 
            mode={editingProduct ? 'edit' : 'add'}
            product={editingProduct || undefined} 
            categories={categories}
            onClose={() => { setEditingProduct(null); setIsAddingProduct(false); }} 
            onSave={handleSaveProduct}
          />
        )}
        {(editingCategory || isAddingCategory) && (
          <CategoryFormModal 
            mode={editingCategory ? 'edit' : 'add'}
            category={editingCategory || undefined} 
            onClose={() => { setEditingCategory(null); setIsAddingCategory(false); }} 
            onSave={handleSaveCategory}
          />
        )}
        {editingBanner || isAddingBanner ? (
          <BannerFormModal 
            mode={editingBanner ? 'edit' : 'add'}
            banner={editingBanner || undefined} 
            onClose={() => { setEditingBanner(null); setIsAddingBanner(false); }} 
            onSave={handleSaveBanner}
          />
        ) : null}
        {selectedOrder && (
          <OrderDetailsModal 
            order={selectedOrder} 
            onClose={() => setSelectedOrder(null)} 
            onUpdateStatus={handleUpdateOrderStatus}
          />
        )}
        {selectedUserStats && (
          <UserStatsModal 
            user={selectedUserStats} 
            orders={orders.filter(o => o.userId === selectedUserStats.uid)}
            onClose={() => setSelectedUserStats(null)}
            onViewAllOrders={() => {
              setOrderSearchQuery(selectedUserStats.uid);
              setActiveTab('orders');
              setSelectedUserStats(null);
            }}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {deleteConfirmation && (
          <DeleteConfirmationModal 
            title={`Delete ${deleteConfirmation.type.charAt(0).toUpperCase() + deleteConfirmation.type.slice(1)}`}
            message={`Are you sure you want to delete "${deleteConfirmation.name}"? This action cannot be undone.`}
            onConfirm={confirmDelete}
            onCancel={() => setDeleteConfirmation(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

const StatCard = ({ icon: Icon, label, value, color }: any) => (
  <div className="bg-white p-3 rounded-2xl border border-gray-50 shadow-sm flex flex-col items-center text-center">
    <div className={cn("p-2 rounded-xl mb-1", color)}>
      <Icon size={16} />
    </div>
    <span className="text-[8px] text-gray-400 font-bold uppercase tracking-wider">{label}</span>
    <span className="text-sm font-bold text-[#1A1A1A]">{value}</span>
  </div>
);

const TabButton = ({ active, onClick, label }: any) => (
  <button 
    onClick={onClick}
    className={cn(
      "px-6 py-3 rounded-2xl font-bold transition-all whitespace-nowrap",
      active ? "bg-[#66D2A4] text-white shadow-md shadow-[#66D2A4]/20" : "bg-white text-gray-400 border border-gray-100"
    )}
  >
    {label}
  </button>
);

const UserList = ({ 
  users, 
  onDelete,
  onViewOrders
}: { 
  users: User[], 
  onDelete: (u: User) => void,
  onViewOrders: (user: User) => void
}) => (
  <div className="space-y-4">
    {users.length === 0 ? (
      <p className="text-center py-8 text-gray-400">No users found</p>
    ) : (
      users.map((u) => (
        <div key={u.uid} className="flex items-center justify-between p-3 hover:bg-gray-50 rounded-2xl transition-colors">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center text-gray-400 overflow-hidden">
              {u.photoURL ? (
                <img src={u.photoURL} alt={u.displayName} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
              ) : (
                <Users size={20} />
              )}
            </div>
            <div>
              <h4 className="font-bold text-sm text-[#1A1A1A]">{u.displayName}</h4>
              <p className="text-[10px] text-gray-400">{u.email} • {u.role}</p>
            </div>
          </div>
          <div className="flex gap-2">
            <button 
              onClick={() => onViewOrders(u)}
              className="p-2 text-[#66D2A4] hover:bg-green-50 rounded-lg transition-colors"
              title="View Orders"
            >
              <Package size={18} />
            </button>
            <button 
              onClick={() => onDelete(u)}
              className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
            >
              <Trash2 size={18} />
            </button>
          </div>
        </div>
      ))
    )}
  </div>
);

const ProductList = ({ 
  products, 
  onEdit, 
  onDelete, 
  onAdd,
  stockThreshold,
  onThresholdChange,
  searchQuery,
  onSearchChange
}: { 
  products: Product[], 
  onEdit: (p: Product) => void, 
  onDelete: (p: Product) => void, 
  onAdd: () => void,
  stockThreshold: number,
  onThresholdChange: (val: number) => void,
  searchQuery: string,
  onSearchChange: (val: string) => void
}) => {
  const lowStockItems = products.filter(p => p.stock <= stockThreshold);
  const filteredProducts = products.filter(p => 
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.category.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Alerts Section */}
      <div className="bg-orange-50 rounded-[32px] p-6 border border-orange-100">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2 text-orange-600">
            <AlertTriangle size={20} />
            <h3 className="font-bold text-sm">Low Stock Alerts</h3>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold text-orange-400 uppercase">Threshold:</span>
            <input 
              type="number" 
              value={stockThreshold}
              onChange={(e) => onThresholdChange(Number(e.target.value))}
              className="w-12 bg-white border border-orange-200 rounded-lg px-2 py-1 text-xs font-bold text-orange-600 outline-none"
            />
          </div>
        </div>

        {lowStockItems.length === 0 ? (
          <p className="text-[10px] text-orange-400 italic">All products are well stocked.</p>
        ) : (
          <div className="space-y-2">
            {lowStockItems.map(p => (
              <button 
                key={p.id} 
                onClick={() => onEdit(p)}
                className="w-full flex justify-between items-center bg-white/50 p-3 rounded-xl border border-orange-100/50 hover:bg-white hover:border-orange-300 transition-all text-left group"
                title="Click to edit product stock"
              >
                <div className="flex flex-col">
                  <span className="text-[11px] font-bold text-orange-700 group-hover:text-orange-900">{p.name}</span>
                  <span className="text-[9px] text-orange-400 font-medium">{p.category}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold px-2 py-1 bg-orange-100 text-orange-600 rounded-lg group-hover:bg-orange-200">
                    {p.stock} left
                  </span>
                  <Edit2 size={12} className="text-orange-400 group-hover:text-orange-600" />
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="space-y-4">
        <Button 
          onClick={onAdd}
          className="w-full py-3 rounded-2xl flex items-center justify-center gap-2 mb-2"
        >
          <Plus size={20} /> Add New Product
        </Button>

        {/* Search Input */}
        <div className="relative mb-4">
          <Input 
            placeholder="Search products by name or category..." 
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="bg-gray-50 border-none"
            icon={<Search size={16} />}
          />
          {searchQuery && (
            <button 
              onClick={() => onSearchChange('')}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <X size={14} />
            </button>
          )}
        </div>

        {filteredProducts.length === 0 ? (
          <p className="text-center py-8 text-gray-400">No products found</p>
        ) : (
          filteredProducts.map((product) => (
            <div key={product.id} className="flex items-center justify-between p-3 hover:bg-gray-50 rounded-2xl transition-colors">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-gray-100 rounded-xl overflow-hidden flex items-center justify-center">
                  {product.image ? (
                    <img src={product.image} alt={product.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                  ) : (
                    <Image size={20} className="text-gray-300" />
                  )}
                </div>
                <div>
                  <h4 className="font-bold text-sm text-[#1A1A1A]">{product.name}</h4>
                  <p className="text-[10px] text-gray-400">₹{product.price} • {product.stock} in stock • {product.category}</p>
                </div>
              </div>
              <div className="flex gap-2">
                <button 
                  onClick={() => onEdit(product)}
                  className="p-2 text-blue-500 hover:bg-blue-50 rounded-lg transition-colors"
                >
                  <Edit2 size={18} />
                </button>
                <button 
                  onClick={() => onDelete(product)}
                  className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                >
                  <Trash2 size={18} />
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

const CategoryList = ({ categories, onEdit, onDelete, onAdd, onReorder, onNormalize }: { categories: Category[], onEdit: (c: Category) => void, onDelete: (c: Category) => void, onAdd: () => void, onReorder: (id: string, dir: 'up' | 'down') => void, onNormalize: () => void }) => (
  <div className="space-y-4">
    <div className="flex gap-2">
      <Button 
        onClick={onAdd}
        className="flex-1 py-3 rounded-2xl flex items-center justify-center gap-2"
      >
        <Plus size={20} /> Add New Category
      </Button>
      <button 
        onClick={onNormalize}
        className="p-3 bg-gray-100 text-gray-400 rounded-2xl hover:bg-gray-200 transition-colors"
        title="Repair & Sync All Orders"
      >
        <Settings size={20} />
      </button>
    </div>

    {categories.map((category, index) => (
      <div key={category.id} className="flex items-center justify-between p-3 hover:bg-gray-50 rounded-2xl transition-colors">
        <div className="flex items-center gap-3">
          <div className="flex flex-col gap-1 mr-1">
            <button 
              onClick={() => onReorder(category.id, 'up')}
              disabled={index === 0}
              className={cn("p-1 rounded-md hover:bg-gray-200 transition-colors", index === 0 ? "text-gray-200" : "text-gray-400")}
            >
              <ChevronUp size={16} />
            </button>
            <button 
              onClick={() => onReorder(category.id, 'down')}
              disabled={index === categories.length - 1}
              className={cn("p-1 rounded-md hover:bg-gray-200 transition-colors", index === categories.length - 1 ? "text-gray-200" : "text-gray-400")}
            >
              <ChevronDown size={16} />
            </button>
          </div>
          <div className="w-12 h-12 bg-orange-50 rounded-xl flex items-center justify-center text-xl">
            {category.icon}
          </div>
          <div>
            <h4 className="font-bold text-sm text-[#1A1A1A]">{category.name}</h4>
            <p className="text-[10px] text-gray-400">Order: {category.order ?? index} • ID: {category.id.slice(-6)}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button 
            onClick={() => onEdit(category)}
            className="p-2 text-blue-500 hover:bg-blue-50 rounded-lg transition-colors"
          >
            <Edit2 size={18} />
          </button>
          <button 
            onClick={() => onDelete(category)}
            className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
          >
            <Trash2 size={18} />
          </button>
        </div>
      </div>
    ))}
  </div>
);

const OrderList = ({ 
  orders, 
  onUpdateStatus,
  searchQuery,
  onSearchChange,
  onViewDetails
}: { 
  orders: Order[], 
  onUpdateStatus: (id: string, status: Order['status']) => void,
  searchQuery: string,
  onSearchChange: (val: string) => void,
  onViewDetails: (order: Order) => void
}) => {
  const filteredOrders = orders.filter(order => 
    (order.userPhone || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    (order.userName || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    order.id.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-4">
      <div className="relative mb-4">
        <Input 
          placeholder="Search by Name, Mobile or Order ID..." 
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="bg-gray-50 border-none"
          icon={<Search size={16} />}
        />
        {searchQuery && (
          <button 
            onClick={() => onSearchChange('')}
            className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
          >
            <X size={14} />
          </button>
        )}
      </div>

      {filteredOrders.length === 0 ? (
        <p className="text-center py-8 text-gray-400">No orders found</p>
      ) : (
        filteredOrders.map((order) => (
          <div key={order.id} className="p-4 bg-gray-50 rounded-2xl border border-gray-100">
            <div className="flex justify-between items-start mb-4">
              <div className="cursor-pointer" onClick={() => onViewDetails(order)}>
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Order #{order.id.slice(-6)}</p>
                <h4 className="font-bold text-sm text-[#1A1A1A] mt-1">{order.userName || 'Unknown User'}</h4>
                <p className="text-[10px] text-blue-500 font-bold mb-1">Mobile: {order.userPhone || 'N/A'}</p>
                <p className="text-sm font-bold text-[#66D2A4]">₹{order.total}</p>
                <p className="text-[10px] text-gray-400 mt-1">
                  {order.createdAt?.toDate ? order.createdAt.toDate().toLocaleString() : 'Just now'}
                </p>
              </div>
              <div className="flex flex-col items-end gap-9">
                <select 
                  className={cn(
                    "px-3 py-1.5 rounded-xl text-[10px] font-bold uppercase outline-none border-none cursor-pointer",
                    order.status === 'pending' ? "bg-orange-50 text-orange-500" :
                    order.status === 'confirmed' ? "bg-blue-50 text-blue-500" :
                    order.status === 'delivered' ? "bg-green-50 text-green-500" :
                    "bg-red-50 text-red-500"
                  )}
                  value={order.status}
                  onChange={(e) => onUpdateStatus(order.id, e.target.value as Order['status'])}
                >
                  <option value="pending">Pending</option>
                  <option value="confirmed">Confirmed</option>
                  <option value="delivered">Delivered</option>
                  <option value="canceled">Canceled</option>
                </select>
                <button 
                  onClick={() => onViewDetails(order)}
                  className="text-[10px] font-bold text-[#66D2A4] uppercase hover:underline"
                >
                  View Details
                </button>
              </div>
            </div>
          </div>
        ))
      )}
    </div>
  );
};

const SalesReport = ({ orders }: { orders: Order[] }) => {
  const componentRef = useRef<HTMLDivElement>(null);
  const [timeframe, setTimeframe] = useState<'today' | 'week' | 'month' | 'year' | 'all'>('all');
  const [statusFilter, setStatusFilter] = useState<Order['status'] | 'all'>('all');

  const handlePrint = useReactToPrint({
    contentRef: componentRef,
  });

  const filterOrders = () => {
    let filtered = [...orders];
    const now = new Date();

    if (statusFilter !== 'all') {
      filtered = filtered.filter(o => o.status === statusFilter);
    }

    if (timeframe !== 'all') {
      filtered = filtered.filter(o => {
        const orderDate = o.createdAt?.toDate ? o.createdAt.toDate() : new Date();
        if (timeframe === 'today') {
          return orderDate.toDateString() === now.toDateString();
        }
        if (timeframe === 'week') {
          const weekAgo = new Date();
          weekAgo.setDate(now.getDate() - 7);
          return orderDate >= weekAgo;
        }
        if (timeframe === 'month') {
          return orderDate.getMonth() === now.getMonth() && orderDate.getFullYear() === now.getFullYear();
        }
        if (timeframe === 'year') {
          return orderDate.getFullYear() === now.getFullYear();
        }
        return true;
      });
    }
    return filtered;
  };

  const currentOrders = filterOrders();

  const downloadExcel = () => {
    const data = currentOrders.flatMap(o => o.items.map(item => {
        const orderDate = o.createdAt?.toDate ? o.createdAt.toDate() : null;
        const formattedDate = orderDate 
            ? `${String(orderDate.getDate()).padStart(2, '0')}/${String(orderDate.getMonth() + 1).padStart(2, '0')}/${orderDate.getFullYear()}`
            : 'N/A';
            
        return {
            'Date': formattedDate,
            'Order ID': o.id,
            'Customer': o.userName || 'N/A',
            'Customer Mobile': o.userPhone || 'N/A',
            'Product': item.name,
            'Qty': item.quantity,
            'Price': item.price,
            'Total Item Price': item.price * item.quantity,
            'Discount (Points)': o.pointsRedeemed || 0,
            'Delivery': o.delivery || 0,
            'Grand Total': o.total,
            'Status': o.status.toUpperCase()
        };
    }));

    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Sales Report");
    XLSX.writeFile(workbook, `LumaroMart_Sales_Report_${timeframe}_${new Date().toLocaleDateString()}.xlsx`);
  };

  const totalSales = currentOrders.reduce((sum, o) => sum + o.total, 0);
  const totalOrders = currentOrders.length;
  const successfulOrders = currentOrders.filter(o => o.status === 'delivered').length;
  const canceledOrders = currentOrders.filter(o => o.status === 'canceled').length;

  return (
    <div className="space-y-6">
      {/* Date Range & Status Filters */}
      <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm space-y-4">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex-grow min-w-[200px]">
            <label className="text-[10px] font-bold text-gray-400 uppercase mb-2 block">Timeframe</label>
            <div className="flex gap-2 overflow-x-auto no-scrollbar">
              {(['all', 'today', 'week', 'month', 'year'] as const).map(t => (
                <button
                  key={t}
                  onClick={() => setTimeframe(t)}
                  className={cn(
                    "px-4 py-2 rounded-xl text-[10px] font-bold uppercase transition-all whitespace-nowrap",
                    timeframe === t ? "bg-[#66D2A4] text-white" : "bg-gray-50 text-gray-400 hover:bg-gray-100"
                  )}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>
          <div className="min-w-[150px]">
            <label className="text-[10px] font-bold text-gray-400 uppercase mb-2 block">Status Filter</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="w-full bg-gray-50 border-none rounded-xl py-2 px-3 text-[10px] font-bold uppercase outline-none"
            >
              <option value="all">All Status</option>
              <option value="pending">Pending</option>
              <option value="confirmed">Confirmed</option>
              <option value="delivered">Delivered</option>
              <option value="canceled">Canceled</option>
            </select>
          </div>
        </div>

        <div className="flex gap-3 pt-2">
          <Button 
            onClick={downloadExcel} 
            variant="secondary" 
            className="flex-grow py-3 flex items-center justify-center gap-2 text-xs"
          >
            <Download size={16} /> Excel Download
          </Button>
          <Button 
            onClick={() => handlePrint()} 
            className="flex-grow py-3 flex items-center justify-center gap-2 text-xs"
          >
            <Printer size={16} /> Print Report
          </Button>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-green-50 p-4 rounded-2xl border border-green-100">
          <p className="text-[8px] font-bold text-green-600 uppercase mb-1">Total Sales</p>
          <p className="text-lg font-bold text-green-900">₹{totalSales.toLocaleString()}</p>
        </div>
        <div className="bg-blue-50 p-4 rounded-2xl border border-blue-100">
          <p className="text-[8px] font-bold text-blue-600 uppercase mb-1">Success</p>
          <p className="text-lg font-bold text-blue-900">{successfulOrders}</p>
        </div>
        <div className="bg-red-50 p-4 rounded-2xl border border-red-100">
          <p className="text-[8px] font-bold text-red-600 uppercase mb-1">Canceled</p>
          <p className="text-lg font-bold text-red-900">{canceledOrders}</p>
        </div>
      </div>

      {/* Report Table View (Printable) */}
      <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
        <div ref={componentRef} className="p-8 bg-white print:p-0">
          <div className="hidden print:block mb-8 text-center">
            <h1 className="text-2xl font-bold text-gray-900">Lumaro Mart - Sales Report</h1>
            <p className="text-sm text-gray-500 mt-2">
              Timeframe: {timeframe.toUpperCase()} | Filter: {statusFilter.toUpperCase()}
            </p>
            <p className="text-[10px] text-gray-400 mt-1">Generated on: {new Date().toLocaleString()}</p>
          </div>

          {/* Top Grand Total display for quick view */}
          {currentOrders.length > 0 && (
            <div className="mb-6 p-4 bg-[#66D2A4]/10 rounded-2xl border border-[#66D2A4]/20 flex justify-between items-center print:hidden">
              <span className="text-sm font-bold text-gray-600 uppercase tracking-wider">Report Grand Total</span>
              <span className="text-2xl font-black text-[#66D2A4]">₹{totalSales.toLocaleString()}</span>
            </div>
          )}

          <div className="overflow-x-auto max-h-[600px] overflow-y-auto no-scrollbar relative">
            <table className="w-full text-left text-[11px] border-collapse">
              <thead className="sticky top-0 bg-white z-10 shadow-sm">
                <tr className="border-b border-gray-100">
                  <th className="py-4 px-2 font-bold text-gray-400 uppercase tracking-wider bg-white">Order ID</th>
                  <th className="py-4 px-2 font-bold text-gray-400 uppercase tracking-wider bg-white">Customer</th>
                  <th className="py-4 px-2 font-bold text-gray-400 uppercase tracking-wider bg-white">Item Details</th>
                  <th className="py-4 px-2 font-bold text-gray-400 uppercase tracking-wider text-right bg-white">Qty</th>
                  <th className="py-4 px-2 font-bold text-gray-400 uppercase tracking-wider text-right bg-white">Price</th>
                  <th className="py-4 px-2 font-bold text-gray-400 uppercase tracking-wider text-right bg-white">Total</th>
                  <th className="py-4 px-2 font-bold text-gray-400 uppercase tracking-wider text-center bg-white">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {currentOrders.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-gray-400">No records found for this period.</td>
                  </tr>
                ) : (
                  currentOrders.map(order => (
                    <React.Fragment key={order.id}>
                      {order.items.map((item, idx) => (
                        <tr key={`${order.id}-${idx}`} className="hover:bg-gray-50 transition-colors">
                          <td className="py-3 px-2 font-mono text-gray-400 bg-gray-50/50 print:bg-transparent whitespace-nowrap">
                            {idx === 0 ? `#${order.id.slice(-6)}` : ''}
                          </td>
                          <td className="py-3 px-2 bg-gray-50/50 print:bg-transparent">
                            {idx === 0 ? (
                              <>
                                <p className="font-bold text-[#1A1A1A]">{order.userName || 'N/A'}</p>
                                <p className="text-[10px] text-blue-500 font-bold whitespace-nowrap">{order.userPhone || 'N/A'}</p>
                              </>
                            ) : ''}
                          </td>
                          <td className="py-3 px-2">
                            <p className="font-bold text-[#1A1A1A]">{item.name}</p>
                            {idx === order.items.length - 1 && (
                              <div className="mt-1 flex gap-2 text-[9px] text-gray-400">
                                <span className="text-orange-500">Disc: ₹{order.pointsRedeemed || 0}</span>
                                <span className="text-blue-500">Del: ₹{order.delivery || 0}</span>
                              </div>
                            )}
                          </td>
                          <td className="py-3 px-2 text-right font-medium">{item.quantity}</td>
                          <td className="py-3 px-2 text-right">₹{item.price}</td>
                          <td className="py-3 px-2 text-right font-bold text-[#1A1A1A]">₹{item.price * item.quantity}</td>
                          <td className="py-3 px-2 text-center">
                            {idx === 0 && (
                              <span className={cn(
                                "px-2 py-0.5 rounded-full text-[8px] font-bold uppercase inline-block",
                                order.status === 'delivered' ? "bg-green-100 text-green-600" :
                                order.status === 'canceled' ? "bg-red-100 text-red-600" :
                                order.status === 'confirmed' ? "bg-blue-100 text-blue-600" :
                                "bg-orange-100 text-orange-600"
                              )}>
                                {order.status}
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </React.Fragment>
                  ))
                )}
              </tbody>
              {currentOrders.length > 0 && (
                <tfoot>
                  <tr className="bg-gray-50 font-bold text-gray-900 border-t border-gray-200">
                    <td colSpan={5} className="py-4 px-2 text-right text-xs uppercase">Grand Total</td>
                    <td className="py-4 px-2 text-right text-lg text-[#66D2A4]">₹{totalSales.toLocaleString()}</td>
                    <td></td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

const OrderDetailsModal = ({ 
  order, 
  onClose,
  onUpdateStatus
}: { 
  order: Order, 
  onClose: () => void,
  onUpdateStatus: (id: string, status: Order['status']) => void
}) => {
  const [customer, setCustomer] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const userDoc = await getDoc(doc(db, 'users', order.userId));
        if (userDoc.exists()) {
          setCustomer({ uid: userDoc.id, ...userDoc.data() } as User);
        }
      } catch (error) {
        console.error("Error fetching customer details:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchUser();
  }, [order.userId]);

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4"
    >
      <motion.div 
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        className="bg-white w-full max-w-md rounded-t-[40px] sm:rounded-[40px] p-8 max-h-[90vh] overflow-y-auto"
      >
        <div className="flex justify-between items-center mb-8">
          <div>
            <h2 className="text-2xl font-bold text-[#1A1A1A]">Order Details</h2>
            <p className="text-xs text-gray-400 font-bold uppercase tracking-widest mt-1">#{order.id.slice(-8)}</p>
          </div>
          <button onClick={onClose} className="p-2 bg-gray-100 rounded-full text-gray-500">
            <X size={20} />
          </button>
        </div>

        <div className="space-y-8">
          {/* Status Section */}
          <div className="bg-gray-50 p-6 rounded-[32px] border border-gray-100 flex items-center justify-between">
            <div>
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Status</p>
              <p className="text-sm font-bold text-[#1A1A1A] capitalize">{order.status}</p>
            </div>
            <select 
              className={cn(
                "px-4 py-2 rounded-2xl text-xs font-bold uppercase outline-none border-none cursor-pointer shadow-sm",
                order.status === 'pending' ? "bg-orange-500 text-white" :
                order.status === 'confirmed' ? "bg-blue-500 text-white" :
                order.status === 'delivered' ? "bg-green-500 text-white" :
                "bg-red-500 text-white"
              )}
              value={order.status}
              onChange={(e) => onUpdateStatus(order.id, e.target.value as Order['status'])}
            >
              <option value="pending">Pending</option>
              <option value="confirmed">Confirmed</option>
              <option value="delivered">Delivered</option>
              <option value="canceled">Canceled</option>
            </select>
          </div>

          {/* Customer Section */}
          <div className="space-y-3">
            <h3 className="text-sm font-bold text-[#1A1A1A] flex items-center gap-2">
              <Users size={16} className="text-[#66D2A4]" />
              Customer Information
            </h3>
            {loading ? (
              <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-3xl animate-pulse">
                <div className="w-10 h-10 bg-gray-200 rounded-full" />
                <div className="space-y-2 flex-grow">
                  <div className="h-3 bg-gray-200 rounded w-1/2" />
                  <div className="h-2 bg-gray-200 rounded w-3/4" />
                </div>
              </div>
            ) : customer ? (
              <div className="p-4 bg-gray-50 rounded-3xl border border-gray-100 space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center text-gray-400 overflow-hidden shadow-sm">
                    {customer.photoURL ? (
                      <img src={customer.photoURL} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <Users size={20} />
                    )}
                  </div>
                  <div>
                    <h4 className="font-bold text-sm text-[#1A1A1A]">{customer.displayName}</h4>
                    <p className="text-xs text-gray-500">{customer.email}</p>
                  </div>
                </div>
                <div className="pt-3 border-t border-gray-200 space-y-2">
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-400">Phone:</span>
                    <span className="font-bold text-gray-700">{customer.phoneNumber || 'N/A'}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-400">Address:</span>
                    <span className="font-bold text-gray-700 text-right max-w-[200px]">{customer.address || 'N/A'}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-400">Pincode:</span>
                    <span className="font-bold text-gray-700">{customer.pincode || 'N/A'}</span>
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-xs text-red-400 italic">Customer data not found.</p>
            )}
          </div>

          {/* Items Section */}
          <div className="space-y-3">
            <h3 className="text-sm font-bold text-[#1A1A1A] flex items-center gap-2">
              <Package size={16} className="text-[#66D2A4]" />
              Order Items
            </h3>
            <div className="space-y-3">
              {order.items.map((item, idx) => (
                <div key={idx} className="flex items-center gap-3 p-3 bg-white rounded-2xl border border-gray-50 shadow-sm">
                  <div className="w-12 h-12 bg-gray-100 rounded-xl overflow-hidden flex items-center justify-center">
                    {item.image ? (
                      <img src={item.image} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <Package size={20} className="text-gray-300" />
                    )}
                  </div>
                  <div className="flex-grow">
                    <h4 className="font-bold text-xs text-[#1A1A1A]">{item.name}</h4>
                    <p className="text-[10px] text-gray-400">₹{item.price} × {item.quantity}</p>
                  </div>
                  <span className="font-bold text-sm text-[#1A1A1A]">₹{item.price * item.quantity}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Summary Section */}
          <div className="bg-[#1A1A1A] text-white p-6 rounded-[32px] space-y-3 shadow-xl">
            <div className="flex justify-between text-xs opacity-60">
              <span>Subtotal</span>
              <span>₹{order.subtotal || order.total}</span>
            </div>
            {order.delivery !== undefined && (
              <div className="flex justify-between text-xs opacity-60">
                <span>Delivery Fee</span>
                <span>₹{order.delivery}</span>
              </div>
            )}
            {order.pointsRedeemed !== undefined && order.pointsRedeemed > 0 && (
              <div className="flex justify-between text-xs text-red-400">
                <span>Points Redeemed</span>
                <span>-₹{order.pointsRedeemed}</span>
              </div>
            )}
            {order.pointsEarned !== undefined && order.pointsEarned > 0 && (
              <div className="flex justify-between text-[10px] text-green-400 font-bold uppercase tracking-wider bg-white/5 p-2 rounded-lg border border-white/5">
                <span>Will Earn Points</span>
                <span>+{order.pointsEarned} Points</span>
              </div>
            )}
            <div className="pt-3 border-t border-white/10 flex justify-between items-center">
              <span className="font-bold text-sm">Total Amount</span>
              <span className="text-xl font-extrabold text-[#66D2A4]">₹{order.total}</span>
            </div>
          </div>
        </div>

        <Button onClick={onClose} className="w-full mt-8 py-4 rounded-2xl bg-gray-100 text-gray-900 border-none hover:bg-gray-200">
          Close Details
        </Button>
      </motion.div>
    </motion.div>
  );
};

const SettingsTab = ({ 
  settings, 
  onSave,
  onTestNotification 
}: { 
  settings: AppSettings, 
  onSave: (s: AppSettings) => Promise<boolean>,
  onTestNotification: () => void 
}) => {
  const [whatsappNumber, setWhatsappNumber] = useState(settings.whatsappNumber);
  const [whatsappEnabled, setWhatsappEnabled] = useState(settings.whatsappEnabled ?? true);
  const [supportNumber, setSupportNumber] = useState(settings.supportNumber || '');
  const [supportEnabled, setSupportEnabled] = useState(settings.supportEnabled ?? true);
  const [telegramBotToken, setTelegramBotToken] = useState(settings.telegramBotToken || '');
  const [telegramChatId, setTelegramChatId] = useState(settings.telegramChatId || '');
  const [telegramEnabled, setTelegramEnabled] = useState(settings.telegramEnabled ?? false);
  const [isSaving, setIsSaving] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [notifPermission, setNotifPermission] = useState<NotificationPermission>("default");

  useEffect(() => {
    if ("Notification" in window) {
      setNotifPermission(Notification.permission);
    }
  }, []);

  useEffect(() => {
    setWhatsappNumber(settings.whatsappNumber);
    setWhatsappEnabled(settings.whatsappEnabled ?? true);
    setSupportNumber(settings.supportNumber || '');
    setSupportEnabled(settings.supportEnabled ?? true);
    setTelegramBotToken(settings.telegramBotToken || '');
    setTelegramChatId(settings.telegramChatId || '');
    setTelegramEnabled(settings.telegramEnabled ?? false);
  }, [settings]);

  const handleRequestPermission = () => {
    if ("Notification" in window) {
      Notification.requestPermission().then(permission => {
        setNotifPermission(permission);
        if (permission === "granted") {
          onTestNotification();
        } else if (permission === "denied") {
          alert("Notification permission denied. Please enable it from browser settings.");
        }
      });
    } else {
      alert("This browser does not support notifications.");
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    const success = await onSave({ 
      whatsappNumber, 
      whatsappEnabled,
      supportNumber,
      supportEnabled,
      telegramEnabled,
      telegramBotToken,
      telegramChatId
    });
    setIsSaving(false);
    
    if (success) {
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 3000);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-blue-50 rounded-[32px] p-6 border border-blue-100 relative overflow-hidden">
        <AnimatePresence>
          {showSuccess && (
            <motion.div 
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="absolute inset-x-0 top-0 bg-green-500 text-white py-2 px-4 flex items-center justify-center gap-2 z-10"
            >
              <CheckCircle size={16} />
              <span className="text-xs font-bold">Settings saved successfully!</span>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="flex items-center gap-2 text-blue-600 mb-4">
          <Settings size={20} />
          <h3 className="font-bold text-sm">App Settings</h3>
        </div>
        
        <div className="space-y-4">
          <div className="flex items-center justify-between p-4 bg-white rounded-2xl border border-blue-100">
            <div className="flex items-center gap-3">
              <div className={cn(
                "w-10 h-10 rounded-xl flex items-center justify-center transition-colors",
                whatsappEnabled ? "bg-[#66D2A4] text-white" : "bg-gray-100 text-gray-400"
              )}>
                <ShoppingBag size={20} />
              </div>
              <div>
                <p className="text-sm font-bold text-[#1A1A1A]">WhatsApp Ordering</p>
                <p className="text-[10px] text-gray-400">Enable/Disable WhatsApp messages</p>
              </div>
            </div>
            <button 
              onClick={() => setWhatsappEnabled(!whatsappEnabled)}
              className={cn(
                "w-12 h-6 rounded-full transition-all relative",
                whatsappEnabled ? "bg-[#66D2A4]" : "bg-gray-200"
              )}
            >
              <div className={cn(
                "absolute top-1 w-4 h-4 bg-white rounded-full transition-all",
                whatsappEnabled ? "right-1" : "left-1"
              )} />
            </button>
          </div>

          <div className={cn("transition-all", !whatsappEnabled && "opacity-50 pointer-events-none")}>
            <label className="text-[10px] font-bold text-gray-400 uppercase mb-1 block">WhatsApp Order Number</label>
            <Input 
              placeholder="e.g. 919876543210" 
              value={whatsappNumber}
              onChange={(e) => setWhatsappNumber(e.target.value)}
              className="bg-white"
            />
            <p className="text-[9px] text-gray-400 mt-1 italic">Include country code without + (e.g. 91 for India)</p>
          </div>

          <div className="h-px bg-blue-100 my-4" />

          {/* Support Settings */}
          <div className="flex items-center justify-between p-4 bg-white rounded-2xl border border-blue-100">
            <div className="flex items-center gap-3">
              <div className={cn(
                "w-10 h-10 rounded-xl flex items-center justify-center transition-colors",
                supportEnabled ? "bg-[#66D2A4] text-white" : "bg-gray-100 text-gray-400"
              )}>
                <Phone size={20} />
              </div>
              <div>
                <p className="text-sm font-bold text-[#1A1A1A]">Customer Support</p>
                <p className="text-[10px] text-gray-400">Show help options in Profile</p>
              </div>
            </div>
            <button 
              onClick={() => setSupportEnabled(!supportEnabled)}
              className={cn(
                "w-12 h-6 rounded-full transition-all relative",
                supportEnabled ? "bg-[#66D2A4]" : "bg-gray-200"
              )}
            >
              <div className={cn(
                "absolute top-1 w-4 h-4 bg-white rounded-full transition-all",
                supportEnabled ? "right-1" : "left-1"
              )} />
            </button>
          </div>

          <div className={cn("transition-all", !supportEnabled && "opacity-50 pointer-events-none")}>
            <label className="text-[10px] font-bold text-gray-400 uppercase mb-1 block">Support Mobile Number</label>
            <Input 
              placeholder="e.g. 9140094049" 
              value={supportNumber}
              onChange={(e) => setSupportNumber(e.target.value)}
              className="bg-white"
            />
            <p className="text-[9px] text-gray-400 mt-1 italic">Users can call or WhatsApp this number from Profile</p>
          </div>

          <div className="h-px bg-blue-100 my-4" />

          {/* Support Settings */}
          <div className="flex items-center justify-between p-4 bg-white rounded-2xl border border-blue-100">
            <div className="flex items-center gap-3">
              <div className={cn(
                "w-10 h-10 rounded-xl flex items-center justify-center transition-colors",
                supportEnabled ? "bg-[#66D2A4] text-white" : "bg-gray-100 text-gray-400"
              )}>
                <Phone size={20} />
              </div>
              <div>
                <p className="text-sm font-bold text-[#1A1A1A]">Customer Support</p>
                <p className="text-[10px] text-gray-400">Show help options in Profile</p>
              </div>
            </div>
            <button 
              onClick={() => setSupportEnabled(!supportEnabled)}
              className={cn(
                "w-12 h-6 rounded-full transition-all relative",
                supportEnabled ? "bg-[#66D2A4]" : "bg-gray-200"
              )}
            >
              <div className={cn(
                "absolute top-1 w-4 h-4 bg-white rounded-full transition-all",
                supportEnabled ? "right-1" : "left-1"
              )} />
            </button>
          </div>

          <div className={cn("transition-all", !supportEnabled && "opacity-50 pointer-events-none")}>
            <label className="text-[10px] font-bold text-gray-400 uppercase mb-1 block">Support Mobile Number</label>
            <Input 
              placeholder="e.g. 9140094049" 
              value={supportNumber}
              onChange={(e) => setSupportNumber(e.target.value)}
              className="bg-white"
            />
            <p className="text-[9px] text-gray-400 mt-1 italic">Users can call or WhatsApp this number from Profile</p>
          </div>

          <div className="h-px bg-blue-100 my-4" />

          {/* Browser Notifications Switch */}
          <div className="flex items-center justify-between p-4 bg-white rounded-2xl border border-blue-100">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-orange-100 text-orange-500 flex items-center justify-center">
                <Bell size={20} />
              </div>
              <div>
                <p className="text-sm font-bold text-[#1A1A1A]">Browser Alerts</p>
                <p className="text-[10px] text-gray-400">Status: <span className={cn(
                  "capitalize font-bold",
                  notifPermission === 'granted' ? "text-green-500" : 
                  notifPermission === 'denied' ? "text-red-500" : "text-gray-400"
                )}>{notifPermission}</span></p>
              </div>
            </div>
            <div className="flex gap-2">
              {notifPermission === 'granted' && (
                <button 
                  onClick={onTestNotification}
                  className="text-[10px] font-bold text-blue-500 bg-blue-50 px-3 py-2 rounded-xl hover:bg-blue-100 transition-colors"
                >
                  Test
                </button>
              )}
              <button 
                onClick={handleRequestPermission}
                className={cn(
                  "text-[10px] font-bold px-3 py-2 rounded-xl transition-colors",
                  notifPermission === 'granted' ? "bg-green-50 text-green-500" : "bg-orange-50 text-orange-500 hover:bg-orange-100"
                )}
              >
                {notifPermission === 'granted' ? 'Enabled' : 'Enable'}
              </button>
            </div>
          </div>

          <div className="h-px bg-blue-100 my-4" />

          {/* Telegram Settings */}
          <div className="flex items-center justify-between p-4 bg-white rounded-2xl border border-blue-100">
            <div className="flex items-center gap-3">
              <div className={cn(
                "w-10 h-10 rounded-xl flex items-center justify-center transition-colors",
                telegramEnabled ? "bg-[#0088cc] text-white" : "bg-gray-100 text-gray-400"
              )}>
                <Send size={20} />
              </div>
              <div>
                <p className="text-sm font-bold text-[#1A1A1A]">Telegram Notifications</p>
                <p className="text-[10px] text-gray-400">Receive Push Notifications to Phone</p>
              </div>
            </div>
            <button 
              onClick={() => setTelegramEnabled(!telegramEnabled)}
              className={cn(
                "w-12 h-6 rounded-full transition-all relative",
                telegramEnabled ? "bg-[#0088cc]" : "bg-gray-200"
              )}
            >
              <div className={cn(
                "absolute top-1 w-4 h-4 bg-white rounded-full transition-all",
                telegramEnabled ? "right-1" : "left-1"
              )} />
            </button>
          </div>

          <div className={cn("space-y-4 transition-all", !telegramEnabled && "opacity-50 pointer-events-none")}>
            <div>
              <label className="text-[10px] font-bold text-gray-400 uppercase mb-1 block">Telegram Bot Token</label>
              <Input 
                value={telegramBotToken}
                onChange={(e) => setTelegramBotToken(e.target.value)}
                placeholder="Paste Bot Token here"
                className="bg-white"
              />
            </div>
            <div>
              <label className="text-[10px] font-bold text-gray-400 uppercase mb-1 block">Your Chat ID</label>
              <div className="flex gap-2">
                <Input 
                  value={telegramChatId}
                  onChange={(e) => setTelegramChatId(e.target.value)}
                  placeholder="Paste Chat ID here"
                  className="bg-white"
                />
              </div>
              <p className="text-[9px] text-gray-400 mt-1 italic">Use @userinfobot on Telegram to get your Chat ID</p>
            </div>
          </div>
          
          <Button 
            onClick={handleSave}
            className="w-full py-3 rounded-2xl flex items-center justify-center gap-2"
            disabled={isSaving}
          >
            {isSaving ? <Loader2 className="animate-spin" size={18} /> : 'Save Settings'}
          </Button>
        </div>
      </div>
    </div>
  );
};

const ProductFormModal = ({ 
  mode, 
  product, 
  categories,
  onClose, 
  onSave 
}: { 
  mode: 'add' | 'edit', 
  product?: Product, 
  categories: Category[],
  onClose: () => void, 
  onSave: (p: any) => Promise<void> 
}) => {
  const [formData, setFormData] = useState<Partial<Product>>(product || {
    name: '',
    category: categories[0]?.name || 'Fresh Produce',
    image: '',
    description: ''
  });
  const [uploading, setUploading] = useState(false);

  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setUploading(true);
      try {
        const reader = new FileReader();
        reader.onloadend = async () => {
          const base64 = reader.result as string;
          // Compress image to ensure it stays well under 1MB even after base64 encoding
          const compressed = await compressImage(base64, 800, 800, 0.6);
          setFormData(prev => ({ ...prev, image: compressed }));
          setUploading(false);
        };
        reader.readAsDataURL(file);
      } catch (error) {
        console.error("Error processing image:", error);
        alert("Failed to process image. Please try another one.");
        setUploading(false);
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.image) {
      alert("Please upload a product image.");
      return;
    }

    if ((formData.price || 0) < 0) {
      alert("Price cannot be negative.");
      return;
    }

    if ((formData.stock || 0) < 0) {
      alert("Stock cannot be negative.");
      return;
    }

    setUploading(true);
    try {
      await onSave(formData);
    } catch (error: any) {
      console.error("Error saving product:", error);
      alert(error.message || "Failed to save product. Please try again.");
    } finally {
      setUploading(false);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4"
    >
      <motion.div 
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        className="bg-white w-full max-w-md rounded-t-[40px] sm:rounded-[40px] p-8 max-h-[90vh] overflow-y-auto"
      >
        <div className="flex justify-between items-center mb-8">
          <h2 className="text-2xl font-bold text-[#1A1A1A]">
            {mode === 'add' ? 'Add New Product' : 'Edit Product'}
          </h2>
          <button onClick={onClose} className="p-2 bg-gray-100 rounded-full text-gray-500">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="flex flex-col items-center mb-6">
            <div className="relative w-32 h-32 bg-[#F0F7F4] rounded-3xl overflow-hidden group border-2 border-dashed border-gray-200 hover:border-[#66D2A4] transition-colors">
              {formData.image ? (
                <img src={formData.image} alt="Preview" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center text-gray-400">
                  <Image size={32} />
                  <span className="text-[10px] mt-2 font-bold uppercase">Upload Image</span>
                </div>
              )}
              <input 
                type="file" 
                accept="image/*"
                onChange={handleImageChange}
                className="absolute inset-0 opacity-0 cursor-pointer"
              />
              {uploading && (
                <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                  <Loader2 className="animate-spin text-white" size={24} />
                </div>
              )}
            </div>
            <p className="text-[10px] text-gray-400 mt-2 font-medium text-center w-full">
              Auto-optimized • Format: JPG, PNG
            </p>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold text-gray-400 uppercase tracking-wider ml-2">Product Name</label>
            <Input 
              value={formData.name}
              onChange={e => setFormData({ ...formData, name: e.target.value })}
              placeholder="e.g. Organic Avocados"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-xs font-bold text-gray-400 uppercase tracking-wider ml-2">Price (₹)</label>
              <Input 
                type="number"
                min="0"
                value={formData.price !== undefined ? formData.price : ''}
                onChange={e => {
                  const val = e.target.value;
                  setFormData({ ...formData, price: val === '' ? undefined : Math.max(0, Number(val)) });
                }}
                placeholder="0"
                required
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold text-gray-400 uppercase tracking-wider ml-2">Stock</label>
              <Input 
                type="number"
                min="0"
                value={formData.stock !== undefined ? formData.stock : ''}
                onChange={e => {
                  const val = e.target.value;
                  setFormData({ ...formData, stock: val === '' ? undefined : Math.max(0, Math.floor(Number(val))) });
                }}
                placeholder="0"
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold text-gray-400 uppercase tracking-wider ml-2">Category</label>
            <select 
              className="w-full bg-[#F0F7F4] border-none rounded-2xl py-4 px-4 focus:ring-2 focus:ring-[#66D2A4] outline-none transition-all appearance-none font-medium"
              value={formData.category}
              onChange={e => setFormData({ ...formData, category: e.target.value })}
              required
            >
              {categories.map(cat => (
                <option key={cat.id} value={cat.name}>{cat.name}</option>
              ))}
              {categories.length === 0 && <option value="Fresh Produce">Fresh Produce</option>}
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold text-gray-400 uppercase tracking-wider ml-2">Description</label>
            <textarea 
              className="w-full bg-[#F0F7F4] border-none rounded-2xl py-4 px-4 focus:ring-2 focus:ring-[#66D2A4] outline-none transition-all font-medium min-h-[100px]"
              value={formData.description}
              onChange={e => setFormData({ ...formData, description: e.target.value })}
              placeholder="Product description..."
            />
          </div>

          <div className="pt-4 flex gap-3">
            <Button type="button" variant="secondary" className="flex-grow py-4" onClick={onClose} disabled={uploading}>
              Cancel
            </Button>
            <Button type="submit" className="flex-grow py-4 shadow-lg shadow-[#66D2A4]/20" disabled={uploading}>
              {uploading ? (
                <div className="flex items-center justify-center gap-2">
                  <Loader2 className="animate-spin" size={18} />
                  <span>Saving...</span>
                </div>
              ) : (
                mode === 'add' ? 'Add Product' : 'Save Changes'
              )}
            </Button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  );
};

const CategoryFormModal = ({ 
  mode, 
  category, 
  onClose, 
  onSave 
}: { 
  mode: 'add' | 'edit', 
  category?: Category, 
  onClose: () => void, 
  onSave: (c: any) => Promise<void> 
}) => {
  const [formData, setFormData] = useState<Partial<Category>>(category || {
    name: '',
    icon: '📦'
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await onSave(formData);
    } catch (error: any) {
      console.error("Error saving category:", error);
      alert(error.message || "Failed to save category.");
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4"
    >
      <motion.div 
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        className="bg-white w-full max-w-md rounded-t-[40px] sm:rounded-[40px] p-8 max-h-[90vh] overflow-y-auto"
      >
        <div className="flex justify-between items-center mb-8">
          <h2 className="text-2xl font-bold text-[#1A1A1A]">
            {mode === 'add' ? 'Add New Category' : 'Edit Category'}
          </h2>
          <button onClick={onClose} className="p-2 bg-gray-100 rounded-full text-gray-500">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <label className="text-xs font-bold text-gray-400 uppercase tracking-wider ml-2">Category Name</label>
            <Input 
              value={formData.name}
              onChange={e => setFormData({ ...formData, name: e.target.value })}
              placeholder="e.g. Fresh Produce"
              required
            />
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold text-gray-400 uppercase tracking-wider ml-2">Icon (Emoji)</label>
            <Input 
              value={formData.icon}
              onChange={e => setFormData({ ...formData, icon: e.target.value })}
              placeholder="e.g. 🥕"
              required
            />
          </div>

          <div className="pt-4 flex gap-3">
            <Button type="button" variant="secondary" className="flex-grow py-4" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" className="flex-grow py-4 shadow-lg shadow-[#66D2A4]/20">
              {mode === 'add' ? 'Add Category' : 'Save Changes'}
            </Button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  );
};

const BannerList = ({ banners, onEdit, onDelete, onAdd }: { banners: Banner[], onEdit: (b: Banner) => void, onDelete: (b: Banner) => void, onAdd: () => void }) => (
  <div className="space-y-4">
    <div className="flex justify-between items-center mb-4">
      <h3 className="font-bold text-[#1A1A1A]">Home Banners</h3>
      <Button onClick={onAdd} className="py-2 px-4 rounded-xl flex items-center gap-2 text-sm">
        <Plus size={16} /> Add Banner
      </Button>
    </div>
    <div className="space-y-3">
      {banners.map(banner => (
        <div key={banner.id} className="p-4 bg-gray-50 rounded-2xl border border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl flex items-center justify-center text-white overflow-hidden" style={{ backgroundColor: banner.backgroundColor }}>
              {banner.image ? (
                <img src={banner.image} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
              ) : (
                <Star size={20} fill="currentColor" />
              )}
            </div>
            <div>
              <h4 className="font-bold text-sm text-[#1A1A1A]">{banner.title}</h4>
              <p className="text-[10px] text-gray-400 uppercase font-bold tracking-wider">{banner.subtitle}</p>
              <span className={cn(
                "inline-block mt-1 px-2 py-0.5 rounded-full text-[8px] font-bold uppercase",
                banner.active ? "bg-green-100 text-green-600" : "bg-gray-200 text-gray-500"
              )}>
                {banner.active ? 'Active' : 'Inactive'}
              </span>
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={() => onEdit(banner)} className="p-2 text-blue-500 hover:bg-blue-50 rounded-lg transition-colors">
              <Edit2 size={18} />
            </button>
            <button onClick={() => onDelete(banner)} className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors">
              <Trash2 size={18} />
            </button>
          </div>
        </div>
      ))}
      {banners.length === 0 && (
        <div className="text-center py-12 text-gray-400 bg-gray-50 rounded-3xl border border-dashed border-gray-200">
          <p className="text-sm">No banners found. Add one to show on Home screen.</p>
        </div>
      )}
    </div>
  </div>
);

const BannerFormModal = ({ 
  mode, 
  banner, 
  onClose, 
  onSave 
}: { 
  mode: 'add' | 'edit', 
  banner?: Banner, 
  onClose: () => void, 
  onSave: (b: any) => Promise<void> 
}) => {
  const [formData, setFormData] = useState<Partial<Banner>>(banner || {
    title: '',
    subtitle: '',
    buttonText: 'Shop Now',
    backgroundColor: '#2EB87E',
    image: '',
    active: true
  });
  const [uploading, setUploading] = useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const reader = new FileReader();
      reader.onload = async (event) => {
        const base64 = event.target?.result as string;
        // Compress image to ensure it stays well under 1MB even after base64 encoding
        const compressed = await compressImage(base64, 1200, 600, 0.6);
        setFormData(prev => ({ ...prev, image: compressed }));
        setUploading(false);
      };
      reader.readAsDataURL(file);
    } catch (error) {
      console.error("Error processing banner image:", error);
      alert("Failed to process image.");
      setUploading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setUploading(true);
    try {
      await onSave(formData);
    } catch (error: any) {
      console.error("Error saving banner:", error);
      alert(error.message || "Failed to save banner.");
    } finally {
      setUploading(false);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4"
    >
      <motion.div 
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        className="bg-white w-full max-w-md rounded-t-[40px] sm:rounded-[40px] p-8 max-h-[90vh] overflow-y-auto"
      >
        <div className="flex justify-between items-center mb-8">
          <h2 className="text-2xl font-bold text-[#1A1A1A]">
            {mode === 'add' ? 'Add New Banner' : 'Edit Banner'}
          </h2>
          <button onClick={onClose} className="p-2 bg-gray-100 rounded-full text-gray-500">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <label className="text-xs font-bold text-gray-400 uppercase tracking-wider ml-2">Banner Image</label>
            <div 
              onClick={() => fileInputRef.current?.click()}
              className="w-full aspect-[2/1] bg-[#F0F7F4] rounded-3xl border-2 border-dashed border-gray-200 flex flex-col items-center justify-center gap-2 cursor-pointer hover:border-[#66D2A4] transition-all overflow-hidden relative group"
            >
              {formData.image ? (
                <>
                  <img src={formData.image} alt="Preview" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-xs font-bold">
                    Change Image
                  </div>
                </>
              ) : (
                <>
                  <div className="p-3 bg-white rounded-2xl text-[#66D2A4] shadow-sm">
                    <Image size={24} />
                  </div>
                  <span className="text-xs font-bold text-gray-400">Click to upload image</span>
                </>
              )}
              {uploading && (
                <div className="absolute inset-0 bg-white/80 flex items-center justify-center">
                  <Loader2 className="animate-spin text-[#66D2A4]" size={24} />
                </div>
              )}
            </div>
            <p className="text-[10px] text-gray-400 mt-2 font-medium text-center">
              Auto-optimized • Format: JPG, PNG
            </p>
            <input 
              type="file" 
              ref={fileInputRef} 
              onChange={handleImageUpload} 
              className="hidden" 
              accept="image/*" 
            />
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold text-gray-400 uppercase tracking-wider ml-2">Main Title</label>
            <Input 
              value={formData.title}
              onChange={e => setFormData({ ...formData, title: e.target.value })}
              placeholder="e.g. Get 20% Cashback"
              required
            />
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold text-gray-400 uppercase tracking-wider ml-2">Subtitle</label>
            <Input 
              value={formData.subtitle}
              onChange={e => setFormData({ ...formData, subtitle: e.target.value })}
              placeholder="e.g. Special Offer"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-xs font-bold text-gray-400 uppercase tracking-wider ml-2">Button Text</label>
              <Input 
                value={formData.buttonText}
                onChange={e => setFormData({ ...formData, buttonText: e.target.value })}
                placeholder="Shop Now"
                required
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold text-gray-400 uppercase tracking-wider ml-2">Bg Color (Hex)</label>
              <div className="flex gap-2">
                <div className="w-12 h-12 rounded-xl border border-gray-200" style={{ backgroundColor: formData.backgroundColor }} />
                <Input 
                  value={formData.backgroundColor}
                  onChange={e => setFormData({ ...formData, backgroundColor: e.target.value })}
                  placeholder="#2EB87E"
                  required
                />
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-2xl">
            <input 
              type="checkbox" 
              id="banner-active"
              className="w-5 h-5 accent-[#66D2A4]"
              checked={formData.active}
              onChange={e => setFormData({ ...formData, active: e.target.checked })}
            />
            <label htmlFor="banner-active" className="text-sm font-bold text-gray-600">Active (Show on Home Screen)</label>
          </div>

          <div className="pt-4 flex gap-3">
            <Button type="button" variant="secondary" className="flex-grow py-4" onClick={onClose} disabled={uploading}>
              Cancel
            </Button>
            <Button type="submit" className="flex-grow py-4 shadow-lg shadow-[#66D2A4]/20" disabled={uploading}>
              {uploading ? (
                <div className="flex items-center justify-center gap-2">
                  <Loader2 className="animate-spin" size={18} />
                  <span>Saving...</span>
                </div>
              ) : (
                mode === 'add' ? 'Add Banner' : 'Save Changes'
              )}
            </Button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  );
};

const UserStatsModal = ({ user, orders, onClose, onViewAllOrders }: { user: User, orders: Order[], onClose: () => void, onViewAllOrders: () => void }) => {
  const stats = {
    total: orders.length,
    delivered: orders.filter(o => o.status === 'delivered').length,
    canceled: orders.filter(o => o.status === 'canceled').length,
    pending: orders.filter(o => o.status === 'pending' || o.status === 'confirmed').length,
    totalSpent: orders.reduce((acc, o) => acc + o.total, 0)
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[110] flex items-center justify-center p-4"
    >
      <motion.div 
        initial={{ y: 50, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 50, opacity: 0 }}
        className="bg-white w-full max-w-md rounded-[32px] overflow-hidden"
      >
        <div className="p-6 border-b border-gray-50 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center overflow-hidden">
              {user.photoURL ? (
                <img src={user.photoURL} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
              ) : (
                <Users size={24} className="text-gray-400" />
              )}
            </div>
            <div>
              <h3 className="text-lg font-bold text-[#1A1A1A]">{user.displayName}</h3>
              <p className="text-xs text-gray-400">{user.email}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
            <X size={20} className="text-gray-400" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-blue-50 p-4 rounded-2xl">
              <div className="flex items-center gap-2 text-blue-600 mb-1">
                <ShoppingBag size={16} />
                <span className="text-[10px] font-bold uppercase tracking-wider">Total Orders</span>
              </div>
              <span className="text-2xl font-bold text-blue-900">{stats.total}</span>
            </div>
            <div className="bg-green-50 p-4 rounded-2xl">
              <div className="flex items-center gap-2 text-green-600 mb-1">
                <CheckCircle size={16} />
                <span className="text-[10px] font-bold uppercase tracking-wider">Delivered</span>
              </div>
              <span className="text-2xl font-bold text-green-900">{stats.delivered}</span>
            </div>
            <div className="bg-red-50 p-4 rounded-2xl">
              <div className="flex items-center gap-2 text-red-600 mb-1">
                <XCircle size={16} />
                <span className="text-[10px] font-bold uppercase tracking-wider">Canceled</span>
              </div>
              <span className="text-2xl font-bold text-red-900">{stats.canceled}</span>
            </div>
            <div className="bg-orange-50 p-4 rounded-2xl">
              <div className="flex items-center gap-2 text-orange-600 mb-1">
                <Clock size={16} />
                <span className="text-[10px] font-bold uppercase tracking-wider">In Progress</span>
              </div>
              <span className="text-2xl font-bold text-orange-900">{stats.pending}</span>
            </div>
          </div>

          <div className="bg-gray-50 p-4 rounded-2xl flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-[#66D2A4] shadow-sm">
                <TrendingUp size={20} />
              </div>
              <div>
                <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Total Value</p>
                <p className="text-lg font-bold text-[#1A1A1A]">₹{stats.totalSpent.toLocaleString()}</p>
              </div>
            </div>
          </div>

          <div className="bg-amber-50 p-4 rounded-2xl flex items-center justify-between border border-amber-100">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-amber-500 shadow-sm">
                <Star size={20} fill="currentColor" />
              </div>
              <div>
                <p className="text-[10px] text-amber-600 font-bold uppercase tracking-wider">Loyalty Points</p>
                <p className="text-lg font-bold text-amber-900">{user.loyaltyPoints || 0} pts</p>
              </div>
            </div>
          </div>

          <Button 
            onClick={onViewAllOrders}
            className="w-full py-4 rounded-2xl flex items-center justify-center gap-2 shadow-lg shadow-[#66D2A4]/20"
          >
            <Package size={20} /> View Order History
          </Button>
        </div>
      </motion.div>
    </motion.div>
  );
};

const DeleteConfirmationModal = ({ title, message, onConfirm, onCancel }: { title: string, message: string, onConfirm: () => void, onCancel: () => void }) => (
  <motion.div 
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    exit={{ opacity: 0 }}
    className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[110] flex items-center justify-center p-4"
  >
    <motion.div 
      initial={{ scale: 0.9, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      exit={{ scale: 0.9, opacity: 0 }}
      className="bg-white w-full max-w-sm rounded-[32px] p-8 text-center"
    >
      <div className="w-16 h-16 bg-red-50 rounded-2xl flex items-center justify-center text-red-500 mx-auto mb-6">
        <Trash2 size={32} />
      </div>
      <h3 className="text-xl font-bold text-[#1A1A1A] mb-2">{title}</h3>
      <p className="text-gray-500 text-sm mb-8 leading-relaxed">{message}</p>
      <div className="flex gap-3">
        <Button variant="secondary" className="flex-grow py-4" onClick={onCancel}>
          Cancel
        </Button>
        <Button className="flex-grow py-4 bg-red-500 hover:bg-red-600 text-white border-none shadow-lg shadow-red-500/20" onClick={onConfirm}>
          Delete
        </Button>
      </div>
    </motion.div>
  </motion.div>
);

function cn(...inputs: any[]) {
  return inputs.filter(Boolean).join(' ');
}
