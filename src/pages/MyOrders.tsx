import React, { useState, useEffect, useRef } from 'react';
import { ChevronLeft, Package, Clock, X, Star, MapPin, Loader2, Download, Send, Printer, XCircle, AlertTriangle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { db } from '../firebase';
import { collection, query, where, orderBy, onSnapshot, doc, updateDoc, writeBatch, getDoc, limit, serverTimestamp, increment } from 'firebase/firestore';
import { motion, AnimatePresence } from 'motion/react';
import { User, Order, AppSettings } from '../types';
import { handleFirestoreError, OperationType } from '../lib/firestore-utils';
import { Button } from '../components/ui/Base';
import { cacheUtils } from '../lib/cache-utils';
import { cn } from '../lib/utils';
import { downloadReceiptPdf, sendWhatsAppBill, calculateEarnedPoints } from '../lib/receipt-utils';
import { PrintableOrderReceipt } from '../components/PrintableOrderReceipt';
import { ReceiptPreviewModal } from '../components/ReceiptPreviewModal';
import { OrderStatusTracker } from '../components/OrderStatusTracker';
import { sendTelegramOrderCancelAlert } from '../lib/telegram-utils';

export const MyOrders = ({ user }: { user: User | null }) => {
  const navigate = useNavigate();
  const [orders, setOrders] = useState<Order[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [isMarkingAll, setIsMarkingAll] = useState(false);
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);
  const [previewOrder, setPreviewOrder] = useState<Order | null>(null);
  const [orderToCancel, setOrderToCancel] = useState<Order | null>(null);
  const [isCanceling, setIsCanceling] = useState(false);
  const [currentTime, setCurrentTime] = useState<number>(Date.now());
  const [storeSettings, setStoreSettings] = useState<AppSettings | undefined>(undefined);
  const printReceiptRef = useRef<HTMLDivElement>(null);

  const unreadCount = orders.filter(o => !o.viewed).length;

  // Real-time 1-second ticker for order cancellation 1-minute countdown
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(Date.now());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const getOrderCreatedAtMs = (order: Order): number => {
    if (!order.createdAt) return Date.now();
    if (typeof (order.createdAt as any).toMillis === 'function') {
      return (order.createdAt as any).toMillis();
    }
    if (typeof (order.createdAt as any).toDate === 'function') {
      return (order.createdAt as any).toDate().getTime();
    }
    if ((order.createdAt as any).seconds) {
      return (order.createdAt as any).seconds * 1000;
    }
    return Date.now();
  };

  const getCancelRemainingSeconds = (order: Order): number => {
    if (order.status !== 'pending') return 0;
    const createdMs = getOrderCreatedAtMs(order);
    const elapsedMs = currentTime - createdMs;
    const remainingMs = 60 * 1000 - elapsedMs;
    return Math.max(0, Math.ceil(remainingMs / 1000));
  };

  const handleConfirmCancelOrder = async () => {
    if (!orderToCancel || !user) return;

    const remaining = getCancelRemainingSeconds(orderToCancel);
    if (remaining <= 0) {
      alert("Order cancellation ka 1 minute ka time limit expire ho chuka hai. Ab yeh order cancel karne ke liye store se contact karein.");
      setOrderToCancel(null);
      return;
    }

    setIsCanceling(true);
    try {
      const batch = writeBatch(db);
      const orderRef = doc(db, 'orders', orderToCancel.id);

      // 1. Mark order as canceled in Firestore
      batch.update(orderRef, {
        status: 'canceled',
        canceledAt: serverTimestamp(),
        canceledBy: 'user',
        cancelReason: 'Customer canceled order within 1 minute limit'
      });

      // 2. Restore item stocks & sales count
      if (Array.isArray(orderToCancel.items)) {
        orderToCancel.items.forEach(item => {
          const originalId = item.productId || item.id.split('_')[0];
          const productRef = doc(db, 'products', originalId);
          batch.update(productRef, {
            stock: increment(item.quantity),
            salesCount: increment(-item.quantity)
          });
        });
      }

      // 3. Refund redeemed loyalty points
      if (orderToCancel.pointsRedeemed && orderToCancel.pointsRedeemed > 0) {
        const userRef = doc(db, 'users', user.uid);
        batch.update(userRef, {
          loyaltyPoints: increment(orderToCancel.pointsRedeemed)
        });
      }

      await batch.commit();

      // Send Telegram Order Canceled Alert with Customer Address & Items
      sendTelegramOrderCancelAlert({
        order: {
          ...orderToCancel,
          status: 'canceled',
          address: orderToCancel.address || user.address || '',
          pincode: orderToCancel.pincode || user.pincode || ''
        },
        customer: user,
        canceledBy: 'user',
        reason: 'Customer canceled order within 1 minute time limit',
        storeSettings
      }).catch(tgErr => console.warn('Telegram cancel alert failed:', tgErr));

      // Live update state
      setOrders(prev => prev.map(o => o.id === orderToCancel.id ? { ...o, status: 'canceled' } : o));
      if (selectedOrder?.id === orderToCancel.id) {
        setSelectedOrder(prev => prev ? { ...prev, status: 'canceled' } : null);
      }

      setOrderToCancel(null);
    } catch (err: any) {
      console.error("Error canceling order:", err);
      alert(err?.message || "Order cancel karne me problem aayi. Kripya shop helpline se contact karein.");
    } finally {
      setIsCanceling(false);
    }
  };

  useEffect(() => {
    // Check cached settings for instant render
    const cachedSettings = cacheUtils.getItem('app_settings_global');
    if (cachedSettings) {
      try {
        setStoreSettings(JSON.parse(cachedSettings) as AppSettings);
      } catch (e) {
        // silent parse error
      }
    }

    // Fetch store settings for helpline / receipt info
    const fetchSettings = async () => {
      try {
        const sDoc = await getDoc(doc(db, 'settings', 'global'));
        if (sDoc.exists()) {
          const data = sDoc.data() as AppSettings;
          setStoreSettings(data);
          cacheUtils.setItem('app_settings_global', data);
        }
      } catch (err: any) {
        const isOffline = err?.code === 'unavailable' || 
          (err?.message && err.message.toLowerCase().includes('offline'));
        if (!isOffline) {
          console.warn('Could not refresh settings in MyOrders:', err?.message || err);
        }
      }
    };
    fetchSettings();
  }, []);

  const handleDownloadPdf = async (order: Order) => {
    if (!printReceiptRef.current) return;
    setIsDownloadingPdf(true);
    try {
      const orderCode = order?.id ? order.id.slice(-8).toUpperCase() : 'ORDER';
      await downloadReceiptPdf(printReceiptRef.current, `Bill-${orderCode}.pdf`);
    } catch (err) {
      console.error('PDF error in MyOrders:', err);
    } finally {
      setIsDownloadingPdf(false);
    }
  };

  const handleSendWhatsApp = (order: Order) => {
    sendWhatsAppBill(order, user, storeSettings);
  };

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
      where('userId', '==', user.uid),
      limit(100)
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
  }, [user?.uid, navigate]);

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
          orders.map((order) => {
            const cancelRemaining = getCancelRemainingSeconds(order);
            const canCancel = order.status === 'pending' && cancelRemaining > 0;

            return (
              <motion.div
                key={order.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="w-full text-left p-5 bg-white rounded-[32px] border border-gray-100 shadow-sm hover:border-[#66D2A4] transition-all relative overflow-hidden group"
              >
                {!order.viewed && (
                  <div className="absolute top-0 right-0 w-12 h-12 overflow-hidden pointer-events-none">
                    <div className="absolute top-2 right-2 w-3 h-3 bg-[#66D2A4] rounded-full border-2 border-white shadow-sm" />
                  </div>
                )}
                
                <div 
                  className="cursor-pointer"
                  onClick={() => handleOpenOrder(order)}
                >
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">
                        Order #{order?.id ? order.id.slice(-6) : 'ORDER'}
                      </p>
                      <p className="text-lg font-black text-[#1A1A1A]">₹{order.total}</p>
                    </div>
                    <span className={`px-3 py-1 rounded-xl text-[10px] font-bold uppercase tracking-wider ${
                      order.status === 'pending' ? "bg-orange-50 text-orange-500" :
                      order.status === 'confirmed' ? "bg-blue-50 text-blue-500" :
                      order.status === 'packed' ? "bg-purple-50 text-purple-600" :
                      order.status === 'out_for_delivery' ? "bg-amber-50 text-amber-600" :
                      order.status === 'canceled' ? "bg-red-50 text-red-500" :
                      "bg-green-50 text-green-500"
                    }`}>
                      {order.status === 'out_for_delivery' ? 'Out for Delivery' : order.status === 'packed' ? 'Order Packed' : order.status}
                    </span>
                  </div>

                  {/* Real-time Status Progress Bar */}
                  <div className="mb-4">
                    <OrderStatusTracker status={order.status} compact />
                  </div>
                </div>

                <div className="flex items-center justify-between pt-3 border-t border-gray-50 flex-wrap gap-2">
                  <div className="flex items-center gap-2 text-[10px] text-gray-400 font-bold uppercase tracking-widest">
                    <Clock size={12} />
                    {order.createdAt?.toDate ? order.createdAt.toDate().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Just now'}
                    <span className="text-[10px] font-bold text-[#66D2A4] bg-[#F0F7F4] px-2 py-0.5 rounded-lg ml-1">
                      {order.items.length} {order.items.length === 1 ? 'Item' : 'Items'}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    {/* 1-Minute Cancel Button */}
                    {canCancel && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setOrderToCancel(order);
                        }}
                        className="px-2.5 py-1.5 bg-red-50 hover:bg-red-100 text-red-600 rounded-xl text-[11px] font-bold border border-red-200 shadow-2xs flex items-center gap-1 active:scale-95 transition-all cursor-pointer animate-pulse"
                        title="Cancel this order (Available for 1 minute only)"
                      >
                        <XCircle size={13} className="text-red-500" />
                        <span>Cancel ({cancelRemaining}s)</span>
                      </button>
                    )}

                    {/* Print Receipt Button */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setPreviewOrder(order);
                      }}
                      className="px-2.5 py-1.5 bg-gray-50 hover:bg-gray-100 text-gray-700 rounded-xl text-[11px] font-bold border border-gray-200 shadow-2xs flex items-center gap-1 active:scale-95 transition-all cursor-pointer"
                      title="Print Receipt (Bluetooth & System Print)"
                    >
                      <Printer size={13} className="text-gray-600" />
                      <span>Receipt</span>
                    </button>
                  </div>
                </div>
              </motion.div>
            );
          })
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
              <div className="flex justify-between items-center mb-6">
                <div>
                  <h2 className="text-2xl font-bold text-[#1A1A1A]">Order Details</h2>
                  <p className="text-xs text-gray-400 font-medium">#{selectedOrder.id}</p>
                </div>
                <button onClick={() => setSelectedOrder(null)} className="p-2 bg-gray-100 rounded-full text-gray-500 hover:bg-gray-200 cursor-pointer">
                  <X size={20} />
                </button>
              </div>

              <div className="space-y-6">
                {/* Hidden printable receipt for PDF export */}
                <div style={{ position: 'fixed', left: '-9999px', top: '-9999px', width: '210mm', opacity: 0, pointerEvents: 'none' }}>
                  <PrintableOrderReceipt 
                    ref={printReceiptRef} 
                    order={selectedOrder} 
                    customer={user} 
                    storeSettings={storeSettings} 
                  />
                </div>

                <div className="flex items-center justify-between p-5 bg-[#F0F7F4] rounded-[32px]">
                  <div className="flex items-center gap-3">
                    <div className="p-3 bg-white rounded-2xl text-[#66D2A4] shadow-sm">
                      <Package size={24} />
                    </div>
                    <div>
                      <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Status</p>
                      <p className={cn(
                        "font-bold capitalize text-lg",
                        selectedOrder.status === 'canceled' ? "text-red-500" :
                        selectedOrder.status === 'pending' ? "text-orange-500" :
                        selectedOrder.status === 'confirmed' ? "text-blue-500" :
                        selectedOrder.status === 'packed' ? "text-purple-600" :
                        selectedOrder.status === 'out_for_delivery' ? "text-amber-600" :
                        "text-[#66D2A4]"
                      )}>
                        {selectedOrder.status === 'out_for_delivery' ? 'Out for Delivery' : selectedOrder.status === 'packed' ? 'Order Packed' : selectedOrder.status}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Total Amount</p>
                    <p className="font-black text-[#66D2A4] text-2xl">₹{selectedOrder.total}</p>
                  </div>
                </div>

                {/* Real-time Order Tracking Timeline */}
                <OrderStatusTracker status={selectedOrder.status} />

                {/* 1-Minute Cancel Alert & Button */}
                {selectedOrder.status === 'pending' && (() => {
                  const rem = getCancelRemainingSeconds(selectedOrder);
                  if (rem > 0) {
                    return (
                      <div className="p-4 bg-red-50 border border-red-200 rounded-3xl flex items-center justify-between gap-3 animate-in fade-in duration-200">
                        <div className="flex items-center gap-2.5">
                          <div className="p-2 bg-red-100 rounded-xl text-red-600 shrink-0">
                            <AlertTriangle size={18} />
                          </div>
                          <div>
                            <p className="text-xs font-bold text-red-950">Galti se order ho gaya?</p>
                            <p className="text-[11px] text-red-700 mt-0.5">
                              Aap agle <strong className="text-red-900">{rem}s</strong> ke andar cancel kar sakte hain.
                            </p>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => setOrderToCancel(selectedOrder)}
                          className="px-3.5 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold shrink-0 shadow-sm shadow-red-600/20 active:scale-95 transition-all cursor-pointer"
                        >
                          Cancel ({rem}s)
                        </button>
                      </div>
                    );
                  } else {
                    return (
                      <div className="p-3 bg-gray-50 border border-gray-200/70 rounded-2xl text-[11px] text-gray-500 text-center">
                        Order cancellation window (1 min) expire ho chuka hai. Cancellation ya change ke liye store se contact karein.
                      </div>
                    );
                  }
                })()}

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

                <div className="space-y-3 pt-2">
                  <div className="grid grid-cols-3 gap-2">
                    <button 
                      onClick={() => setPreviewOrder(selectedOrder)}
                      className="py-3 px-2 rounded-2xl bg-gray-900 hover:bg-black text-white font-bold flex items-center justify-center gap-1.5 text-xs shadow-md active:scale-95 transition-all cursor-pointer"
                      title="Print via Bluetooth or System Printer"
                    >
                      <Printer size={14} />
                      <span>Print Bill</span>
                    </button>
                    <button 
                      onClick={() => handleSendWhatsApp(selectedOrder)}
                      className="py-3 px-2 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold flex items-center justify-center gap-1.5 text-xs shadow-md shadow-emerald-600/20 active:scale-95 transition-all cursor-pointer"
                    >
                      <Send size={14} />
                      <span>WhatsApp</span>
                    </button>
                    <button 
                      onClick={() => handleDownloadPdf(selectedOrder)}
                      disabled={isDownloadingPdf}
                      className="py-3 px-2 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-bold flex items-center justify-center gap-1.5 text-xs shadow-md shadow-blue-600/20 active:scale-95 transition-all cursor-pointer disabled:opacity-50"
                    >
                      {isDownloadingPdf ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
                      <span>Save PDF</span>
                    </button>
                  </div>

                  <Button className="w-full py-4 rounded-2xl shadow-lg shadow-[#66D2A4]/20" onClick={() => setSelectedOrder(null)}>
                    Close Details
                  </Button>
                </div>
              </div>

            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Receipt Preview & Bluetooth / System Print Modal */}
      {previewOrder && (
        <ReceiptPreviewModal
          order={previewOrder}
          customer={user}
          storeSettings={storeSettings}
          onClose={() => setPreviewOrder(null)}
        />
      )}

      {/* 1-Minute Order Cancellation Confirmation Modal */}
      <AnimatePresence>
        {orderToCancel && (
          <div className="fixed inset-0 z-[220] flex items-center justify-center p-4 bg-black/65 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl p-6 max-w-sm w-full space-y-4 shadow-2xl border border-gray-100"
            >
              <div className="w-12 h-12 rounded-2xl bg-red-50 text-red-600 flex items-center justify-center mx-auto">
                <AlertTriangle size={24} />
              </div>
              <div className="text-center space-y-1">
                <h3 className="text-lg font-black text-gray-900">Cancel Order?</h3>
                <p className="text-xs text-gray-500 leading-relaxed">
                  Kya aap Order <strong>#{orderToCancel?.id ? orderToCancel.id.slice(-6) : 'ORDER'}</strong> sach me cancel karna chahte hain? Stock aur loyalty points automatically restore ho jayenge.
                </p>
                {getCancelRemainingSeconds(orderToCancel) > 0 && (
                  <p className="text-[11px] font-bold text-red-600 mt-2">
                    ⏱️ Remaining time: {getCancelRemainingSeconds(orderToCancel)}s
                  </p>
                )}
              </div>
              <div className="flex gap-2 pt-2">
                <Button
                  variant="secondary"
                  className="flex-1 py-3 rounded-xl text-xs font-bold cursor-pointer"
                  onClick={() => setOrderToCancel(null)}
                  disabled={isCanceling}
                >
                  Nahi, Rakhein
                </Button>
                <button
                  type="button"
                  onClick={handleConfirmCancelOrder}
                  disabled={isCanceling || getCancelRemainingSeconds(orderToCancel) <= 0}
                  className="flex-1 py-3 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 shadow-md shadow-red-600/20 active:scale-95 transition-all disabled:opacity-50 cursor-pointer"
                >
                  {isCanceling ? <Loader2 size={15} className="animate-spin" /> : <XCircle size={15} />}
                  <span>Haan, Cancel Karein</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
