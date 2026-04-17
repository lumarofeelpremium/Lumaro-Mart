import React, { useState, useEffect } from 'react';
import { ChevronLeft, Package, Clock, X, Star, MapPin, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { db } from '../firebase';
import { collection, query, where, orderBy, onSnapshot, doc, updateDoc, writeBatch } from 'firebase/firestore';
import { motion, AnimatePresence } from 'motion/react';
import { User, Order } from '../types';
import { handleFirestoreError, OperationType } from '../lib/firestore-utils';
import { Button } from '../components/ui/Base';
import { cacheUtils } from '../lib/cache-utils';

export const MyOrders = ({ user }: { user: User | null }) => {
  const navigate = useNavigate();
  const [orders, setOrders] = useState<Order[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [isMarkingAll, setIsMarkingAll] = useState(false);

  const unreadCount = orders.filter(o => !o.viewed).length;

  // Load cached orders on mount
  useEffect(() => {
    if (!user) return;
    const cachedOrders = cacheUtils.getItem(`orders_cache_${user.uid}`);
    if (cachedOrders) {
      try {
        setOrders(JSON.parse(cachedOrders));
        setLoading(false);
      } catch (e) {
        console.error('Error parsing orders cache', e);
      }
    }
  }, [user]);

  useEffect(() => {
    if (!user) {
      navigate('/login');
      return;
    }

    const q = query(
      collection(db, 'orders'),
      where('userId', '==', user.uid)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const ordersData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Order[];
      
      // Sort client-side to avoid index requirement
      ordersData.sort((a, b) => {
        const timeA = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
        const timeB = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
        return timeB - timeA;
      });

      setOrders(ordersData);
      setLoading(false);
      if (user) {
        cacheUtils.setItem(`orders_cache_${user.uid}`, ordersData);
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'orders');
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user, navigate]);

  const handleMarkAllAsRead = async () => {
    if (!user || unreadCount === 0) return;
    
    setIsMarkingAll(true);
    try {
      const batch = writeBatch(db);
      const unreadOrders = orders.filter(o => !o.viewed);
      
      unreadOrders.forEach(order => {
        const orderRef = doc(db, 'orders', order.id);
        batch.update(orderRef, { viewed: true });
      });
      
      await batch.commit();
    } catch (error) {
      console.error("Error marking all orders as read:", error);
    } finally {
      setIsMarkingAll(false);
    }
  };
  const handleOpenOrder = async (order: Order) => {
    setSelectedOrder(order);
    
    // Mark as read if it has a 'read' property or similar
    // For now, we'll just handle the UI side, but if there's a specific 'viewed' status, we could update it
    if (!order.viewed) {
      try {
        await updateDoc(doc(db, 'orders', order.id), {
          viewed: true
        });
      } catch (error) {
        console.error("Error marking order as viewed:", error);
      }
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
      <div className="bg-white px-6 py-6 flex items-center gap-4 border-b border-gray-100 sticky top-0 z-50">
        <button 
          onClick={() => navigate(-1)}
          className="w-10 h-10 bg-[#F0F7F4] rounded-xl flex items-center justify-center text-gray-600"
        >
          <ChevronLeft size={20} />
        </button>
        <h1 className="text-lg font-bold text-[#1A1A1A]">My Orders</h1>
        {orders.length > 0 && unreadCount > 0 && (
          <button 
            onClick={handleMarkAllAsRead}
            disabled={isMarkingAll}
            className="ml-auto text-[10px] font-bold text-[#66D2A4] uppercase tracking-wider disabled:opacity-50"
          >
            {isMarkingAll ? 'Marking...' : 'Mark all read'}
          </button>
        )}
      </div>

      <div className="px-6 pt-6 space-y-4">
        {orders.length === 0 ? (
          <div className="text-center py-20">
            <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center mx-auto mb-4 shadow-sm">
              <Package size={32} className="text-gray-200" />
            </div>
            <h2 className="text-xl font-bold text-gray-400">No orders yet</h2>
            <Button 
              variant="ghost" 
              className="mt-4 text-[#66D2A4]"
              onClick={() => navigate('/')}
            >
              Start Shopping
            </Button>
          </div>
        ) : (
          orders.map((order) => (
            <motion.button
              key={order.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              onClick={() => handleOpenOrder(order)}
              className="w-full text-left p-5 bg-white rounded-[32px] border border-gray-100 shadow-sm hover:border-[#66D2A4] transition-all relative overflow-hidden group"
            >
              {!order.viewed && (
                <div className="absolute top-0 right-0 w-12 h-12 overflow-hidden">
                  <div className="absolute top-2 right-2 w-3 h-3 bg-[#66D2A4] rounded-full border-2 border-white shadow-sm" />
                </div>
              )}
              
              <div className="flex justify-between items-start mb-4">
                <div>
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Order #{order.id.slice(-6)}</p>
                  <p className="text-lg font-black text-[#1A1A1A]">₹{order.total}</p>
                </div>
                <span className={`px-3 py-1 rounded-xl text-[10px] font-bold uppercase tracking-wider ${
                  order.status === 'pending' ? "bg-orange-50 text-orange-500" :
                  order.status === 'confirmed' ? "bg-blue-50 text-blue-500" :
                  "bg-green-50 text-green-500"
                }`}>
                  {order.status}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-[10px] text-gray-400 font-bold uppercase tracking-widest">
                  <Clock size={12} />
                  {order.createdAt?.toDate ? order.createdAt.toDate().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Just now'}
                </div>
                <div className="text-[10px] font-bold text-[#66D2A4] bg-[#F0F7F4] px-2 py-1 rounded-lg">
                  {order.items.length} {order.items.length === 1 ? 'Item' : 'Items'}
                </div>
              </div>
            </motion.button>
          ))
        )}
      </div>

      {/* Order Details Modal */}
      <AnimatePresence>
        {selectedOrder && (
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
                  <p className="text-xs text-gray-400 font-medium">#{selectedOrder.id}</p>
                </div>
                <button onClick={() => setSelectedOrder(null)} className="p-2 bg-gray-100 rounded-full text-gray-500">
                  <X size={20} />
                </button>
              </div>

              <div className="space-y-6">
                <div className="flex items-center justify-between p-5 bg-[#F0F7F4] rounded-[32px]">
                  <div className="flex items-center gap-3">
                    <div className="p-3 bg-white rounded-2xl text-[#66D2A4] shadow-sm">
                      <Package size={24} />
                    </div>
                    <div>
                      <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Status</p>
                      <p className="font-bold text-[#1A1A1A] capitalize text-lg">{selectedOrder.status}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Total Amount</p>
                    <p className="font-black text-[#66D2A4] text-2xl">₹{selectedOrder.total}</p>
                  </div>
                </div>

                <div className="space-y-4">
                  <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest ml-1">Items Summary</h3>
                  <div className="space-y-3">
                    {selectedOrder.items.map((item, idx) => (
                      <div key={idx} className="flex items-center gap-4 p-4 bg-gray-50 rounded-3xl border border-gray-100">
                        <div className="w-14 h-14 rounded-2xl overflow-hidden bg-white flex items-center justify-center shadow-sm">
                          {item.image ? (
                            <img src={item.image} alt={item.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                          ) : (
                            <Package size={24} className="text-gray-200" />
                          )}
                        </div>
                        <div className="flex-grow">
                          <h4 className="text-sm font-bold text-[#1A1A1A]">{item.name}</h4>
                          <p className="text-[10px] text-gray-400 font-bold">₹{item.price} × {item.quantity}</p>
                        </div>
                        <p className="font-bold text-[#1A1A1A]">₹{item.price * item.quantity}</p>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="bg-gray-50 rounded-3xl p-6 space-y-3">
                   <div className="flex justify-between text-sm">
                     <span className="text-gray-400 font-medium">Subtotal</span>
                     <span className="font-bold text-[#1A1A1A]">₹{selectedOrder.subtotal || selectedOrder.total}</span>
                   </div>
                   {selectedOrder.delivery > 0 && (
                     <div className="flex justify-between text-sm">
                       <span className="text-gray-400 font-medium">Delivery</span>
                       <span className="font-bold text-[#1A1A1A]">₹{selectedOrder.delivery}</span>
                     </div>
                   )}
                   {selectedOrder.pointsRedeemed > 0 && (
                     <div className="flex justify-between text-sm">
                       <span className="text-gray-400 font-medium">Points Used</span>
                       <span className="font-bold text-red-500">-₹{selectedOrder.pointsRedeemed}</span>
                     </div>
                   )}
                   <div className="h-px bg-gray-200 my-2" />
                   <div className="flex justify-between items-center">
                     <span className="font-bold text-[#1A1A1A]">Grand Total</span>
                     <span className="font-black text-[#66D2A4] text-xl">₹{selectedOrder.total}</span>
                   </div>
                </div>

                <div className="pt-4">
                  <Button className="w-full py-5 rounded-3xl shadow-lg shadow-[#66D2A4]/20" onClick={() => setSelectedOrder(null)}>
                    Close Details
                  </Button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
