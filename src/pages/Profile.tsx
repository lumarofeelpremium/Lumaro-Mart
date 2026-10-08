import React, { useState, useEffect, useRef } from 'react';
import { ChevronLeft, User as UserIcon, Settings, LogOut, ShieldCheck, Package, Users, ChevronRight, Clock, MapPin, X, Camera, Mail, Phone, Home, Hash, Loader2, Star, Heart, Bell, MessageCircle, Headset, LifeBuoy, Gift, Copy, Check, Crown } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button, Input } from '../components/ui/Base';
import { User, Order, AppSettings } from '../types';
import { db } from '../firebase';
import { collection, query, where, orderBy, onSnapshot, doc, updateDoc, getDoc, limit } from 'firebase/firestore';
import { motion, AnimatePresence } from 'motion/react';
import { handleFirestoreError, OperationType } from '../lib/firestore-utils';
import { compressImage } from '../lib/utils';
import { cacheUtils } from '../lib/cache-utils';
import { SubscriptionModal } from '../components/SubscriptionModal';
import { isSubscriptionActive, getSubscriptionSummary } from '../lib/subscription-utils';

export const Profile = ({ user, setUser, onLogout }: { user: User | null, setUser: (u: User | null) => void, onLogout: () => void }) => {
  const navigate = useNavigate();
  const [orders, setOrders] = useState<Order[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [unreadNotifCount, setUnreadNotifCount] = useState(0);
  const [showEditProfile, setShowEditProfile] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [appSettings, setAppSettings] = useState<AppSettings | null>(null);
  const [showSubscriptionModal, setShowSubscriptionModal] = useState(false);
  const [copied, setCopied] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
          await updateDoc(doc(db, 'users', user.uid), {
            referralCode: code
          });
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
      const userRef = doc(db, 'users', user.uid);
      await updateDoc(userRef, editForm);
      
      // Update local state in App.tsx
      setUser({
        ...user,
        ...editForm
      });
      
      setShowEditProfile(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${user.uid}`);
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
          <div className="w-20 h-20 rounded-3xl bg-[#66D2A4]/10 flex items-center justify-center text-[#66D2A4] overflow-hidden">
            {user.photoURL ? (
              <img src={user.photoURL} alt={user.displayName} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
            ) : (
              <UserIcon size={40} />
            )}
          </div>
          <div>
            <h2 className="text-2xl font-bold text-[#1A1A1A]">{user.displayName}</h2>
            <p className="text-gray-400 text-sm">{user.email}</p>
            <div className="flex gap-2 mt-1">
              {user.role === 'admin' && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-purple-100 text-purple-600 rounded-full text-[10px] font-bold uppercase tracking-wider">
                  <ShieldCheck size={10} /> Admin
                </span>
              )}
              {user.phoneNumber && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-gray-100 text-gray-500 rounded-full text-[10px] font-bold uppercase tracking-wider">
                  <Phone size={10} /> {user.phoneNumber}
                </span>
              )}
            </div>
          </div>
        </div>

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

        {/* VIP Subscription Card */}
        {appSettings?.subscriptionEnabled !== false && (() => {
          const subSummary = getSubscriptionSummary(user);
          const planName = appSettings?.subscriptionPlanName || 'Lumaro VIP Club';
          const fee = appSettings?.subscriptionFee || 99;
          const duration = appSettings?.subscriptionDurationDays || 30;
          const subDeliveryFee = appSettings?.subscriberDeliveryFee ?? 0;
          const maxOrders = appSettings?.subscriptionMaxOrders || 0;

          if (user?.subscriptionPendingVerification) {
            return (
              <div className="mt-4 p-5 rounded-3xl bg-amber-50 border border-amber-300 text-amber-950 shadow-xs relative overflow-hidden">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2.5">
                    <div className="w-10 h-10 rounded-2xl bg-amber-500 text-white flex items-center justify-center shadow-xs">
                      <Clock size={20} className="text-white animate-pulse" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-black text-amber-950">{user.subscriptionPendingPlanName || planName}</span>
                        <span className="bg-amber-200 text-amber-900 text-[9px] font-black px-1.5 py-0.2 rounded-md">
                          ⏳ VERIFICATION PENDING
                        </span>
                      </div>
                      <p className="text-[10px] text-amber-800 mt-0.5">
                        UTR: <span className="font-mono font-bold">{user.subscriptionPendingUtr}</span> • Admin jald hi verify karega
                      </p>
                    </div>
                  </div>
                </div>
                <div className="bg-white/80 p-2.5 rounded-xl border border-amber-200 text-[10px] text-amber-900 mt-2">
                  Aapka ₹{user.subscriptionPendingFee || fee} ka payment verification under process hai. Admin dwara confirm hote hi VIP perks chalu ho jayenge!
                </div>
              </div>
            );
          }

          if (subSummary.isActive) {
            return (
              <div className="mt-4 p-5 rounded-3xl bg-gradient-to-br from-amber-500 via-amber-600 to-yellow-600 text-white shadow-lg relative overflow-hidden border border-yellow-300/40">
                <div className="flex items-center justify-between mb-3 relative z-10">
                  <div className="flex items-center gap-2.5">
                    <div className="w-10 h-10 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center border border-white/30">
                      <Crown size={22} className="text-yellow-200 fill-yellow-300" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-black tracking-tight">{subSummary.planName}</span>
                        <span className="bg-yellow-300 text-amber-950 text-[9px] font-black px-1.5 py-0.2 rounded-md">
                          ACTIVE VIP
                        </span>
                      </div>
                      <p className="text-[10px] text-yellow-100">
                        Delivery Rate: {subDeliveryFee === 0 ? 'FREE Delivery (₹0)' : `₹${subDeliveryFee} / order`}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowSubscriptionModal(true)}
                    className="px-3 py-1 bg-white/20 hover:bg-white/30 text-white text-[10px] font-bold rounded-xl border border-white/30 transition-colors cursor-pointer"
                  >
                    Extend
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-2.5 relative z-10 pt-2 border-t border-white/20">
                  <div className="bg-black/10 backdrop-blur-sm p-2.5 rounded-xl border border-white/10">
                    <p className="text-[9px] font-bold text-yellow-200 uppercase">Orders Covered</p>
                    <p className="text-sm font-extrabold text-white mt-0.5">
                      {subSummary.isUnlimitedOrders ? 'Unlimited Orders' : `${subSummary.ordersRemaining} Orders Left`}
                    </p>
                  </div>
                  <div className="bg-black/10 backdrop-blur-sm p-2.5 rounded-xl border border-white/10">
                    <p className="text-[9px] font-bold text-yellow-200 uppercase">Valid Till</p>
                    <p className="text-sm font-extrabold text-white mt-0.5 truncate">
                      {subSummary.expiryDateFormatted || `${duration} Days`}
                    </p>
                  </div>
                </div>
              </div>
            );
          }

          return (
            <div className="mt-4 p-5 rounded-3xl bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-200 text-amber-950 shadow-xs relative overflow-hidden">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 rounded-2xl bg-amber-500 text-white flex items-center justify-center shadow-xs">
                    <Crown size={22} className="text-yellow-200 fill-yellow-200" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-black text-amber-950">{planName}</span>
                      <span className="bg-amber-100 text-amber-900 text-[10px] font-extrabold px-1.5 py-0.2 rounded border border-amber-300">
                        ₹{fee} / {duration} Days
                      </span>
                    </div>
                    <p className="text-[10px] text-amber-800 mt-0.5">
                      Enjoy {subDeliveryFee === 0 ? 'FREE Delivery (₹0)' : `₹${subDeliveryFee} Delivery`} on next {maxOrders > 0 ? `${maxOrders} orders` : 'unlimited orders'}!
                    </p>
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowSubscriptionModal(true)}
                className="w-full mt-2 py-2.5 bg-gradient-to-r from-amber-500 to-yellow-600 hover:from-amber-600 hover:to-yellow-700 text-white font-extrabold text-xs rounded-xl shadow-md flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
              >
                <Crown size={14} />
                <span>Join VIP Membership • Only ₹{fee}</span>
              </button>
            </div>
          );
        })()}
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
              const messageText = 
                `🛒 *Lumaro Mart* - Daily Groceries!\n\n` +
                `अब घर बैठे पाएं रोजाना का किराना सामान, वो भी सबसे बेहतरीन और किफ़ायती दामों पर! 🚀\n\n` +
                `🎁 *Exclusive Referral Offer:*\n` +
                `निचे दिए गए लिंक से हमारा App डाउनलोड करें और साइनअप के समय मेरा रेफरल कोड इस्तेमाल करें:\n\n` +
                `📌 *Referral Code:* *${code}*\n` +
                `🌐 *App Download Link:* https://drive.google.com/file/d/1cSUiVqrIqBK4C12I4qRhxmON2PtDZgSV/view?usp=drive_link\n\n` +
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
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider ml-1">Mobile Number</label>
                    <Input 
                      placeholder="Your Phone"
                      value={editForm.phoneNumber}
                      onChange={(e) => setEditForm(prev => ({ ...prev, phoneNumber: e.target.value }))}
                      icon={<Phone size={18} />}
                      className="bg-[#F0F7F4] border-none"
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
