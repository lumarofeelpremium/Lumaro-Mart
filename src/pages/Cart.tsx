import React, { useState, useEffect } from 'react';
import { ChevronLeft, Minus, Plus, Trash2, Loader2, MapPin, X, Star, CheckCircle2, ShoppingCart, User as UserIcon } from 'lucide-react';
import { Button, Input } from '../components/ui/Base';
import { useNavigate } from 'react-router-dom';
import { CartItem, User, AppSettings } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { db } from '../firebase';
import { cn } from '../lib/utils';
import { collection, addDoc, serverTimestamp, doc, getDoc, updateDoc, increment, writeBatch } from 'firebase/firestore';
import { handleFirestoreError, OperationType } from '../lib/firestore-utils';

export const Cart = ({ 
  user,
  setUser,
  items, 
  onUpdateQuantity, 
  onRemove, 
  onClear 
}: { 
  user: User | null,
  setUser: (u: User | null) => void,
  items: CartItem[], 
  onUpdateQuantity: (id: string, q: number) => void,
  onRemove: (id: string) => void,
  onClear: () => void
}) => {
  const navigate = useNavigate();
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showAddressModal, setShowAddressModal] = useState(false);
  const [showLoginPrompt, setShowLoginPrompt] = useState(false);
  const [address, setAddress] = useState(user?.address || '');
  const [pincode, setPincode] = useState(user?.pincode || '');
  const [whatsappNumber, setWhatsappNumber] = useState('');
  const [whatsappEnabled, setWhatsappEnabled] = useState(true);
  const [useLoyaltyPoints, setUseLoyaltyPoints] = useState(false);
  
  const subtotal = items.reduce((acc, item) => acc + (item.discountPrice || item.price) * item.quantity, 0);
  const delivery = subtotal > 0 && subtotal <= 100 ? 20 : 0;
  
  const pointsAvailable = user?.loyaltyPoints || 0;
  const pointsToRedeem = useLoyaltyPoints ? Math.min(pointsAvailable, subtotal) : 0;
  
  const total = subtotal + delivery - pointsToRedeem;
  const pointsEarned = subtotal > 100 ? Math.floor(subtotal * 0.05) : 0;

  const hasOutOfStockItems = items.some(item => item.stock <= 0);
  const hasInsufficientStock = items.some(item => item.quantity > item.stock);

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const settingsDoc = await getDoc(doc(db, 'settings', 'global'));
        if (settingsDoc.exists()) {
          const data = settingsDoc.data();
          setWhatsappNumber(data.whatsappNumber);
          setWhatsappEnabled(data.whatsappEnabled ?? true);
        }
      } catch (error) {
        console.error("Error fetching settings:", error);
      }
    };
    fetchSettings();
  }, []);

  const handleConfirmOrder = async () => {
    if (!user) {
      setShowLoginPrompt(true);
      return;
    }

    if (!user.address && !address) {
      setShowAddressModal(true);
      return;
    }

    if (items.length === 0) return;

    setIsProcessing(true);
    
    try {
      setError(null);
      // Update user address if provided in modal
      if (address && !user.address) {
        await updateDoc(doc(db, 'users', user.uid), {
          address,
          pincode
        });
        setUser({ ...user, address, pincode });
      }

      const orderRef = await addDoc(collection(db, 'orders'), {
        userId: user.uid,
        userName: user.displayName,
        userPhone: user.phoneNumber || '',
        items: items.map(item => ({
          id: item.id,
          name: item.name,
          price: item.discountPrice || item.price,
          quantity: item.quantity
          // Removed large base64 image to prevent exceeding 1MB limit
        })),
        total,
        subtotal,
        delivery,
        pointsRedeemed: pointsToRedeem,
        pointsEarned,
        status: 'pending',
        createdAt: serverTimestamp()
      });

      // Update user loyalty points - Only subtract redeemed points
      // pointsEarned will be added when order is DELIVERED
      if (pointsToRedeem > 0) {
        const newPoints = (user.loyaltyPoints || 0) - pointsToRedeem;
        await updateDoc(doc(db, 'users', user.uid), {
          loyaltyPoints: newPoints
        });
        setUser({ ...user, loyaltyPoints: newPoints });
      }

      // Update Product Stock and Sales Count
      const batch = writeBatch(db);
      items.forEach(item => {
        const productRef = doc(db, 'products', item.id);
        batch.update(productRef, {
          stock: increment(-item.quantity),
          salesCount: increment(item.quantity)
        });
      });
      await batch.commit();

      // Send Telegram Notification (Background)
      const fetchTelegramSettings = async () => {
        const sDoc = await getDoc(doc(db, 'settings', 'global'));
        if (sDoc.exists()) {
          const sData = sDoc.data();
          if (sData.telegramEnabled && sData.telegramBotToken && sData.telegramChatId) {
            const tgMessage = `🚀 *NEW ORDER RECEIVED*\n\n` +
              `📦 *Order ID:* #${orderRef.id.slice(-6)}\n` +
              `👤 *Customer:* ${user.displayName}\n` +
              `💰 *Total:* ₹${total}\n` +
              `📍 *Pincode:* ${pincode || user.pincode || 'N/A'}\n` +
              `📞 *Phone:* ${user.phoneNumber || 'N/A'}\n\n` +
              `🛒 *Items:* ${items.length}\n` +
              `Check Admin Dashboard for details.`;
            
            try {
              await fetch(`https://api.telegram.org/bot${sData.telegramBotToken}/sendMessage`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  chat_id: sData.telegramChatId,
                  text: tgMessage,
                  parse_mode: 'Markdown'
                })
              });
            } catch (err) {
              console.error("Telegram notification failed:", err);
            }
          }
        }
      };
      fetchTelegramSettings();

      // 1. Prepare data for confirmation page
      const confirmationState = { 
        orderId: orderRef.id,
        userName: user.displayName,
        userPhone: user.phoneNumber || '',
        userEmail: user.email,
        items: [...items], // Clone items to ensure they persist in state
        total,
        subtotal,
        delivery,
        pointsRedeemed: pointsToRedeem,
        whatsappData: {
          enabled: whatsappEnabled,
          number: whatsappNumber
        },
        address: address || user.address,
        pincode: pincode || user.pincode
      };

      // 2. Navigate FIRST to ensure user sees the success page
      navigate('/order-confirmation', { 
        state: confirmationState,
        replace: true 
      });

      // 3. Clear cart with a slight delay to let navigation initiate
      setTimeout(() => {
        onClear();
      }, 100);

    } catch (error: any) {
      handleFirestoreError(error, OperationType.CREATE, 'orders');
      setError(error.message || 'Failed to place order. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F8FBF9] pb-32">
      {/* Header */}
      <div className="bg-white px-6 py-6 flex justify-between items-center border-b border-gray-100">
        <button 
          onClick={() => navigate(-1)}
          className="w-10 h-10 bg-[#F0F7F4] rounded-xl flex items-center justify-center text-gray-600"
        >
          <ChevronLeft size={20} />
        </button>
        <h1 className="text-lg font-bold text-[#1A1A1A]">Cart</h1>
        <button 
          onClick={onClear}
          className="text-red-500 text-sm font-semibold"
        >
          Clear
        </button>
      </div>

      {error && (
        <div className="mx-6 mt-4 p-4 bg-red-50 text-red-600 rounded-2xl text-sm font-medium border border-red-100 flex items-center gap-3">
          <div className="w-1.5 h-1.5 bg-red-600 rounded-full animate-pulse flex-shrink-0" />
          <p>{error.includes('{') ? 'Payment/Order verification failed. Please check your connection.' : error}</p>
        </div>
      )}

      <div className="px-6 pt-6 space-y-4">
        <AnimatePresence mode="popLayout">
          {items.length === 0 ? (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-center py-20"
            >
              <div className="w-24 h-24 bg-white rounded-full flex items-center justify-center mx-auto mb-4 shadow-sm">
                <Trash2 size={40} className="text-gray-300" />
              </div>
              <h2 className="text-xl font-bold text-gray-400">Your cart is empty</h2>
              <Button 
                variant="ghost" 
                className="mt-4 text-[#66D2A4]"
                onClick={() => navigate('/')}
              >
                Go Shopping
              </Button>
            </motion.div>
          ) : (
            items.map((item) => (
              <motion.div 
                key={item.id}
                layout
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className="bg-white rounded-3xl p-4 flex items-center gap-4 shadow-sm border border-gray-50"
              >
                <div className="w-20 h-20 rounded-2xl overflow-hidden bg-gray-100 flex-shrink-0 flex items-center justify-center">
                  {item.image ? (
                    <img 
                      src={item.image} 
                      alt={item.name} 
                      className="w-full h-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <ShoppingCart size={24} className="text-gray-300" />
                  )}
                </div>
                <div className="flex-grow">
                  <h3 className="font-bold text-[#1A1A1A]">{item.name}</h3>
                  <div className="flex items-center gap-2">
                    <p className="text-[#66D2A4] font-bold">₹{item.discountPrice || item.price}</p>
                    {item.discountPrice && (
                      <p className="text-[10px] text-gray-400 line-through">₹{item.price}</p>
                    )}
                  </div>
                  {item.stock <= 0 ? (
                    <p className="text-[10px] text-red-500 font-bold">Out of Stock</p>
                  ) : item.quantity > item.stock ? (
                    <p className="text-[10px] text-orange-500 font-bold">Only {item.stock} left</p>
                  ) : null}
                </div>
                <div className={cn(
                  "flex items-center gap-3 bg-[#F0F7F4] rounded-xl p-1",
                  item.stock <= 0 && "opacity-50 pointer-events-none"
                )}>
                  <button 
                    onClick={() => onUpdateQuantity(item.id, item.quantity - 1)}
                    disabled={item.stock <= 0}
                    className="w-8 h-8 flex items-center justify-center text-gray-500 hover:text-[#66D2A4]"
                  >
                    <Minus size={16} />
                  </button>
                  <span className="font-bold w-4 text-center">{item.quantity}</span>
                  <button 
                    onClick={() => onUpdateQuantity(item.id, item.quantity + 1)}
                    disabled={item.stock <= 0 || item.quantity >= item.stock}
                    className={cn(
                      "w-8 h-8 flex items-center justify-center text-gray-500",
                      item.quantity >= item.stock ? "opacity-30 cursor-not-allowed" : "hover:text-[#66D2A4]"
                    )}
                  >
                    <Plus size={16} />
                  </button>
                </div>
              </motion.div>
            ))
          )}
        </AnimatePresence>

        {items.length > 0 && (
          <div className="space-y-4 mt-8">
            {/* Loyalty Points Redemption */}
            {pointsAvailable > 0 && (
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className={cn(
                  "p-4 rounded-3xl border transition-all duration-300",
                  useLoyaltyPoints 
                    ? "bg-[#66D2A4] border-[#66D2A4] text-white shadow-lg shadow-[#66D2A4]/20" 
                    : "bg-white border-gray-100 text-gray-600"
                )}
                onClick={() => setUseLoyaltyPoints(!useLoyaltyPoints)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      "p-2 rounded-xl",
                      useLoyaltyPoints ? "bg-white/20" : "bg-[#F0F7F4] text-[#66D2A4]"
                    )}>
                      <Star size={20} fill={useLoyaltyPoints ? "currentColor" : "none"} />
                    </div>
                    <div>
                      <p className="text-xs font-bold uppercase tracking-wider opacity-80">Redeem Points</p>
                      <p className="text-sm font-bold">You have {pointsAvailable} points</p>
                    </div>
                  </div>
                  {useLoyaltyPoints ? (
                    <CheckCircle2 size={24} />
                  ) : (
                    <div className="w-6 h-6 rounded-full border-2 border-gray-200" />
                  )}
                </div>
                {useLoyaltyPoints && (
                  <motion.p 
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    className="text-[10px] mt-2 font-medium opacity-90"
                  >
                    ₹{pointsToRedeem} discount applied to your order!
                  </motion.p>
                )}
              </motion.div>
            )}

            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white rounded-[40px] p-8 shadow-sm border border-gray-50"
            >
              <div className="space-y-4 mb-8">
                <div className="flex justify-between text-gray-500">
                  <span>Subtotal</span>
                  <span className="font-bold text-[#1A1A1A]">₹{subtotal}</span>
                </div>
                <div className="flex justify-between text-gray-500">
                  <span>Delivery</span>
                  <span className={cn("font-bold", delivery === 0 ? "text-[#66D2A4]" : "text-[#1A1A1A]")}>
                    {delivery === 0 ? 'FREE' : `₹${delivery}`}
                  </span>
                </div>
                {useLoyaltyPoints && (
                  <div className="flex justify-between text-[#66D2A4]">
                    <span>Points Discount</span>
                    <span className="font-bold">-₹{pointsToRedeem}</span>
                  </div>
                )}
                {subtotal <= 100 && subtotal > 0 && (
                  <p className="text-[10px] text-orange-500 font-medium text-right -mt-2">
                    Add ₹{101 - subtotal} more for FREE delivery
                  </p>
                )}
                <div className="h-px bg-dashed border-t border-dashed border-gray-200" />
                <div className="flex justify-between items-center">
                  <span className="text-lg font-bold text-[#1A1A1A]">Total</span>
                  <span className="text-2xl font-bold text-[#66D2A4]">₹{total}</span>
                </div>
                {pointsEarned > 0 && (
                  <div className="flex items-center gap-2 text-[10px] font-bold text-[#66D2A4] bg-[#F0F7F4] p-2 rounded-xl justify-center">
                    <Star size={12} fill="currentColor" />
                    YOU WILL EARN {pointsEarned} LOYALTY POINTS!
                  </div>
                )}
              </div>
              <Button 
                className={cn(
                  "w-full py-5 text-lg rounded-3xl shadow-lg flex items-center justify-center gap-2 transition-all",
                  (isProcessing || hasOutOfStockItems || hasInsufficientStock)
                    ? "bg-gray-300 shadow-none cursor-not-allowed"
                    : "shadow-[#66D2A4]/20"
                )}
                onClick={handleConfirmOrder}
                disabled={isProcessing || hasOutOfStockItems || hasInsufficientStock}
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="animate-spin" size={20} /> Processing...
                  </>
                ) : hasOutOfStockItems ? (
                  'Items Out of Stock'
                ) : hasInsufficientStock ? (
                  'Insufficient Stock'
                ) : (
                  'Confirm Order'
                )}
              </Button>
            </motion.div>
          </div>
        )}
      </div>

      <AnimatePresence>
        {showLoginPrompt && (
          <div className="fixed inset-0 z-[110] flex items-end justify-center bg-black/60 backdrop-blur-sm p-4">
            <motion.div 
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              className="bg-white w-full max-w-md rounded-[40px] p-8 shadow-2xl mb-2 sm:mb-0 text-center"
            >
              <div className="w-20 h-20 bg-[#F0F7F4] rounded-full flex items-center justify-center mx-auto mb-6 text-[#66D2A4]">
                <UserIcon size={40} />
              </div>
              <h2 className="text-2xl font-bold text-[#1A1A1A] mb-2">Login Required</h2>
              <p className="text-gray-500 mb-8">Please login or sign up to place your order and earn loyalty points.</p>
              
              <div className="space-y-3">
                <Button 
                  className="w-full py-4 rounded-2xl text-lg shadow-lg shadow-[#66D2A4]/20"
                  onClick={() => navigate('/login', { state: { from: '/cart' } })}
                >
                  Login / Sign Up
                </Button>
                <button 
                  onClick={() => setShowLoginPrompt(false)}
                  className="w-full py-3 text-gray-400 font-bold text-sm"
                >
                  Cancel
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {showAddressModal && (
          <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/60 backdrop-blur-sm p-4">
            <motion.div 
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              className="bg-white w-full max-w-md rounded-[40px] p-8 shadow-2xl mb-2 sm:mb-0"
            >
              <div className="flex justify-between items-center mb-6">
                <div className="flex items-center gap-2 text-[#66D2A4]">
                  <MapPin size={24} />
                  <h2 className="text-xl font-bold text-[#1A1A1A]">Delivery Address</h2>
                </div>
                <button onClick={() => setShowAddressModal(false)} className="text-gray-400">
                  <X size={24} />
                </button>
              </div>

              <div className="space-y-4 mb-8">
                <div>
                  <label className="text-[10px] font-bold text-gray-400 uppercase mb-1 block">Full Address</label>
                  <textarea 
                    className="w-full bg-gray-50 border-none rounded-2xl p-4 text-sm focus:ring-2 focus:ring-[#66D2A4] outline-none"
                    placeholder="House No, Street, Area..."
                    rows={3}
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-gray-400 uppercase mb-1 block">Pincode</label>
                  <Input 
                    placeholder="6-digit pincode"
                    value={pincode}
                    onChange={(e) => setPincode(e.target.value)}
                    className="bg-gray-50 border-none"
                  />
                </div>
              </div>

              <Button 
                className="w-full py-4 rounded-2xl"
                onClick={() => {
                  if (address && pincode) {
                    setShowAddressModal(false);
                    handleConfirmOrder();
                  } else {
                    alert('Please fill in all address details');
                  }
                }}
              >
                Save & Confirm Order
              </Button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
