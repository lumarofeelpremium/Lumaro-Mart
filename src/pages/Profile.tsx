import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  ChevronLeft, User as UserIcon, Settings, LogOut, ShieldCheck, Package, Users, 
  ChevronRight, Clock, MapPin, X, Camera, Mail, Phone, Home, Hash, Loader2, 
  Star, Heart, Bell, MessageCircle, Headset, LifeBuoy, Gift, Copy, Check, 
  Crown, Send, Instagram, Globe, Sparkles, Zap, ShoppingBag, Plus, ArrowRight, Truck 
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button, Input } from '../components/ui/Base';
import { User, Order, AppSettings, Product, ProductVariant } from '../types';
import { db } from '../firebase';
import { collection, query, where, orderBy, onSnapshot, doc, updateDoc, setDoc, getDoc, limit } from 'firebase/firestore';
import { motion, AnimatePresence } from 'motion/react';
import { handleFirestoreError, OperationType } from '../lib/firestore-utils';
import { compressImage } from '../lib/utils';
import { cacheUtils } from '../lib/cache-utils';
import { SubscriptionModal } from '../components/SubscriptionModal';
import { isSubscriptionActive, getSubscriptionSummary } from '../lib/subscription-utils';

export const Profile = ({ 
  user, 
  setUser, 
  onLogout,
  allProducts = [],
  onAddToCart,
  onBatchAddToCart
}: { 
  user: User | null; 
  setUser: (u: User | null) => void; 
  onLogout: () => void;
  allProducts?: Product[];
  onAddToCart?: (p: Product, quantity?: number, variant?: ProductVariant) => void;
  onBatchAddToCart?: (items: { product: Product; quantity?: number; variant?: ProductVariant }[]) => void;
}) => {
  const navigate = useNavigate();
  const [orders, setOrders] = useState<Order[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [unreadNotifCount, setUnreadNotifCount] = useState(0);
  const [showEditProfile, setShowEditProfile] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [appSettings, setAppSettings] = useState<AppSettings | null>(null);
  const [showSubscriptionModal, setShowSubscriptionModal] = useState(false);
  const [copied, setCopied] = useState(false);
  const [reorderSuccessToast, setReorderSuccessToast] = useState(false);
  const [addedItemMap, setAddedItemMap] = useState<Record<string, boolean>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isVipActive = isSubscriptionActive(user);

  // Aggregate daily essential items from user's past orders or popular grocery essentials
  const dailyEssentialItems = useMemo(() => {
    const itemCountMap: Record<string, { product: Product; count: number; lastVariant?: any }> = {};

    orders.forEach(order => {
      if (order.items && Array.isArray(order.items)) {
        order.items.forEach(item => {
          const key = item.productId || item.id;
          if (!key) return;
          if (!itemCountMap[key]) {
            itemCountMap[key] = {
              product: item,
              count: item.quantity || 1,
              lastVariant: item.selectedVariant
            };
          } else {
            itemCountMap[key].count += item.quantity || 1;
          }
        });
      }
    });

    const pastItems = Object.values(itemCountMap)
      .sort((a, b) => b.count - a.count)
      .map(entry => ({
        ...entry.product,
        orderCount: entry.count,
        selectedVariant: entry.lastVariant
      }));

    if (pastItems.length >= 3) {
      return pastItems.slice(0, 8);
    }

    // Complement with daily grocery essentials from store
    const essentialKeywords = ['milk', 'bread', 'doodh', 'chai', 'tea', 'sugar', 'atta', 'oil', 'butter', 'ghee', 'paneer', 'egg', 'potato', 'onion', 'tomato', 'biscuit', 'salt', 'rice', 'dal'];
    const storeEssentials = (allProducts || []).filter(p => {
      const name = (p.name || '').toLowerCase();
      const cat = (p.category || '').toLowerCase();
      return essentialKeywords.some(kw => name.includes(kw) || cat.includes(kw)) || p.isPopular;
    });

    const existingIds = new Set(pastItems.map(p => p.id));
    const merged = [...pastItems];
    for (const p of storeEssentials) {
      if (!existingIds.has(p.id)) {
        merged.push({
          ...p,
          orderCount: 1
        } as any);
        existingIds.add(p.id);
      }
      if (merged.length >= 8) break;
    }

    return merged.length > 0 ? merged : (allProducts || []).slice(0, 6);
  }, [orders, allProducts]);

  const handleOneClickReorderAll = () => {
    if (!dailyEssentialItems || dailyEssentialItems.length === 0) return;
    const itemsToAdd = dailyEssentialItems.map(p => ({
      product: p,
      quantity: 1,
      variant: (p as any).selectedVariant
    }));

    if (onBatchAddToCart) {
      onBatchAddToCart(itemsToAdd);
    } else if (onAddToCart) {
      itemsToAdd.forEach(item => onAddToCart(item.product, item.quantity, item.variant));
    }

    setReorderSuccessToast(true);
    setTimeout(() => {
      setReorderSuccessToast(false);
      navigate('/cart');
    }, 1000);
  };

  const handleReorderSingleItem = (product: Product, variant?: ProductVariant) => {
    if (onAddToCart) {
      onAddToCart(product, 1, variant);
      setAddedItemMap(prev => ({ ...prev, [product.id]: true }));
      setTimeout(() => {
        setAddedItemMap(prev => ({ ...prev, [product.id]: false }));
      }, 1500);
    }
  };

  // Auto-generate & save a user's referral code if missing (for legacy or existing users)
  useEffect(() => {
    if (user && user.uid && !user.referralCode) {
      const generateRandomCode = () => {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        let result = '';
        for (let i = 0; i < 6; i++) {
          result += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return `LUM${result}`;
      };
      const code = generateRandomCode();
      const updateRefCode = async () => {
        try {
          await setDoc(doc(db, 'users', user.uid), {
            referralCode: code,
            role: user.role || 'user'
          }, { merge: true });

          try {
            await setDoc(doc(db, 'referral_codes', code), {
              uid: user.uid,
              referralCode: code,
              phoneNumber: user.phoneNumber || '',
              createdAt: new Date().toISOString()
            }, { merge: true });
          } catch (rErr) {
            console.warn("Could not save to referral_codes:", rErr);
          }

          setUser({
            ...user,
            referralCode: code
          });
        } catch (e) {
          console.error("Error setting referral code for existing user:", e);
        }
      };
      updateRefCode();
    }
  }, [user, setUser]);

  const [editForm, setEditForm] = useState({
    displayName: user?.displayName || '',
    email: user?.email || '',
    phoneNumber: user?.phoneNumber || '',
    address: user?.address || '',
    pincode: user?.pincode || '',
    photoURL: user?.photoURL || ''
  });

  useEffect(() => {
    if (user) {
      setEditForm({
        displayName: user.displayName || '',
        email: user.email || '',
        phoneNumber: user.phoneNumber || '',
        address: user.address || '',
        pincode: user.pincode || '',
        photoURL: user.photoURL || ''
      });
    }
  }, [user]);

  useEffect(() => {
    if (!user) return;

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
      setUnreadCount(ordersData.filter(o => !o.viewed).length);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'orders');
    });

    return () => unsubscribe();
  }, [user?.uid]);

  useEffect(() => {
    const q = query(collection(db, 'notifications'), orderBy('createdAt', 'desc'), limit(30));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const notifs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));
      
      // Load read IDs from localStorage
      const saved = localStorage.getItem('read_notifications');
      let readIds: string[] = [];
      if (saved) {
        try {
          readIds = JSON.parse(saved);
        } catch (e) {
          console.error('Error parsing read notifications', e);
        }
      }
      
      const unread = notifs.filter(n => !readIds.includes(n.id)).length;
      setUnreadNotifCount(unread);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const cachedSettings = cacheUtils.getItem('app_settings_global');
    if (cachedSettings) {
      try {
        setAppSettings(JSON.parse(cachedSettings) as AppSettings);
      } catch (e) {
        // silent parse error
      }
    }

    const unsubscribe = onSnapshot(doc(db, 'settings', 'global'), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data() as AppSettings;
        setAppSettings(data);
        cacheUtils.setItem('app_settings_global', data);
      }
    }, (error: any) => {
      const isOffline = error?.code === 'unavailable' || 
        (error?.message && error.message.toLowerCase().includes('offline'));
      if (!isOffline) {
        console.warn("Could not listen to settings in Profile:", error?.message || error);
      }
    });

    return () => unsubscribe();
  }, []);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setIsUpdating(true);
      try {
        const reader = new FileReader();
        reader.onloadend = async () => {
          const base64 = reader.result as string;
          // Compress image to ensure it stays well under 1MB
          const compressed = await compressImage(base64, 400, 400, 0.6);
          setEditForm(prev => ({ ...prev, photoURL: compressed }));
          setIsUpdating(false);
        };
        reader.readAsDataURL(file);
      } catch (error) {
        console.error("Error processing profile image:", error);
        alert("Failed to process image.");
        setIsUpdating(false);
      }
    }
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setIsUpdating(true);
    try {
      const cleanPhone = (editForm.phoneNumber || '').replace(/\D/g, '').slice(0, 10);
      if (cleanPhone && cleanPhone.length !== 10) {
        alert('कृपया 10 अंकों का सही मोबाइल नंबर दर्ज करें (Enter valid 10-digit mobile number)');
        setIsUpdating(false);
        return;
      }

      let cleanEmail = (editForm.email || '').trim();
      // Remove broken synthetic emails that might fail rule regex
      if (cleanEmail === '@lumaro.com' || cleanEmail.startsWith('@')) {
        cleanEmail = cleanPhone ? `${cleanPhone}@lumaro.com` : '';
      }

      const updatedPayload: any = {
        displayName: editForm.displayName.trim() || user.displayName || 'Customer',
        phoneNumber: cleanPhone,
        address: (editForm.address || '').trim(),
        pincode: (editForm.pincode || '').trim(),
        photoURL: editForm.photoURL || ''
      };

      if (cleanEmail) {
        updatedPayload.email = cleanEmail;
      }

      const userRef = doc(db, 'users', user.uid);
      await setDoc(userRef, {
        ...updatedPayload,
        role: user.role || 'user'
      }, { merge: true });
      
      // Update local state in App.tsx
      setUser({
        ...user,
        ...updatedPayload
      });
      
      setShowEditProfile(false);
      alert('Profile successfully update ho gayi! 🎉');
    } catch (error: any) {
      console.error("Profile update error:", error);
      handleFirestoreError(error, OperationType.UPDATE, `users/${user.uid}`);
      alert(`Profile update nahi ho saki: ${error?.message || 'Permission denied'}`);
    } finally {
      setIsUpdating(false);
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-[#F8FBF9] flex flex-col items-center justify-center px-8 text-center">
        <div className="w-24 h-24 bg-white rounded-full flex items-center justify-center mb-6 shadow-sm">
          <UserIcon size={40} className="text-gray-200" />
        </div>
        <h2 className="text-2xl font-bold text-[#1A1A1A] mb-2">Join Lumaro Mart</h2>
        <p className="text-gray-400 mb-8">Login to manage your orders and profile</p>
        <div className="w-full space-y-4">
          <Button className="w-full py-4 rounded-2xl" onClick={() => navigate('/login')}>Login</Button>
          <Button variant="secondary" className="w-full py-4 rounded-2xl" onClick={() => navigate('/signup')}>Sign Up</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8FBF9] pb-32">
      <div className="bg-white px-6 pt-12 pb-8 rounded-b-[40px] shadow-sm mb-6">
        <div className="flex items-center gap-4 mb-6">
          {/* Avatar Outer Wrapper (visible overflow so crown floats outside profile picture) */}
          <div className="relative shrink-0">
            {/* Inner avatar container with rounded border and clipping */}
            <div className={cn(
              "w-20 h-20 rounded-3xl flex items-center justify-center overflow-hidden transition-all",
              isVipActive 
                ? "ring-3 ring-amber-400 ring-offset-2 ring-offset-white bg-gradient-to-tr from-amber-100 to-yellow-50 shadow-lg shadow-amber-500/25" 
                : "bg-[#66D2A4]/10 text-[#66D2A4]"
            )}>
              {user.photoURL ? (
                <img src={user.photoURL} alt={user.displayName} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
              ) : (
                <UserIcon size={40} className={isVipActive ? "text-amber-700" : "text-[#66D2A4]"} />
              )}
            </div>
            
            {/* Royal Crown Badge floating clearly outside the avatar with unrestricted smooth float animation */}
            {isVipActive && (
              <div 
                className="absolute -top-3 -right-2.5 z-20 pointer-events-none"
                title="Active Royal VIP Member"
              >
                <motion.div
                  animate={{ 
                    y: [0, -4, 0],
                    rotate: [-3, 3, -3]
                  }}
                  transition={{ 
                    duration: 2.2,
                    repeat: Infinity,
                    ease: "easeInOut"
                  }}
                  className="w-8 h-8 rounded-full bg-gradient-to-tr from-amber-500 via-yellow-400 to-amber-600 flex items-center justify-center text-stone-950 shadow-xl shadow-amber-500/40 border-2 border-white ring-2 ring-amber-300 pointer-events-auto"
                >
                  <Crown size={16} className="fill-stone-950 text-stone-950 drop-shadow-xs" />
                </motion.div>
              </div>
            )}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-2xl font-bold text-[#1A1A1A] truncate">{user.displayName}</h2>
              {isVipActive && (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-gradient-to-r from-amber-400 via-yellow-300 to-amber-500 text-stone-950 rounded-full text-[10px] font-black uppercase tracking-wider shadow-xs border border-yellow-200 shrink-0">
                  <Crown size={11} className="fill-stone-950" />
                  Royal VIP
                </span>
              )}
            </div>
            <p className="text-gray-400 text-sm truncate">{user.email}</p>
            <div className="flex gap-2 mt-1 flex-wrap">
              {user.role === 'admin' && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-purple-100 text-purple-600 rounded-full text-[10px] font-bold uppercase tracking-wider">
                  <ShieldCheck size={10} /> Admin
                </span>
              )}
              {user.phoneNumber ? (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-gray-100 text-gray-500 rounded-full text-[10px] font-bold uppercase tracking-wider">
                  <Phone size={10} /> {user.phoneNumber}
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => setShowEditProfile(true)}
                  className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-amber-100 text-amber-800 rounded-full text-[10px] font-bold border border-amber-300 hover:bg-amber-200 transition-colors cursor-pointer"
                >
                  <Phone size={10} /> + Add Mobile No.
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Missing Phone Number Alert Banner */}
        {!user.phoneNumber && (
          <div className="mb-4 bg-amber-50 border border-amber-200 rounded-2xl p-3.5 flex items-center justify-between gap-3 shadow-xs">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-xl bg-amber-100 flex items-center justify-center text-amber-700 shrink-0">
                <Phone size={16} />
              </div>
              <div className="min-w-0">
                <h4 className="text-xs font-bold text-amber-900 truncate">मोबाइल नंबर जोड़ें (Required)</h4>
                <p className="text-[10px] text-amber-700 truncate">ऑर्डर डिलीवरी और सिक्योरिटी के लिए 10-अंकों का नंबर दर्ज करें।</p>
              </div>
            </div>
            <button 
              type="button"
              onClick={() => setShowEditProfile(true)}
              className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-bold shrink-0 transition-colors cursor-pointer shadow-xs"
            >
              Add Now
            </button>
          </div>
        )}

        {/* Loyalty Points Card */}
        {(() => {
          const isLoyaltyEnabled = appSettings?.loyaltyProgramEnabled ?? true;
          const spendBase = Math.max(1, appSettings?.loyaltySpendBase || 100);
          const pointsEarned = typeof appSettings?.loyaltyPointsEarned === 'number'
            ? appSettings.loyaltyPointsEarned
            : (typeof appSettings?.loyaltyPointsPerHundred === 'number' ? appSettings.loyaltyPointsPerHundred : 5);
          const pointValue = typeof appSettings?.loyaltyPointValue === 'number' && appSettings.loyaltyPointValue > 0
            ? appSettings.loyaltyPointValue
            : 1;
          const userPoints = user.loyaltyPoints || 0;
          const rawWorth = userPoints * pointValue;
          const formattedWorth = rawWorth % 1 === 0 ? rawWorth.toString() : rawWorth.toFixed(1);

          const earnText = spendBase === 100
            ? `Earn ${pointsEarned}% points on every order above ₹${spendBase}`
            : `Earn ${pointsEarned} point${pointsEarned === 1 ? '' : 's'} on every order above ₹${spendBase}`;

          return (
            <div className="bg-gradient-to-br from-[#10B981] via-[#059669] to-[#047857] rounded-[28px] p-5 sm:p-6 text-white shadow-xl shadow-emerald-900/15 relative overflow-hidden">
              {/* Subtle ambient lighting */}
              <div className="absolute -right-6 -bottom-6 w-32 h-32 bg-white/10 rounded-full blur-2xl pointer-events-none" />
              <div className="absolute right-4 -top-4 w-28 h-28 bg-emerald-300/10 rounded-full blur-xl pointer-events-none" />

              {/* Header */}
              <div className="flex justify-between items-center relative z-10 mb-4">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 bg-white/15 backdrop-blur-md rounded-xl border border-white/20 shadow-xs">
                    <Star size={18} className="fill-amber-300 text-amber-300" />
                  </div>
                  <div>
                    <span className="text-[10px] font-extrabold uppercase tracking-widest text-emerald-200/90 block">Rewards Club</span>
                    <h3 className="text-base font-black tracking-tight text-white">Loyalty Points</h3>
                  </div>
                </div>

                {/* Conversion Tag */}
                <div className="flex items-center gap-1.5 px-3 py-1 bg-black/15 backdrop-blur-md rounded-full border border-white/15 text-[11px] font-bold text-white shadow-xs">
                  <span className="text-emerald-200 font-medium">Value:</span>
                  <span className="text-amber-300 font-black">1 Pt = ₹{pointValue}</span>
                </div>
              </div>

              {/* Main Balance & Total Worth Showcase */}
              <div className="grid grid-cols-2 gap-3 relative z-10">
                {/* Available Points Block */}
                <div className="bg-white/10 backdrop-blur-md rounded-2xl p-3.5 border border-white/15 flex flex-col justify-between">
                  <p className="text-[10px] font-bold text-emerald-100 uppercase tracking-wider mb-1">Points Available</p>
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-3xl sm:text-4xl font-black text-white tracking-tight">{userPoints}</span>
                    <span className="text-xs font-bold text-emerald-200">pts</span>
                  </div>
                </div>

                {/* Total Cash Worth Block */}
                <div className="bg-white/10 backdrop-blur-md rounded-2xl p-3.5 border border-white/15 flex flex-col justify-between">
                  <p className="text-[10px] font-bold text-emerald-100 uppercase tracking-wider mb-1">Total Worth</p>
                  <div className="flex items-baseline gap-1">
                    <span className="text-3xl sm:text-4xl font-black text-amber-300 tracking-tight">₹{formattedWorth}</span>
                    <span className="text-[10px] font-bold text-emerald-200">off</span>
                  </div>
                </div>
              </div>

              {/* Dynamic Earn & Point Value strip */}
              <div className="mt-3.5 pt-3 border-t border-white/15 flex items-center justify-between text-[11px] relative z-10">
                <div className="flex items-center gap-1.5 text-emerald-50 font-medium">
                  <span className="text-amber-300 font-bold">✦</span>
                  <span>{earnText}</span>
                </div>
                <span className="text-[10px] font-semibold text-emerald-200/90 whitespace-nowrap ml-2">
                  1 Point = ₹{pointValue}
                </span>
              </div>

              {!isLoyaltyEnabled && (
                <div className="mt-2.5 text-[10px] bg-amber-500/25 text-amber-100 border border-amber-400/30 px-3 py-1.5 rounded-xl font-medium relative z-10">
                  ⚠️ Loyalty rewards program is temporarily paused
                </div>
              )}
            </div>
          );
        })()}

        {/* VIP Subscription Card - Royal Golden VIP Theme */}
        {appSettings?.subscriptionEnabled !== false && (() => {
          const subSummary = getSubscriptionSummary(user);
          const planName = appSettings?.subscriptionPlanName || 'Lumaro VIP Club';
          const fee = appSettings?.subscriptionFee || 99;
          const duration = appSettings?.subscriptionDurationDays || 30;
          const subDeliveryFee = appSettings?.subscriberDeliveryFee ?? 0;
          const maxOrders = appSettings?.subscriptionMaxOrders || 0;

          if (user?.subscriptionPendingVerification) {
            return (
              <div className="mt-4 p-5 rounded-3xl bg-gradient-to-br from-[#1c1917] via-[#292524] to-[#0c0a09] border-2 border-amber-400/60 text-white shadow-xl relative overflow-hidden">
                <div className="absolute -top-10 -right-10 w-36 h-36 bg-amber-400/20 rounded-full blur-2xl pointer-events-none" />
                <div className="flex items-center justify-between mb-3 relative z-10">
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-2xl bg-amber-500/20 border border-amber-400/40 text-amber-300 flex items-center justify-center shadow-xs">
                      <Clock size={22} className="text-amber-300 animate-pulse" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-black text-amber-200">{user.subscriptionPendingPlanName || planName}</span>
                        <span className="bg-amber-400 text-stone-950 text-[9px] font-black px-2 py-0.5 rounded-full shadow-xs">
                          ⏳ VERIFICATION PENDING
                        </span>
                      </div>
                      <p className="text-[11px] text-amber-300/80 mt-0.5 font-mono">
                        UTR: <span className="font-bold text-amber-100">{user.subscriptionPendingUtr}</span>
                      </p>
                    </div>
                  </div>
                </div>
                <div className="bg-white/10 backdrop-blur-md p-3 rounded-2xl border border-white/15 text-xs text-amber-100/90 relative z-10">
                  Aapka <strong>₹{user.subscriptionPendingFee || fee}</strong> ka VIP payment review ho raha hai. Admin verification confirm hote hi aapka Royal VIP status activate ho jayega!
                </div>
              </div>
            );
          }

          if (subSummary.isActive) {
            return (
              <div className="mt-4 rounded-[32px] p-5 sm:p-6 bg-gradient-to-br from-[#141210] via-[#1f1b16] to-[#0a0908] text-white shadow-2xl shadow-amber-950/40 relative overflow-hidden border-2 border-amber-400/60">
                {/* Ambient Royal Gold Lighting */}
                <div className="absolute -right-10 -top-10 w-48 h-48 bg-gradient-to-br from-amber-400/30 to-yellow-500/15 rounded-full blur-3xl pointer-events-none" />
                <div className="absolute -left-10 -bottom-10 w-40 h-40 bg-amber-500/15 rounded-full blur-2xl pointer-events-none" />
                
                {/* Holographic Watermark Crown in Background */}
                <div className="absolute right-2 bottom-0 opacity-5 pointer-events-none">
                  <Crown size={150} />
                </div>

                {/* Card Top Strip */}
                <div className="flex justify-between items-start relative z-10 mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-amber-500 via-yellow-400 to-amber-600 p-0.5 shadow-lg shadow-amber-500/30">
                      <div className="w-full h-full bg-[#1c1917] rounded-[14px] flex items-center justify-center">
                        <Crown size={24} className="fill-amber-300 text-amber-300 drop-shadow-md" />
                      </div>
                    </div>
                    <div>
                      <span className="text-[10px] font-extrabold uppercase tracking-widest text-amber-300/90 block">
                        ROYAL VIP PRIVILEGE PASS
                      </span>
                      <h3 className="text-base font-black tracking-tight text-white flex items-center gap-1.5">
                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-yellow-200 via-amber-300 to-yellow-100">
                          {subSummary.planName}
                        </span>
                        <Sparkles size={14} className="text-amber-300 shrink-0" />
                      </h3>
                    </div>
                  </div>

                  {/* Active VIP Status Tag */}
                  <div className="flex items-center gap-1.5 px-3 py-1 bg-amber-400 text-stone-950 rounded-full text-[10px] font-black uppercase tracking-wider shadow-sm border border-yellow-200">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-ping" />
                    <span>ACTIVE VIP</span>
                  </div>
                </div>

                {/* Cardholder info */}
                <div className="relative z-10 mb-4 bg-white/5 backdrop-blur-md p-3 rounded-2xl border border-white/10 flex items-center justify-between">
                  <div>
                    <p className="text-[9px] font-bold text-amber-200/70 uppercase tracking-widest">VIP Cardholder</p>
                    <p className="text-sm font-bold text-white tracking-wide truncate max-w-[180px]">
                      {user.displayName || 'VIP Member'}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-[9px] font-bold text-amber-200/70 uppercase tracking-widest">Member ID</p>
                    <p className="text-xs font-mono font-bold text-amber-300">
                      VIP-★{user.uid.slice(0, 6).toUpperCase()}
                    </p>
                  </div>
                </div>

                {/* Perks Matrix */}
                <div className="grid grid-cols-3 gap-2 relative z-10 mb-4">
                  {/* Delivery Perk */}
                  <div className="bg-black/40 backdrop-blur-md p-2.5 rounded-2xl border border-amber-400/20 text-center">
                    <p className="text-[9px] font-bold text-amber-200 uppercase tracking-wider">Delivery</p>
                    <p className="text-xs font-black text-white mt-1">
                      {subDeliveryFee === 0 ? 'FREE (₹0)' : `₹${subDeliveryFee}`}
                    </p>
                  </div>

                  {/* Orders Covered */}
                  <div className="bg-black/40 backdrop-blur-md p-2.5 rounded-2xl border border-amber-400/20 text-center">
                    <p className="text-[9px] font-bold text-amber-200 uppercase tracking-wider">Orders</p>
                    <p className="text-xs font-black text-amber-300 mt-1">
                      {subSummary.isUnlimitedOrders ? 'Unlimited' : `${subSummary.ordersRemaining} Left`}
                    </p>
                  </div>

                  {/* Validity */}
                  <div className="bg-black/40 backdrop-blur-md p-2.5 rounded-2xl border border-amber-400/20 text-center">
                    <p className="text-[9px] font-bold text-amber-200 uppercase tracking-wider">Valid Till</p>
                    <p className="text-xs font-black text-white mt-1 truncate">
                      {subSummary.expiryDateFormatted || `${duration} Days`}
                    </p>
                  </div>
                </div>

                {/* Bottom Strip: VIP Benefits & Extend button */}
                <div className="pt-3 border-t border-amber-400/20 flex items-center justify-between relative z-10 flex-wrap gap-2">
                  <div className="flex items-center gap-2 text-[10px] text-amber-200/90">
                    <span className="flex items-center gap-1 font-semibold">
                      <Zap size={11} className="text-amber-400" />
                      1-Click Reorder
                    </span>
                    <span>•</span>
                    <span className="flex items-center gap-1 font-semibold">
                      <Truck size={11} className="text-amber-400" />
                      Zero Surge
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => setShowSubscriptionModal(true)}
                    className="px-3.5 py-1.5 bg-gradient-to-r from-amber-400 via-yellow-400 to-amber-500 hover:from-amber-500 hover:to-yellow-500 text-stone-950 text-xs font-black rounded-xl shadow-md transition-all cursor-pointer flex items-center gap-1 active:scale-95"
                  >
                    <span>Extend Plan</span>
                    <ChevronRight size={13} />
                  </button>
                </div>
              </div>
            );
          }

          return (
            <div className="mt-4 p-5 rounded-3xl bg-gradient-to-br from-amber-50 via-yellow-50 to-orange-50 border-2 border-amber-300/80 text-amber-950 shadow-md relative overflow-hidden">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-amber-400 to-yellow-500 text-stone-950 flex items-center justify-center shadow-md">
                    <Crown size={24} className="fill-stone-950 text-stone-950" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-black text-amber-950">{planName}</span>
                      <span className="bg-amber-200 text-stone-950 text-[10px] font-black px-2 py-0.5 rounded-md border border-amber-400">
                        ₹{fee} / {duration} Days
                      </span>
                    </div>
                    <p className="text-[11px] text-amber-900 mt-0.5">
                      Enjoy {subDeliveryFee === 0 ? 'FREE Delivery (₹0)' : `₹${subDeliveryFee} Delivery`} on next {maxOrders > 0 ? `${maxOrders} orders` : 'unlimited orders'}!
                    </p>
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShowSubscriptionModal(true)}
                className="w-full mt-1 py-3 bg-gradient-to-r from-amber-500 via-yellow-500 to-amber-600 hover:from-amber-600 hover:to-yellow-600 text-stone-950 font-black text-xs rounded-2xl shadow-lg shadow-amber-500/20 flex items-center justify-center gap-2 transition-all cursor-pointer active:scale-[0.98]"
              >
                <Crown size={16} className="fill-stone-950" />
                <span>Join Royal VIP Membership • Only ₹{fee}</span>
              </button>
            </div>
          );
        })()}

        {/* ========================================================================= */}
        {/* VIP 1-CLICK "DAILY ESSENTIALS" RE-ORDER SECTION */}
        {/* ========================================================================= */}
        {isVipActive && dailyEssentialItems.length > 0 && (
          <div className="mt-4 bg-gradient-to-br from-amber-50/90 via-white to-amber-50/50 rounded-[32px] p-5 shadow-sm border border-amber-200/80 relative overflow-hidden space-y-3.5">
            {/* Header */}
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-amber-500 to-yellow-500 text-stone-950 flex items-center justify-center shadow-xs">
                  <ShoppingBag size={18} className="fill-stone-950" />
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <h3 className="text-xs font-black text-stone-950">VIP 1-Click Daily Essentials</h3>
                    <span className="px-2 py-0.5 rounded-full bg-amber-400 text-stone-950 text-[8px] font-black uppercase tracking-wider">
                      ⚡ 1-CLICK REORDER
                    </span>
                  </div>
                  <p className="text-[10px] text-stone-600 mt-0.5">
                    Aapke rozana ke grocery saaman — bina search kiye 1-Click me cart me daalein!
                  </p>
                </div>
              </div>
            </div>

            {/* Reorder Success Alert Banner */}
            <AnimatePresence>
              {reorderSuccessToast && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="p-3 bg-emerald-600 text-white rounded-2xl text-xs font-bold flex items-center gap-2 shadow-lg"
                >
                  <Check size={18} />
                  <span>🎉 Sabhi daily essentials Cart me add ho gaye! VIP Free Delivery apply ho chuki hai. Cart khul raha hai...</span>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Master 1-Click Button */}
            <button
              type="button"
              onClick={handleOneClickReorderAll}
              className="w-full py-3 px-4 bg-gradient-to-r from-stone-900 via-amber-950 to-stone-900 hover:from-black hover:to-black text-amber-200 rounded-2xl font-black text-xs shadow-xl shadow-stone-900/15 flex items-center justify-between border border-amber-400/40 cursor-pointer active:scale-[0.98] transition-all"
            >
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-amber-400 text-stone-950">
                  <Zap size={14} className="fill-stone-950" />
                </div>
                <div className="text-left">
                  <p className="font-black text-white text-xs">
                    ⚡ 1-Click Re-Order All Essentials
                  </p>
                  <p className="text-[10px] text-amber-300/80 font-normal">
                    {dailyEssentialItems.length} Essentials • Direct to VIP Free Delivery Cart
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-amber-400 text-stone-950 font-black text-xs">
                <span>Re-Order All</span>
                <ArrowRight size={14} />
              </div>
            </button>

            {/* Horizontal Scroll of Individual Essentials */}
            <div>
              <p className="text-[10px] font-bold text-stone-500 uppercase tracking-wider mb-2 ml-1">
                Frequently Ordered Items ({dailyEssentialItems.length})
              </p>
              <div className="flex gap-2.5 overflow-x-auto no-scrollbar pb-1">
                {dailyEssentialItems.map((item) => {
                  const itemPrice = item.discountPrice || item.price;
                  const isAdded = !!addedItemMap[item.id];
                  return (
                    <div
                      key={item.id}
                      className="w-32 shrink-0 bg-white p-2.5 rounded-2xl border border-amber-200/60 shadow-2xs flex flex-col justify-between"
                    >
                      <div>
                        <div className="w-full h-20 rounded-xl bg-gray-50 overflow-hidden mb-1.5 relative">
                          <img
                            src={item.image}
                            alt={item.name}
                            className="w-full h-full object-cover"
                            referrerPolicy="no-referrer"
                          />
                          {(item as any).orderCount && (item as any).orderCount > 1 ? (
                            <span className="absolute top-1 left-1 bg-amber-400 text-stone-950 text-[8px] font-black px-1.5 py-0.2 rounded-md shadow-xs">
                              {(item as any).orderCount}x
                            </span>
                          ) : (
                            <span className="absolute top-1 left-1 bg-emerald-500 text-white text-[8px] font-black px-1.5 py-0.2 rounded-md shadow-xs">
                              Daily
                            </span>
                          )}
                        </div>
                        <h4 className="font-bold text-xs text-gray-900 line-clamp-1">{item.name}</h4>
                        <p className="text-[10px] text-gray-400 truncate">
                          {item.weight || item.unit || 'Standard'}
                        </p>
                      </div>

                      <div className="mt-2 pt-1.5 border-t border-gray-100 flex items-center justify-between">
                        <div>
                          <span className="text-xs font-black text-gray-900">₹{itemPrice}</span>
                          {item.discountPrice && item.discountPrice < item.price && (
                            <span className="text-[9px] text-gray-400 line-through block">₹{item.price}</span>
                          )}
                        </div>

                        <button
                          type="button"
                          onClick={() => handleReorderSingleItem(item, (item as any).selectedVariant)}
                          className={cn(
                            "px-2 py-1 rounded-xl text-[10px] font-black transition-all cursor-pointer flex items-center gap-0.5",
                            isAdded
                              ? "bg-emerald-600 text-white"
                              : "bg-amber-100 hover:bg-amber-200 text-stone-950 border border-amber-300"
                          )}
                        >
                          {isAdded ? (
                            <>
                              <Check size={10} />
                              <span>Added</span>
                            </>
                          ) : (
                            <>
                              <Plus size={10} />
                              <span>Add</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="px-6 space-y-4">
        <div className="bg-white rounded-3xl p-2 shadow-sm border border-gray-50">
          <ProfileItem 
            icon={Package} 
            label="My Orders" 
            onClick={() => navigate('/my-orders')} 
            badge={unreadCount > 0 ? unreadCount : undefined}
          />

          <ProfileItem 
            icon={Bell} 
            label="Updates & Offers" 
            onClick={() => navigate('/notifications')} 
            badge={unreadNotifCount > 0 ? unreadNotifCount : undefined}
          />
          
          <ProfileItem 
            icon={Heart} 
            label="My Wishlist" 
            onClick={() => navigate('/wishlist')} 
          />
          
          <ProfileItem icon={Settings} label="Edit Profile" onClick={() => setShowEditProfile(true)} />
          
          {appSettings?.supportEnabled && appSettings.supportNumber && (
            <>
              <div className="h-px bg-gray-50 mx-4" />
              <div className="p-4">
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3 ml-2">Need help?</p>
                <div 
                  onClick={() => {
                    const msg = encodeURIComponent(`Hi Lumaro Mart Support, I need help with...`);
                    window.open(`https://wa.me/${appSettings.supportNumber}?text=${msg}`, '_blank');
                  }}
                  className="relative overflow-hidden p-5 bg-gradient-to-br from-green-50 to-white rounded-[32px] border border-green-100 group cursor-pointer active:scale-[0.98] transition-all"
                >
                  <div className="flex items-center gap-4 relative z-10">
                    <div className="p-3 bg-green-500 text-white rounded-2xl shadow-lg shadow-green-500/30 group-hover:rotate-12 transition-transform">
                      <MessageCircle size={24} />
                    </div>
                    <div>
                      <h4 className="font-bold text-[#1A1A1A]">WhatsApp Support</h4>
                      <p className="text-[10px] text-gray-400 font-medium">Quick response for all queries</p>
                    </div>
                    <div className="ml-auto p-2 bg-white rounded-xl text-green-500 shadow-sm border border-green-50 group-hover:translate-x-1 transition-transform">
                      <ChevronRight size={18} />
                    </div>
                  </div>
                  {/* Decorative element */}
                  <div className="absolute -bottom-6 -right-6 w-24 h-24 bg-green-100/40 rounded-full blur-2xl" />
                  <div className="absolute top-0 right-0 p-2 opacity-5">
                    <MessageCircle size={80} />
                  </div>
                </div>
              </div>
            </>
          )}

          {user.role === 'admin' && (
            <>
              <div className="h-px bg-gray-50 mx-4" />
              <ProfileItem icon={ShieldCheck} label="Admin Dashboard" onClick={() => navigate('/admin')} color="text-purple-600" />
            </>
          )}
          <div className="h-px bg-gray-50 mx-4" />
          <ProfileItem icon={LogOut} label="Logout" onClick={onLogout} color="text-red-500" />
        </div>

        {/* Refer & Earn Feature Card */}
        <div className="bg-white rounded-[32px] p-6 shadow-sm border border-gray-50 relative overflow-hidden">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2.5 bg-amber-50 text-amber-500 rounded-2xl">
              <Gift size={24} className="animate-pulse" />
            </div>
            <div>
              <h3 className="font-bold text-gray-900 text-base">Refer & Share 🎁</h3>
              <p className="text-xs text-gray-500 font-medium">Invite friends & family to Lumaro Mart</p>
            </div>
          </div>
          
          <div className="flex items-center gap-2 bg-[#F0F7F4] p-3 rounded-2xl border border-green-50 mb-3">
            <div className="flex-1">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider ml-1 mb-0.5">Your Referral Code</p>
              <p className="font-mono font-black text-xl text-gray-800 tracking-wider ml-1">
                {user.referralCode || 'LUMXXXXXX'}
              </p>
            </div>
            <button
              onClick={() => {
                const code = user.referralCode || 'LUMXXXXXX';
                navigator.clipboard.writeText(code);
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
              }}
              className="px-4 py-2 bg-white hover:bg-gray-50 border border-green-100 rounded-xl flex items-center gap-1.5 text-xs font-bold text-[#62cb9b] active:scale-95 transition-all shadow-sm"
            >
              {copied ? (
                <>
                  <Check size={14} className="text-[#66D2A4]" />
                  <span>Copied!</span>
                </>
              ) : (
                <>
                  <Copy size={14} />
                  <span>Copy</span>
                </>
              )}
            </button>
          </div>
          
          <button
            onClick={() => {
              const code = user.referralCode || 'LUMXXXXXX';
              const downloadUrl = appSettings?.appDownloadLink?.trim() || 'https://drive.google.com/file/d/1cSUiVqrIqBK4C12I4qRhxmON2PtDZgSV/view?usp=drive_link';
              const messageText = 
                `🛒 *Lumaro Mart* - Daily Groceries!\n\n` +
                `अब घर बैठे पाएं रोजाना का किराना सामान, वो भी सबसे बेहतरीन और किफ़ायती दामों पर! 🚀\n\n` +
                `🎁 *Exclusive Referral Offer:*\n` +
                `निचे दिए गए लिंक से हमारा App डाउनलोड करें और साइनअप के समय मेरा रेफरल कोड इस्तेमाल करें:\n\n` +
                `📌 *Referral Code:* *${code}*\n` +
                `🌐 *App Download Link:* ${downloadUrl}\n\n` +
                `👉 अभी अपना पहला ऑर्डर करें और पाएँ *FREE DELIVERY* का स्पेशल ऑफ़र! 🎉`;
              
              window.open(`https://wa.me/?text=${encodeURIComponent(messageText)}`, '_blank');
            }}
            className="w-full py-3.5 bg-[#66D2A4] hover:bg-[#5bc095] text-white rounded-2xl flex items-center justify-center gap-2 text-sm font-bold shadow-md shadow-[#66D2A4]/15 active:scale-[0.98] transition-all"
          >
            <MessageCircle size={18} fill="currentColor" />
            <span>Invite on WhatsApp</span>
          </button>
          
          {/* Subtle background circle decoration */}
          <div className="absolute -bottom-10 -right-10 w-28 h-28 bg-green-50/40 rounded-full pointer-events-none" />
        </div>

        {/* ========================================================================= */}
        {/* SOCIAL MEDIA & COMMUNITY CHANNELS (ADMIN SETTINGS CONTROLLED) */}
        {/* ========================================================================= */}
        <div className="bg-white rounded-[32px] p-6 shadow-sm border border-gray-50 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-emerald-500 via-teal-500 to-cyan-500 text-white flex items-center justify-center shadow-xs">
                <Globe size={20} />
              </div>
              <div>
                <h3 className="font-bold text-gray-900 text-base">Connect With Our Community 🌐</h3>
                <p className="text-xs text-gray-400 font-medium">Daily updates, flash deals & VIP privileges</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-2.5">
            {/* WhatsApp Community / Group */}
            {appSettings?.whatsappCommunityEnabled !== false && (
              <div
                onClick={() => {
                  const targetUrl = appSettings?.whatsappCommunityLink?.trim() || 
                    (appSettings?.whatsappNumber 
                      ? `https://wa.me/${appSettings.whatsappNumber}?text=${encodeURIComponent('Hi Lumaro Mart, I want to join your WhatsApp community!')}` 
                      : 'https://chat.whatsapp.com');
                  window.open(targetUrl, '_blank');
                }}
                className="p-3.5 bg-gradient-to-r from-emerald-50/80 via-white to-white rounded-2xl border border-emerald-100 flex items-center justify-between group hover:border-emerald-300 transition-all cursor-pointer active:scale-[0.98]"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-[#25D366] text-white flex items-center justify-center shadow-sm shadow-[#25D366]/30 group-hover:scale-105 transition-transform">
                    <MessageCircle size={20} />
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <h4 className="text-xs font-black text-gray-900">WhatsApp Community</h4>
                      <span className="text-[9px] bg-emerald-100 text-emerald-800 font-extrabold px-1.5 py-0.2 rounded-full">
                        ACTIVE
                      </span>
                    </div>
                    <p className="text-[10px] text-gray-500 mt-0.5">
                      Daily fresh stock alerts, coupons & group perks
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1 text-emerald-600 font-bold text-xs pl-2 shrink-0">
                  <span>Join</span>
                  <ChevronRight size={16} className="group-hover:translate-x-0.5 transition-transform" />
                </div>
              </div>
            )}

            {/* Telegram Channel / VIP Group */}
            {appSettings?.telegramCommunityEnabled !== false && (
              <div
                onClick={() => {
                  const targetUrl = appSettings?.telegramCommunityLink?.trim() || 'https://t.me/lumaro_mart';
                  window.open(targetUrl, '_blank');
                }}
                className="p-3.5 bg-gradient-to-r from-sky-50/80 via-white to-white rounded-2xl border border-sky-100 flex items-center justify-between group hover:border-sky-300 transition-all cursor-pointer active:scale-[0.98]"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-[#229ED9] text-white flex items-center justify-center shadow-sm shadow-[#229ED9]/30 group-hover:scale-105 transition-transform">
                    <Send size={18} />
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <h4 className="text-xs font-black text-gray-900">Telegram VIP Channel</h4>
                      <span className="text-[9px] bg-sky-100 text-sky-800 font-extrabold px-1.5 py-0.2 rounded-full">
                        OFFERS
                      </span>
                    </div>
                    <p className="text-[10px] text-gray-500 mt-0.5">
                      Instant flash discounts & exclusive VIP updates
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1 text-sky-600 font-bold text-xs pl-2 shrink-0">
                  <span>Join</span>
                  <ChevronRight size={16} className="group-hover:translate-x-0.5 transition-transform" />
                </div>
              </div>
            )}

            {/* Instagram Official Page */}
            {appSettings?.instagramEnabled !== false && (
              <div
                onClick={() => {
                  const targetUrl = appSettings?.instagramLink?.trim() || 'https://instagram.com/lumaro_mart';
                  window.open(targetUrl, '_blank');
                }}
                className="p-3.5 bg-gradient-to-r from-rose-50/80 via-white to-white rounded-2xl border border-rose-100 flex items-center justify-between group hover:border-rose-300 transition-all cursor-pointer active:scale-[0.98]"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-500 via-rose-500 to-purple-600 text-white flex items-center justify-center shadow-sm shadow-rose-500/30 group-hover:scale-105 transition-transform">
                    <Instagram size={20} />
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <h4 className="text-xs font-black text-gray-900">Instagram Community</h4>
                      <span className="text-[9px] bg-rose-100 text-rose-800 font-extrabold px-1.5 py-0.2 rounded-full">
                        FOLLOW
                      </span>
                    </div>
                    <p className="text-[10px] text-gray-500 mt-0.5">
                      Recipe reels, customer stories & giveaways
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1 text-rose-600 font-bold text-xs pl-2 shrink-0">
                  <span>Follow</span>
                  <ChevronRight size={16} className="group-hover:translate-x-0.5 transition-transform" />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Edit Profile Modal */}
      <AnimatePresence>
        {showEditProfile && (
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
                <h2 className="text-2xl font-bold text-[#1A1A1A]">Edit Profile</h2>
                <button onClick={() => setShowEditProfile(false)} className="p-2 bg-gray-100 rounded-full text-gray-500">
                  <X size={20} />
                </button>
              </div>

              <form onSubmit={handleUpdateProfile} className="space-y-6">
                <div className="flex flex-col items-center mb-6">
                  <div className="relative group">
                    <div className="w-24 h-24 rounded-[32px] bg-[#F0F7F4] flex items-center justify-center text-[#66D2A4] overflow-hidden border-4 border-white shadow-sm">
                      {editForm.photoURL ? (
                        <img src={editForm.photoURL} alt="Profile" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                      ) : (
                        <UserIcon size={40} />
                      )}
                    </div>
                    <button 
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="absolute -bottom-2 -right-2 bg-[#66D2A4] text-white p-2 rounded-xl shadow-lg border-2 border-white hover:scale-110 transition-transform"
                    >
                      <Camera size={16} />
                    </button>
                    <input 
                      type="file" 
                      ref={fileInputRef} 
                      onChange={handleImageUpload} 
                      className="hidden" 
                      accept="image/*"
                    />
                  </div>
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mt-4">Profile Photo</p>
                  <p className="text-[9px] text-gray-400 mt-1 font-medium">Auto-optimized • Format: JPG, PNG</p>
                </div>

                <div className="space-y-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider ml-1">Full Name</label>
                    <Input 
                      placeholder="Your Name"
                      value={editForm.displayName}
                      onChange={(e) => setEditForm(prev => ({ ...prev, displayName: e.target.value }))}
                      icon={<UserIcon size={18} />}
                      className="bg-[#F0F7F4] border-none"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider ml-1">Gmail Address</label>
                    <Input 
                      placeholder="Your Email"
                      value={editForm.email}
                      onChange={(e) => setEditForm(prev => ({ ...prev, email: e.target.value }))}
                      icon={<Mail size={18} />}
                      className="bg-[#F0F7F4] border-none"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-gray-700 uppercase tracking-wider ml-1 flex items-center justify-between">
                      <span>10-Digit Mobile Number</span>
                      {editForm.phoneNumber && (
                        <span className={editForm.phoneNumber.length === 10 ? "text-emerald-600 font-bold" : "text-amber-600 font-bold"}>
                          {editForm.phoneNumber.length}/10 digits
                        </span>
                      )}
                    </label>
                    <Input 
                      placeholder="Enter 10-Digit Mobile Number"
                      value={editForm.phoneNumber}
                      onChange={(e) => {
                        const digits = e.target.value.replace(/\D/g, '').slice(0, 10);
                        setEditForm(prev => ({ ...prev, phoneNumber: digits }));
                      }}
                      icon={<Phone size={18} />}
                      className="bg-[#F0F7F4] border-none"
                      maxLength={10}
                      type="tel"
                      inputMode="numeric"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider ml-1">Full Address</label>
                    <Input 
                      placeholder="Your Address"
                      value={editForm.address}
                      onChange={(e) => setEditForm(prev => ({ ...prev, address: e.target.value }))}
                      icon={<Home size={18} />}
                      className="bg-[#F0F7F4] border-none"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider ml-1">Pincode</label>
                    <Input 
                      placeholder="Your Pincode"
                      value={editForm.pincode}
                      onChange={(e) => setEditForm(prev => ({ ...prev, pincode: e.target.value }))}
                      icon={<Hash size={18} />}
                      className="bg-[#F0F7F4] border-none"
                    />
                  </div>
                </div>

                <div className="pt-4">
                  <Button 
                    type="submit" 
                    className="w-full py-4 rounded-2xl flex items-center justify-center gap-2"
                    disabled={isUpdating}
                  >
                    {isUpdating ? <Loader2 className="animate-spin" size={20} /> : 'Save Changes'}
                  </Button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <SubscriptionModal
        isOpen={showSubscriptionModal}
        onClose={() => setShowSubscriptionModal(false)}
        user={user}
        setUser={setUser}
        appSettings={appSettings}
      />
    </div>
  );
};

const ProfileItem = ({ icon: Icon, label, onClick, color = "text-gray-700", badge }: any) => (
  <button 
    onClick={onClick}
    className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors rounded-2xl"
  >
    <div className="flex items-center gap-4">
      <div className={cn("p-2 rounded-xl bg-gray-50", color.replace('text-', 'bg-').replace('500', '50').replace('600', '50'))}>
        <Icon size={20} className={color} />
      </div>
      <span className={cn("font-semibold", color)}>{label}</span>
    </div>
    <div className="flex items-center gap-2">
      {badge && (
        <span className="bg-[#66D2A4] text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
          {badge}
        </span>
      )}
      <ChevronRight size={20} className="text-gray-300" />
    </div>
  </button>
);

function cn(...inputs: any[]) {
  return inputs.filter(Boolean).join(' ');
}
