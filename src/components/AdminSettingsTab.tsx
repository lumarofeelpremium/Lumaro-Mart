import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Settings, CheckCircle, ShoppingBag, Send, Phone, Clock, Bell, Share2, 
  Copy, Key, Sparkles, DollarSign, HelpCircle, QrCode, Crown, Truck, 
  Loader2, Check, ExternalLink, ShieldCheck, Tag, Gift, Smartphone, 
  Megaphone, ArrowRight, Layers
} from 'lucide-react';
import { Button, Input } from './ui/Base';
import { AppSettings, DayDeliveryRule } from '../types';
import { DAYS_OF_WEEK } from '../lib/subscription-utils';
import { requestFcmTokenDetailed, saveFcmToken } from '../lib/fcm-utils';
import { auth } from '../firebase';
import { cn } from '../lib/utils';
import { QRCodeSVG } from 'qrcode.react';

interface AdminSettingsTabProps {
  settings: AppSettings;
  onSave: (s: AppSettings) => Promise<boolean>;
  onTestNotification: () => void;
  onNavigateToSubscriptions?: () => void;
}

export const AdminSettingsTab: React.FC<AdminSettingsTabProps> = ({
  settings,
  onSave,
  onTestNotification,
  onNavigateToSubscriptions
}) => {
  // Navigation Category Filter
  const [selectedCategory, setSelectedCategory] = useState<
    'all' | 'store' | 'delivery' | 'subscription' | 'upi' | 'loyalty' | 'notifications' | 'admob' | 'telegram'
  >('all');

  // Section 1: Store & Timings
  const [supportNumber, setSupportNumber] = useState(settings.supportNumber || '');
  const [supportEnabled, setSupportEnabled] = useState(settings.supportEnabled ?? true);
  const [orderTimingEnabled, setOrderTimingEnabled] = useState(settings.orderTimingEnabled ?? true);
  const [orderTimingStart, setOrderTimingStart] = useState<string>(settings.orderTimingStart || '06:00');
  const [orderTimingEnd, setOrderTimingEnd] = useState<string>(settings.orderTimingEnd || '22:00');
  const [orderTimingClosedMessage, setOrderTimingClosedMessage] = useState<string>(settings.orderTimingClosedMessage || '');

  // Section 2: Delivery Charges & Day-Wise Rules
  const [standardDeliveryFee, setStandardDeliveryFee] = useState<number>(settings.standardDeliveryFee ?? 20);
  const [freeDeliveryMinAmount, setFreeDeliveryMinAmount] = useState<number>(settings.freeDeliveryMinAmount ?? 100);
  const [dayWiseDeliveryEnabled, setDayWiseDeliveryEnabled] = useState<boolean>(settings.dayWiseDeliveryEnabled ?? false);
  const [dayWiseDeliveryRules, setDayWiseDeliveryRules] = useState<Record<string, DayDeliveryRule>>(() => {
    const map: Record<string, DayDeliveryRule> = {};
    DAYS_OF_WEEK.forEach(day => {
      const existing = (settings.dayWiseDeliveryRules as any)?.[day.id] || (settings.dayWiseDeliveryRules as any)?.[day.index];
      map[day.id] = {
        dayIndex: day.index,
        dayName: day.name,
        dayNameHindi: day.hindi,
        enabled: existing?.enabled ?? true,
        standardFee: existing?.standardFee !== undefined ? Number(existing.standardFee) : (settings.standardDeliveryFee ?? 20),
        freeDeliveryMinAmount: existing?.freeDeliveryMinAmount !== undefined ? Number(existing.freeDeliveryMinAmount) : (settings.freeDeliveryMinAmount ?? 100)
      };
    });
    return map;
  });

  // Section 3: VIP Subscription Plan
  const [subscriptionEnabled, setSubscriptionEnabled] = useState<boolean>(settings.subscriptionEnabled ?? true);
  const [subscriptionPlanName, setSubscriptionPlanName] = useState<string>(settings.subscriptionPlanName || 'Lumaro VIP Club');
  const [subscriptionFee, setSubscriptionFee] = useState<number>(settings.subscriptionFee ?? 99);
  const [subscriptionDurationDays, setSubscriptionDurationDays] = useState<number>(settings.subscriptionDurationDays ?? 30);
  const [subscriberDeliveryFee, setSubscriberDeliveryFee] = useState<number>(settings.subscriberDeliveryFee ?? 0);
  const [subscriptionMaxOrders, setSubscriptionMaxOrders] = useState<number>(settings.subscriptionMaxOrders ?? 10);
  const [subscriberMinOrderAmount, setSubscriberMinOrderAmount] = useState<number>(settings.subscriberMinOrderAmount ?? 0);
  const [subscriptionDescription, setSubscriptionDescription] = useState<string>(settings.subscriptionDescription || 'Special delivery discount on your orders for 30 days');

  // Section 4: UPI & Payments
  const [upiEnabled, setUpiEnabled] = useState(settings.upiEnabled ?? true);
  const [upiId, setUpiId] = useState(settings.upiId || 'shiva1520980@okhdfcbank');
  const [upiPayeeName, setUpiPayeeName] = useState(settings.upiPayeeName || 'Lumaro Mart');

  // Section 5: Loyalty Points
  const [loyaltyProgramEnabled, setLoyaltyProgramEnabled] = useState(settings.loyaltyProgramEnabled ?? true);
  const [loyaltySpendBase, setLoyaltySpendBase] = useState(settings.loyaltySpendBase || 100);
  const [loyaltyPointsEarned, setLoyaltyPointsEarned] = useState(
    settings.loyaltyPointsEarned ?? (settings.loyaltyPointsPerHundred ?? 5)
  );
  const [loyaltyPointValue, setLoyaltyPointValue] = useState(settings.loyaltyPointValue ?? 1);

  // Section 6: FCM Web Push
  const [fcmEnabled, setFcmEnabled] = useState(settings.fcmEnabled ?? true);
  const [fcmVapidKey, setFcmVapidKey] = useState(settings.fcmVapidKey || 'BH5pHZc7Wf0ASibIMFNVtrRi-5Waime9pc9RYCnOh4XqHW3xbwAP8yBWofnR2tc3rbqQ4FnMd15liNgznCN5P08');
  const [adminFcmToken, setAdminFcmToken] = useState<string | null>(() => {
    return typeof localStorage !== 'undefined' ? localStorage.getItem('lumaro_fcm_token') : null;
  });
  const [isGeneratingFcmToken, setIsGeneratingFcmToken] = useState(false);
  const [fcmTokenCopied, setFcmTokenCopied] = useState(false);
  const [notifPermission, setNotifPermission] = useState<NotificationPermission>("default");

  // Section 7: WhatsApp
  const [whatsappNumber, setWhatsappNumber] = useState(settings.whatsappNumber || '');
  const [whatsappEnabled, setWhatsappEnabled] = useState(settings.whatsappEnabled ?? true);
  const [autoCustomerWhatsAppAlerts, setAutoCustomerWhatsAppAlerts] = useState(settings.autoCustomerWhatsAppAlerts ?? true);

  // Section 8: Google AdMob
  const [admobEnabled, setAdmobEnabled] = useState(settings.admobEnabled ?? false);
  const [admobTesting, setAdmobTesting] = useState(settings.admobTesting ?? true);
  const [admobAppId, setAdmobAppId] = useState(settings.admobAppId || '');
  const [admobBannerId, setAdmobBannerId] = useState(settings.admobBannerId || '');
  const [admobInterstitialId, setAdmobInterstitialId] = useState(settings.admobInterstitialId || '');
  const [admobRewardedId, setAdmobRewardedId] = useState(settings.admobRewardedId || '');
  const [showPlayStoreGuide, setShowPlayStoreGuide] = useState(false);

  // Section 9: Telegram
  const [telegramEnabled, setTelegramEnabled] = useState(settings.telegramEnabled ?? false);
  const [telegramBotToken, setTelegramBotToken] = useState(settings.telegramBotToken || '');
  const [telegramChatId, setTelegramChatId] = useState(settings.telegramChatId || '');

  // Save & UI States
  const [isSaving, setIsSaving] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  useEffect(() => {
    if ("Notification" in window) {
      setNotifPermission(Notification.permission);
    }
  }, []);

  // Sync state if settings prop changes
  useEffect(() => {
    setSupportNumber(settings.supportNumber || '');
    setSupportEnabled(settings.supportEnabled ?? true);
    setOrderTimingEnabled(settings.orderTimingEnabled ?? true);
    setOrderTimingStart(settings.orderTimingStart || '06:00');
    setOrderTimingEnd(settings.orderTimingEnd || '22:00');
    setOrderTimingClosedMessage(settings.orderTimingClosedMessage || '');

    setStandardDeliveryFee(settings.standardDeliveryFee ?? 20);
    setFreeDeliveryMinAmount(settings.freeDeliveryMinAmount ?? 100);
    setDayWiseDeliveryEnabled(settings.dayWiseDeliveryEnabled ?? false);
    const updatedMap: Record<string, DayDeliveryRule> = {};
    DAYS_OF_WEEK.forEach(day => {
      const existing = (settings.dayWiseDeliveryRules as any)?.[day.id] || (settings.dayWiseDeliveryRules as any)?.[day.index];
      updatedMap[day.id] = {
        dayIndex: day.index,
        dayName: day.name,
        dayNameHindi: day.hindi,
        enabled: existing?.enabled ?? true,
        standardFee: existing?.standardFee !== undefined ? Number(existing.standardFee) : (settings.standardDeliveryFee ?? 20),
        freeDeliveryMinAmount: existing?.freeDeliveryMinAmount !== undefined ? Number(existing.freeDeliveryMinAmount) : (settings.freeDeliveryMinAmount ?? 100)
      };
    });
    setDayWiseDeliveryRules(updatedMap);

    setSubscriptionEnabled(settings.subscriptionEnabled ?? true);
    setSubscriptionPlanName(settings.subscriptionPlanName || 'Lumaro VIP Club');
    setSubscriptionFee(settings.subscriptionFee ?? 99);
    setSubscriptionDurationDays(settings.subscriptionDurationDays ?? 30);
    setSubscriberDeliveryFee(settings.subscriberDeliveryFee ?? 0);
    setSubscriptionMaxOrders(settings.subscriptionMaxOrders ?? 10);
    setSubscriberMinOrderAmount(settings.subscriberMinOrderAmount ?? 0);
    setSubscriptionDescription(settings.subscriptionDescription || '');

    setUpiEnabled(settings.upiEnabled ?? true);
    setUpiId(settings.upiId || 'shiva1520980@okhdfcbank');
    setUpiPayeeName(settings.upiPayeeName || 'Lumaro Mart');

    setLoyaltyProgramEnabled(settings.loyaltyProgramEnabled ?? true);
    setLoyaltySpendBase(settings.loyaltySpendBase || 100);
    setLoyaltyPointsEarned(settings.loyaltyPointsEarned ?? (settings.loyaltyPointsPerHundred ?? 5));
    setLoyaltyPointValue(settings.loyaltyPointValue ?? 1);

    setFcmEnabled(settings.fcmEnabled ?? true);
    setFcmVapidKey(settings.fcmVapidKey || 'BH5pHZc7Wf0ASibIMFNVtrRi-5Waime9pc9RYCnOh4XqHW3xbwAP8yBWofnR2tc3rbqQ4FnMd15liNgznCN5P08');

    setWhatsappNumber(settings.whatsappNumber || '');
    setWhatsappEnabled(settings.whatsappEnabled ?? true);
    setAutoCustomerWhatsAppAlerts(settings.autoCustomerWhatsAppAlerts ?? true);

    setAdmobEnabled(settings.admobEnabled ?? false);
    setAdmobTesting(settings.admobTesting ?? true);
    setAdmobAppId(settings.admobAppId || '');
    setAdmobBannerId(settings.admobBannerId || '');
    setAdmobInterstitialId(settings.admobInterstitialId || '');
    setAdmobRewardedId(settings.admobRewardedId || '');

    setTelegramEnabled(settings.telegramEnabled ?? false);
    setTelegramBotToken(settings.telegramBotToken || '');
    setTelegramChatId(settings.telegramChatId || '');
  }, [settings]);

  const handleGenerateAdminFcmToken = async () => {
    setIsGeneratingFcmToken(true);
    try {
      const activeKey = (fcmVapidKey || 'BH5pHZc7Wf0ASibIMFNVtrRi-5Waime9pc9RYCnOh4XqHW3xbwAP8yBWofnR2tc3rbqQ4FnMd15liNgznCN5P08').trim();
      const result = await requestFcmTokenDetailed(activeKey);
      if (result.token) {
        setAdminFcmToken(result.token);
        if (auth.currentUser?.uid) {
          await saveFcmToken(auth.currentUser.uid, result.token, 'admin');
        }
        setNotifPermission('granted');
        alert('✅ FCM Token generate ho gaya aur is device par connect ho gaya!');
      } else {
        alert(`❌ FCM Connect Nahi Hua: ${result.error || 'Permission issue'}`);
      }
    } catch (e: any) {
      alert('Error: ' + e?.message);
    } finally {
      setIsGeneratingFcmToken(false);
    }
  };

  const handleCopyFcmToken = () => {
    if (!adminFcmToken) return;
    navigator.clipboard.writeText(adminFcmToken);
    setFcmTokenCopied(true);
    setTimeout(() => setFcmTokenCopied(false), 2000);
  };

  const handleSave = async () => {
    setIsSaving(true);
    const validSpendBase = Math.max(1, Number(loyaltySpendBase) || 100);
    const validPointsEarned = Math.max(0, Number(loyaltyPointsEarned) || 0);

    const success = await onSave({
      whatsappNumber: whatsappNumber.trim(),
      whatsappEnabled,
      autoCustomerWhatsAppAlerts,
      supportNumber: supportNumber.trim(),
      supportEnabled,
      // Order Timings
      orderTimingEnabled,
      orderTimingStart: orderTimingStart.trim() || '06:00',
      orderTimingEnd: orderTimingEnd.trim() || '22:00',
      orderTimingClosedMessage: orderTimingClosedMessage.trim(),
      // Delivery charges & Day-wise
      standardDeliveryFee: Math.max(0, Number(standardDeliveryFee) || 0),
      freeDeliveryMinAmount: Math.max(0, Number(freeDeliveryMinAmount) || 0),
      dayWiseDeliveryEnabled,
      dayWiseDeliveryRules,
      // VIP Subscription
      subscriptionEnabled,
      subscriptionPlanName: subscriptionPlanName.trim() || 'Lumaro VIP Club',
      subscriptionFee: Math.max(0, Number(subscriptionFee) || 0),
      subscriptionDurationDays: Math.max(1, Number(subscriptionDurationDays) || 30),
      subscriberDeliveryFee: Math.max(0, Number(subscriberDeliveryFee) || 0),
      subscriptionMaxOrders: Math.max(0, Number(subscriptionMaxOrders) || 0),
      subscriberMinOrderAmount: Math.max(0, Number(subscriberMinOrderAmount) || 0),
      subscriptionDescription: subscriptionDescription.trim(),
      // UPI Payments
      upiEnabled,
      upiId: upiId.trim(),
      upiPayeeName: upiPayeeName.trim(),
      // Loyalty Program
      loyaltyProgramEnabled,
      loyaltySpendBase: validSpendBase,
      loyaltyPointsEarned: validPointsEarned,
      loyaltyPointsPerHundred: validPointsEarned,
      loyaltyPointValue: Number(loyaltyPointValue) || 1,
      // Push Notifications
      fcmEnabled,
      fcmVapidKey: fcmVapidKey.trim(),
      // AdMob
      admobEnabled,
      admobTesting,
      admobAppId: admobAppId.trim(),
      admobBannerId: admobBannerId.trim(),
      admobInterstitialId: admobInterstitialId.trim(),
      admobRewardedId: admobRewardedId.trim(),
      // Telegram
      telegramEnabled,
      telegramBotToken: telegramBotToken.trim(),
      telegramChatId: telegramChatId.trim()
    });

    setIsSaving(false);
    if (success) {
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 3000);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Success Banner */}
      <AnimatePresence>
        {showSuccess && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="p-3.5 bg-emerald-600 text-white rounded-2xl text-xs font-bold flex items-center justify-between shadow-lg"
          >
            <div className="flex items-center gap-2">
              <CheckCircle size={18} />
              <span>Aapki sabhi set kiye hue settings safaltapoorvak save ho gaye hain!</span>
            </div>
            <button onClick={() => setShowSuccess(false)} className="text-white/80 hover:text-white">✕</button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header with Title and Quick Filter Navigation */}
      <div className="bg-white rounded-3xl p-5 border border-gray-100 shadow-sm space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-600 text-white flex items-center justify-center shadow-xs">
              <Settings size={20} />
            </div>
            <div>
              <h2 className="text-base font-black text-gray-900">Admin Control Settings (सेटिंग्स पैनल)</h2>
              <p className="text-xs text-gray-400">Sabhi alag-alag options aur functions ko yahan se manage karein</p>
            </div>
          </div>

          <Button
            onClick={handleSave}
            disabled={isSaving}
            className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-2xl shadow-md flex items-center gap-2 cursor-pointer"
          >
            {isSaving ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
            <span>{isSaving ? 'Saving...' : 'Save All Settings (सेव करें)'}</span>
          </Button>
        </div>

        {/* Category Filter Chips */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pt-2 border-t border-gray-100 pb-1">
          <button
            type="button"
            onClick={() => setSelectedCategory('all')}
            className={cn(
              "px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer border",
              selectedCategory === 'all'
                ? "bg-gray-900 text-white border-gray-900 shadow-xs"
                : "bg-gray-50 text-gray-600 border-gray-200 hover:bg-white"
            )}
          >
            🌟 All Settings (सभी 9 विकल्प)
          </button>
          <button
            type="button"
            onClick={() => setSelectedCategory('store')}
            className={cn(
              "px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer border",
              selectedCategory === 'store'
                ? "bg-blue-600 text-white border-blue-600 shadow-xs"
                : "bg-gray-50 text-gray-600 border-gray-200 hover:bg-white"
            )}
          >
            🏪 1. Store & Timings
          </button>
          <button
            type="button"
            onClick={() => setSelectedCategory('delivery')}
            className={cn(
              "px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer border",
              selectedCategory === 'delivery'
                ? "bg-emerald-600 text-white border-emerald-600 shadow-xs"
                : "bg-gray-50 text-gray-600 border-gray-200 hover:bg-white"
            )}
          >
            🚚 2. Delivery Charges
          </button>
          <button
            type="button"
            onClick={() => setSelectedCategory('subscription')}
            className={cn(
              "px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer border",
              selectedCategory === 'subscription'
                ? "bg-amber-600 text-white border-amber-600 shadow-xs"
                : "bg-gray-50 text-gray-600 border-gray-200 hover:bg-white"
            )}
          >
            👑 3. VIP Subscription
          </button>
          <button
            type="button"
            onClick={() => setSelectedCategory('upi')}
            className={cn(
              "px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer border",
              selectedCategory === 'upi'
                ? "bg-indigo-600 text-white border-indigo-600 shadow-xs"
                : "bg-gray-50 text-gray-600 border-gray-200 hover:bg-white"
            )}
          >
            💳 4. UPI Payments
          </button>
          <button
            type="button"
            onClick={() => setSelectedCategory('loyalty')}
            className={cn(
              "px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer border",
              selectedCategory === 'loyalty'
                ? "bg-purple-600 text-white border-purple-600 shadow-xs"
                : "bg-gray-50 text-gray-600 border-gray-200 hover:bg-white"
            )}
          >
            🎁 5. Loyalty Points
          </button>
          <button
            type="button"
            onClick={() => setSelectedCategory('notifications')}
            className={cn(
              "px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer border",
              selectedCategory === 'notifications'
                ? "bg-rose-600 text-white border-rose-600 shadow-xs"
                : "bg-gray-50 text-gray-600 border-gray-200 hover:bg-white"
            )}
          >
            🔔 6. Push & WhatsApp
          </button>
          <button
            type="button"
            onClick={() => setSelectedCategory('admob')}
            className={cn(
              "px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer border",
              selectedCategory === 'admob'
                ? "bg-orange-600 text-white border-orange-600 shadow-xs"
                : "bg-gray-50 text-gray-600 border-gray-200 hover:bg-white"
            )}
          >
            📢 7. AdMob Ads
          </button>
          <button
            type="button"
            onClick={() => setSelectedCategory('telegram')}
            className={cn(
              "px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer border",
              selectedCategory === 'telegram'
                ? "bg-sky-600 text-white border-sky-600 shadow-xs"
                : "bg-gray-50 text-gray-600 border-gray-200 hover:bg-white"
            )}
          >
            🤖 8. Telegram
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* SECTION 1: STORE PROFILE & ORDER TIMINGS */}
      {/* ========================================================================= */}
      {(selectedCategory === 'all' || selectedCategory === 'store') && (
        <div className="bg-white rounded-3xl p-5 border border-blue-200 shadow-2xs space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-gray-100">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-2xl bg-blue-100 text-blue-700 flex items-center justify-center font-bold">
                <Clock size={20} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-black text-gray-900">1. Store Profile & Order Timings</h3>
                  <span className="bg-blue-100 text-blue-800 text-[9px] font-black px-1.5 py-0.2 rounded uppercase">
                    दुकान व टाइमिंग
                  </span>
                </div>
                <p className="text-[11px] text-gray-500">
                  Dukaan khulne aur band hone ka time aur customer support number set karein
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Support Number */}
            <div className="p-3.5 bg-gray-50 rounded-2xl border border-gray-200 space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-gray-800">Customer Support Phone</label>
                <button
                  type="button"
                  onClick={() => setSupportEnabled(!supportEnabled)}
                  className={cn(
                    "text-[10px] font-bold px-2 py-0.5 rounded cursor-pointer",
                    supportEnabled ? "bg-emerald-100 text-emerald-800" : "bg-gray-200 text-gray-500"
                  )}
                >
                  {supportEnabled ? 'ON' : 'OFF'}
                </button>
              </div>
              <Input
                placeholder="e.g. 7830948738"
                value={supportNumber}
                onChange={(e) => setSupportNumber(e.target.value)}
                className="bg-white text-xs font-bold"
              />
              <p className="text-[10px] text-gray-400">Customer profile me Help/Call button me dikhega</p>
            </div>

            {/* Order Timings Limit Toggle */}
            <div className="p-3.5 bg-gray-50 rounded-2xl border border-gray-200 space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-gray-800">Order Timing Limit</label>
                <button
                  type="button"
                  onClick={() => setOrderTimingEnabled(!orderTimingEnabled)}
                  className={cn(
                    "w-12 h-6 rounded-full transition-all relative cursor-pointer",
                    orderTimingEnabled ? "bg-amber-500" : "bg-gray-300"
                  )}
                >
                  <div className={cn(
                    "absolute top-1 w-4 h-4 bg-white rounded-full transition-all shadow-xs",
                    orderTimingEnabled ? "right-1" : "left-1"
                  )} />
                </button>
              </div>
              <p className="text-[11px] text-gray-500">
                {orderTimingEnabled 
                  ? 'Active: Niyamit samay ke bahar checkout band rahega' 
                  : '24/7 Open: Customer kisi bhi samay order kar sakte hain'}
              </p>
            </div>
          </div>

          {/* If Order Timing is Active, Show Time Inputs */}
          {orderTimingEnabled && (
            <div className="p-4 bg-amber-50/70 rounded-2xl border border-amber-200 space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-bold text-amber-900 uppercase block mb-1">
                    सुबह दुकान खुलने का समय (Opening Time)
                  </label>
                  <input
                    type="time"
                    value={orderTimingStart}
                    onChange={(e) => setOrderTimingStart(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-amber-200 rounded-xl text-xs font-bold outline-none focus:border-amber-500"
                  />
                  <span className="text-[9px] text-amber-700 mt-0.5 block">
                    Subah is samay se orders lena shuru hoga (Default: 06:00 AM)
                  </span>
                </div>

                <div>
                  <label className="text-[10px] font-bold text-amber-900 uppercase block mb-1">
                    रात दुकान बंद होने का समय (Closing Time)
                  </label>
                  <input
                    type="time"
                    value={orderTimingEnd}
                    onChange={(e) => setOrderTimingEnd(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-amber-200 rounded-xl text-xs font-bold outline-none focus:border-amber-500"
                  />
                  <span className="text-[9px] text-amber-700 mt-0.5 block">
                    Raat is samay ke baad ordering band ho jayegi (Default: 22:00 / 10:00 PM)
                  </span>
                </div>
              </div>

              <div>
                <label className="text-[10px] font-bold text-amber-900 uppercase block mb-1">
                  दुकान बंद होने पर कस्टमर अलर्ट मैसेज (Store Closed Alert Message)
                </label>
                <Input
                  placeholder="e.g. Dukaan abhi band hai. Kripya subah 6 AM se raat 10 PM ke beech order karein."
                  value={orderTimingClosedMessage}
                  onChange={(e) => setOrderTimingClosedMessage(e.target.value)}
                  className="bg-white text-xs font-medium"
                />
                <p className="text-[9px] text-amber-700 mt-0.5">
                  Khali chhodne par automatic samay anusar sandesh dikhega.
                </p>
              </div>

              <div className="p-2.5 bg-amber-100 rounded-xl text-xs text-amber-950 font-bold flex items-center gap-2">
                <Clock size={16} className="text-amber-700 shrink-0" />
                <span>
                  🟢 <b>Live Status:</b> Store Timing set hai: <b>{orderTimingStart || '06:00'}</b> se <b>{orderTimingEnd || '22:00'}</b> tak orders liye jayenge.
                </span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* SECTION 2: DELIVERY CHARGES & DAY-WISE RULES */}
      {/* ========================================================================= */}
      {(selectedCategory === 'all' || selectedCategory === 'delivery') && (
        <div className="bg-white rounded-3xl p-5 border border-emerald-200 shadow-2xs space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-gray-100">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
                <Truck size={20} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-black text-gray-900">2. Delivery Charges & Free Delivery Threshold</h3>
                  <span className="bg-emerald-100 text-emerald-800 text-[9px] font-black px-1.5 py-0.2 rounded uppercase">
                    डिलीवरी चार्ज व दिन के नियम
                  </span>
                </div>
                <p className="text-[11px] text-gray-500">
                  Standard delivery charge, free delivery limit, aur hafte ke 7 dino ke alag niyam
                </p>
              </div>
            </div>
          </div>

          {/* Base Rates */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-3.5 bg-gray-50 rounded-2xl border border-gray-200 space-y-1">
              <label className="text-xs font-bold text-gray-800 block">
                Standard Delivery Charge (₹)
              </label>
              <div className="relative">
                <Input
                  type="number"
                  min="0"
                  step="1"
                  value={standardDeliveryFee}
                  onChange={(e) => setStandardDeliveryFee(Math.max(0, parseInt(e.target.value) || 0))}
                  className="bg-white text-xs font-bold"
                />
                <span className="absolute right-3 top-2.5 text-xs text-gray-400 font-bold">₹ per order</span>
              </div>
              <p className="text-[10px] text-gray-400">Order limit se kam hone par yeh charge lagega</p>
            </div>

            <div className="p-3.5 bg-gray-50 rounded-2xl border border-gray-200 space-y-1">
              <label className="text-xs font-bold text-gray-800 block">
                Free Delivery Threshold Amount (₹)
              </label>
              <div className="relative">
                <Input
                  type="number"
                  min="0"
                  step="1"
                  value={freeDeliveryMinAmount}
                  onChange={(e) => setFreeDeliveryMinAmount(Math.max(0, parseInt(e.target.value) || 0))}
                  className="bg-white text-xs font-bold"
                />
                <span className="absolute right-3 top-2.5 text-xs text-gray-400 font-bold">₹ order value</span>
              </div>
              <p className="text-[10px] text-gray-400">Is amount ya isse zyada par delivery FREE (₹0) ho jayegi</p>
            </div>
          </div>

          {/* Day-Wise Toggle */}
          <div className="flex items-center justify-between p-3.5 bg-emerald-50 rounded-2xl border border-emerald-200">
            <div>
              <p className="text-xs font-bold text-emerald-950">दिन के अनुसार अलग डिलीवरी चार्ज व थ्रेशोल्ड (Day-Wise Rules)</p>
              <p className="text-[10px] text-emerald-700">Somvar, Ravivar ityadi ke liye alag delivery charge set karein</p>
            </div>
            <button
              type="button"
              onClick={() => setDayWiseDeliveryEnabled(!dayWiseDeliveryEnabled)}
              className={cn(
                "w-12 h-6 rounded-full transition-all relative cursor-pointer shrink-0",
                dayWiseDeliveryEnabled ? "bg-emerald-600" : "bg-gray-300"
              )}
            >
              <div className={cn(
                "absolute top-1 w-4 h-4 bg-white rounded-full transition-all shadow-xs",
                dayWiseDeliveryEnabled ? "right-1" : "left-1"
              )} />
            </button>
          </div>

          {/* Day-Wise Table */}
          {dayWiseDeliveryEnabled && (
            <div className="space-y-3 pt-1">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <span className="text-xs font-bold text-gray-800">📅 7 Dino Ka Table:</span>
                <button
                  type="button"
                  onClick={() => {
                    const updated: Record<string, DayDeliveryRule> = {};
                    DAYS_OF_WEEK.forEach(day => {
                      updated[day.id] = {
                        dayIndex: day.index,
                        dayName: day.name,
                        dayNameHindi: day.hindi,
                        enabled: true,
                        standardFee: Number(standardDeliveryFee) || 20,
                        freeDeliveryMinAmount: Number(freeDeliveryMinAmount) || 100
                      };
                    });
                    setDayWiseDeliveryRules(updated);
                    alert('✅ Standard values sabhi 7 dino me copy ho gayi!');
                  }}
                  className="px-2.5 py-1 bg-emerald-100 hover:bg-emerald-200 text-emerald-900 rounded-lg text-[10px] font-bold cursor-pointer"
                >
                  Copy Standard Values to All Days
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                {DAYS_OF_WEEK.map(day => {
                  const rule = dayWiseDeliveryRules[day.id] || {
                    dayIndex: day.index,
                    dayName: day.name,
                    dayNameHindi: day.hindi,
                    enabled: true,
                    standardFee: standardDeliveryFee,
                    freeDeliveryMinAmount: freeDeliveryMinAmount
                  };
                  const isToday = new Date().getDay() === day.index;

                  return (
                    <div
                      key={day.id}
                      className={cn(
                        "p-3 rounded-2xl border space-y-2",
                        isToday ? "bg-emerald-50 border-emerald-400 ring-2 ring-emerald-500/20" : "bg-gray-50 border-gray-200"
                      )}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-gray-900">{day.hindi} ({day.name})</span>
                        {isToday && (
                          <span className="bg-emerald-600 text-white text-[9px] font-black px-1.5 py-0.2 rounded-full">
                            🔴 Aaj (Today)
                          </span>
                        )}
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-[9px] font-bold text-gray-500 uppercase block">Fee (₹)</label>
                          <input
                            type="number"
                            min="0"
                            value={rule.standardFee}
                            onChange={(e) => {
                              const val = Math.max(0, parseInt(e.target.value) || 0);
                              setDayWiseDeliveryRules(prev => ({
                                ...prev,
                                [day.id]: { ...(prev[day.id] || rule), standardFee: val }
                              }));
                            }}
                            className="w-full px-2 py-1 text-xs font-bold border border-gray-200 rounded-lg bg-white"
                          />
                        </div>
                        <div>
                          <label className="text-[9px] font-bold text-gray-500 uppercase block">Free Min (₹)</label>
                          <input
                            type="number"
                            min="0"
                            value={rule.freeDeliveryMinAmount}
                            onChange={(e) => {
                              const val = Math.max(0, parseInt(e.target.value) || 0);
                              setDayWiseDeliveryRules(prev => ({
                                ...prev,
                                [day.id]: { ...(prev[day.id] || rule), freeDeliveryMinAmount: val }
                              }));
                            }}
                            className="w-full px-2 py-1 text-xs font-bold border border-gray-200 rounded-lg bg-white"
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* SECTION 3: VIP SUBSCRIPTION PLAN SETTINGS */}
      {/* ========================================================================= */}
      {(selectedCategory === 'all' || selectedCategory === 'subscription') && (
        <div className="bg-white rounded-3xl p-5 border border-amber-200 shadow-2xs space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-gray-100 flex-wrap gap-2">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-2xl bg-amber-100 text-amber-800 flex items-center justify-center font-bold">
                <Crown size={20} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-black text-gray-900">3. VIP Subscription Plan Settings</h3>
                  <span className="bg-amber-100 text-amber-900 text-[9px] font-black px-1.5 py-0.2 rounded uppercase">
                    सब्स्क्रिप्शन प्लान
                  </span>
                </div>
                <p className="text-[11px] text-gray-500">
                  Customer VIP membership fees, validity duration, aur per-order delivery discount
                </p>
              </div>
            </div>

            {onNavigateToSubscriptions && (
              <button
                type="button"
                onClick={onNavigateToSubscriptions}
                className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
              >
                <Crown size={14} />
                <span>Go to VIP Queue & Members (सदस्य सूची)</span>
                <ArrowRight size={14} />
              </button>
            )}
          </div>

          <div className="flex items-center justify-between p-3.5 bg-amber-50/70 rounded-2xl border border-amber-200">
            <div>
              <p className="text-xs font-bold text-amber-950">VIP Subscription Program</p>
              <p className="text-[10px] text-amber-800">Customers can purchase VIP plan from Cart and Profile</p>
            </div>
            <button
              type="button"
              onClick={() => setSubscriptionEnabled(!subscriptionEnabled)}
              className={cn(
                "w-12 h-6 rounded-full transition-all relative cursor-pointer",
                subscriptionEnabled ? "bg-amber-500" : "bg-gray-300"
              )}
            >
              <div className={cn(
                "absolute top-1 w-4 h-4 bg-white rounded-full transition-all shadow-xs",
                subscriptionEnabled ? "right-1" : "left-1"
              )} />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3.5">
            <div className="p-3 bg-gray-50 rounded-2xl border border-gray-200 space-y-1">
              <label className="text-xs font-bold text-gray-700 block">Plan Name</label>
              <Input
                value={subscriptionPlanName}
                onChange={(e) => setSubscriptionPlanName(e.target.value)}
                className="bg-white text-xs font-bold"
              />
              <p className="text-[9px] text-gray-400">e.g. Lumaro VIP Club</p>
            </div>

            <div className="p-3 bg-gray-50 rounded-2xl border border-gray-200 space-y-1">
              <label className="text-xs font-bold text-gray-700 block">Subscription Fee (₹)</label>
              <Input
                type="number"
                min="0"
                value={subscriptionFee}
                onChange={(e) => setSubscriptionFee(Math.max(0, parseInt(e.target.value) || 0))}
                className="bg-white text-xs font-bold"
              />
              <p className="text-[9px] text-gray-400">Customer se li jane wali fees</p>
            </div>

            <div className="p-3 bg-gray-50 rounded-2xl border border-gray-200 space-y-1">
              <label className="text-xs font-bold text-gray-700 block">Validity (Days)</label>
              <Input
                type="number"
                min="1"
                value={subscriptionDurationDays}
                onChange={(e) => setSubscriptionDurationDays(Math.max(1, parseInt(e.target.value) || 1))}
                className="bg-white text-xs font-bold"
              />
              <p className="text-[9px] text-gray-400">e.g. 30 days, 60 days</p>
            </div>

            <div className="p-3 bg-gray-50 rounded-2xl border border-gray-200 space-y-1">
              <label className="text-xs font-bold text-gray-700 block">VIP Delivery Rate (₹)</label>
              <Input
                type="number"
                min="0"
                value={subscriberDeliveryFee}
                onChange={(e) => setSubscriberDeliveryFee(Math.max(0, parseInt(e.target.value) || 0))}
                className="bg-white text-xs font-bold"
              />
              <p className="text-[9px] text-gray-400">0 = 100% Free Delivery per order</p>
            </div>

            <div className="p-3 bg-gray-50 rounded-2xl border border-gray-200 space-y-1">
              <label className="text-xs font-bold text-gray-700 block">Total Covered Orders</label>
              <Input
                type="number"
                min="0"
                value={subscriptionMaxOrders}
                onChange={(e) => setSubscriptionMaxOrders(Math.max(0, parseInt(e.target.value) || 0))}
                className="bg-white text-xs font-bold"
              />
              <p className="text-[9px] text-gray-400">0 = Unlimited orders in plan</p>
            </div>

            <div className="p-3 bg-gray-50 rounded-2xl border border-gray-200 space-y-1">
              <label className="text-xs font-bold text-gray-700 block">Subscriber Min Order (₹)</label>
              <Input
                type="number"
                min="0"
                value={subscriberMinOrderAmount}
                onChange={(e) => setSubscriberMinOrderAmount(Math.max(0, parseInt(e.target.value) || 0))}
                className="bg-white text-xs font-bold"
              />
              <p className="text-[9px] text-gray-400">0 = No minimum order value</p>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SECTION 4: UPI & PAYMENT GATEWAY */}
      {/* ========================================================================= */}
      {(selectedCategory === 'all' || selectedCategory === 'upi') && (
        <div className="bg-white rounded-3xl p-5 border border-indigo-200 shadow-2xs space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-gray-100">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-2xl bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold">
                <QrCode size={20} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-black text-gray-900">4. UPI & QR Code Payments</h3>
                  <span className="bg-indigo-100 text-indigo-800 text-[9px] font-black px-1.5 py-0.2 rounded uppercase">
                    पेमेंट गेटवे
                  </span>
                </div>
                <p className="text-[11px] text-gray-500">Orders aur Subscription dono ke liye direct bank UPI QR code</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-2xl border border-gray-200">
                <span className="text-xs font-bold text-gray-800">UPI Payment Option in Checkout</span>
                <button
                  type="button"
                  onClick={() => setUpiEnabled(!upiEnabled)}
                  className={cn(
                    "text-[10px] font-bold px-2 py-0.5 rounded cursor-pointer",
                    upiEnabled ? "bg-emerald-100 text-emerald-800" : "bg-gray-200 text-gray-500"
                  )}
                >
                  {upiEnabled ? 'Active' : 'Disabled'}
                </button>
              </div>

              <div>
                <label className="text-xs font-bold text-gray-700 block mb-1">Your Store UPI ID (VPA)</label>
                <Input
                  placeholder="e.g. yourname@okhdfcbank"
                  value={upiId}
                  onChange={(e) => setUpiId(e.target.value)}
                  className="bg-white font-mono text-xs font-bold"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-gray-700 block mb-1">Payee Name (Receiver Name)</label>
                <Input
                  placeholder="e.g. Lumaro Mart"
                  value={upiPayeeName}
                  onChange={(e) => setUpiPayeeName(e.target.value)}
                  className="bg-white text-xs font-bold"
                />
              </div>
            </div>

            {/* QR Preview */}
            <div className="p-4 bg-indigo-50/50 rounded-2xl border border-indigo-100 flex flex-col items-center justify-center text-center space-y-2">
              <div className="bg-white p-2.5 rounded-xl border border-indigo-200 shadow-2xs">
                <QRCodeSVG
                  value={`upi://pay?pa=${encodeURIComponent(upiId)}&pn=${encodeURIComponent(upiPayeeName)}&cu=INR`}
                  size={120}
                />
              </div>
              <p className="text-xs font-bold text-indigo-950">{upiPayeeName || 'Store Name'}</p>
              <p className="text-[10px] font-mono text-indigo-700">{upiId}</p>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SECTION 5: LOYALTY PROGRAM */}
      {/* ========================================================================= */}
      {(selectedCategory === 'all' || selectedCategory === 'loyalty') && (
        <div className="bg-white rounded-3xl p-5 border border-purple-200 shadow-2xs space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-gray-100">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-2xl bg-purple-100 text-purple-700 flex items-center justify-center font-bold">
                <Gift size={20} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-black text-gray-900">5. Loyalty Rewards Program</h3>
                  <span className="bg-purple-100 text-purple-800 text-[9px] font-black px-1.5 py-0.2 rounded uppercase">
                    लॉयल्टी प्वाइंट्स
                  </span>
                </div>
                <p className="text-[11px] text-gray-500">Khareedari par points dekar agle order par discount</p>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between p-3.5 bg-purple-50/60 rounded-2xl border border-purple-200">
            <div>
              <p className="text-xs font-bold text-purple-950">Loyalty Program Status</p>
              <p className="text-[10px] text-purple-700">Customers earn points on orders and can redeem for discount</p>
            </div>
            <button
              type="button"
              onClick={() => setLoyaltyProgramEnabled(!loyaltyProgramEnabled)}
              className={cn(
                "w-12 h-6 rounded-full transition-all relative cursor-pointer",
                loyaltyProgramEnabled ? "bg-purple-600" : "bg-gray-300"
              )}
            >
              <div className={cn(
                "absolute top-1 w-4 h-4 bg-white rounded-full transition-all shadow-xs",
                loyaltyProgramEnabled ? "right-1" : "left-1"
              )} />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
            <div className="p-3 bg-gray-50 rounded-2xl border border-gray-200 space-y-1">
              <label className="text-xs font-bold text-gray-700 block">Every Spend Base (₹)</label>
              <Input
                type="number"
                min="1"
                value={loyaltySpendBase}
                onChange={(e) => setLoyaltySpendBase(Math.max(1, parseInt(e.target.value) || 1))}
                className="bg-white text-xs font-bold"
              />
              <p className="text-[9px] text-gray-400">e.g. Har ₹100 kharch karne par</p>
            </div>

            <div className="p-3 bg-gray-50 rounded-2xl border border-gray-200 space-y-1">
              <label className="text-xs font-bold text-gray-700 block">Points Earned</label>
              <Input
                type="number"
                min="0"
                value={loyaltyPointsEarned}
                onChange={(e) => setLoyaltyPointsEarned(Math.max(0, parseInt(e.target.value) || 0))}
                className="bg-white text-xs font-bold"
              />
              <p className="text-[9px] text-gray-400">e.g. 5 Points milenge</p>
            </div>

            <div className="p-3 bg-gray-50 rounded-2xl border border-gray-200 space-y-1">
              <label className="text-xs font-bold text-gray-700 block">1 Point Value (₹)</label>
              <Input
                type="number"
                min="0.1"
                step="0.5"
                value={loyaltyPointValue}
                onChange={(e) => setLoyaltyPointValue(Math.max(0.1, parseFloat(e.target.value) || 1))}
                className="bg-white text-xs font-bold"
              />
              <p className="text-[9px] text-gray-400">e.g. 1 point = ₹1 discount</p>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SECTION 6 & 7: PUSH NOTIFICATIONS & WHATSAPP */}
      {/* ========================================================================= */}
      {(selectedCategory === 'all' || selectedCategory === 'notifications') && (
        <div className="space-y-4">
          {/* FCM Push */}
          <div className="bg-white rounded-3xl p-5 border border-rose-200 shadow-2xs space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-rose-100 text-rose-700 flex items-center justify-center font-bold">
                  <Bell size={20} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-black text-gray-900">6. Firebase Web Push Notifications (FCM)</h3>
                    <span className="bg-rose-100 text-rose-800 text-[9px] font-black px-1.5 py-0.2 rounded uppercase">
                      ब्राउज़र व फोन अलर्ट्स
                    </span>
                  </div>
                  <p className="text-[11px] text-gray-500">Phone status bar me notification alert popups bhejne ke liye</p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setFcmEnabled(!fcmEnabled)}
                className={cn(
                  "w-12 h-6 rounded-full transition-all relative cursor-pointer",
                  fcmEnabled ? "bg-rose-600" : "bg-gray-300"
                )}
              >
                <div className={cn(
                  "absolute top-1 w-4 h-4 bg-white rounded-full transition-all shadow-xs",
                  fcmEnabled ? "right-1" : "left-1"
                )} />
              </button>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-gray-700 block">Firebase Cloud Messaging VAPID Public Key</label>
              <Input
                value={fcmVapidKey}
                onChange={(e) => setFcmVapidKey(e.target.value)}
                placeholder="BH5p..."
                className="bg-white font-mono text-xs"
              />
            </div>

            <div className="flex items-center gap-2 flex-wrap pt-1">
              <Button
                type="button"
                onClick={handleGenerateAdminFcmToken}
                disabled={isGeneratingFcmToken}
                className="py-2 px-3 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl"
              >
                {isGeneratingFcmToken ? <Loader2 size={14} className="animate-spin" /> : <Key size={14} />}
                <span>Connect & Generate Token</span>
              </Button>

              {adminFcmToken && (
                <button
                  type="button"
                  onClick={handleCopyFcmToken}
                  className="py-2 px-3 bg-gray-100 hover:bg-gray-200 text-gray-800 text-xs font-bold rounded-xl flex items-center gap-1.5 cursor-pointer"
                >
                  <Copy size={13} />
                  <span>{fcmTokenCopied ? 'Copied Token!' : 'Copy Device FCM Token'}</span>
                </button>
              )}

              <button
                type="button"
                onClick={onTestNotification}
                className="py-2 px-3 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-xs font-bold rounded-xl border border-emerald-200 cursor-pointer"
              >
                🔊 Test Audio / Popup
              </button>
            </div>
          </div>

          {/* WhatsApp */}
          <div className="bg-white rounded-3xl p-5 border border-emerald-200 shadow-2xs space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
                  <Send size={20} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-black text-gray-900">7. WhatsApp Ordering & Customer Alerts</h3>
                    <span className="bg-emerald-100 text-emerald-800 text-[9px] font-black px-1.5 py-0.2 rounded uppercase">
                      व्हाट्सएप
                    </span>
                  </div>
                  <p className="text-[11px] text-gray-500">Order bill aur status alert customer ko WhatsApp par bhejna</p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              <div className="p-3.5 bg-gray-50 rounded-2xl border border-gray-200 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-gray-800">WhatsApp Order Receiving Number</label>
                  <button
                    type="button"
                    onClick={() => setWhatsappEnabled(!whatsappEnabled)}
                    className={cn(
                      "text-[10px] font-bold px-2 py-0.5 rounded cursor-pointer",
                      whatsappEnabled ? "bg-emerald-100 text-emerald-800" : "bg-gray-200 text-gray-500"
                    )}
                  >
                    {whatsappEnabled ? 'ON' : 'OFF'}
                  </button>
                </div>
                <Input
                  placeholder="e.g. 917830948738"
                  value={whatsappNumber}
                  onChange={(e) => setWhatsappNumber(e.target.value)}
                  className="bg-white text-xs font-bold"
                />
                <p className="text-[10px] text-gray-400">Country code ke sath (e.g. 91)</p>
              </div>

              <div className="p-3.5 bg-gray-50 rounded-2xl border border-gray-200 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-gray-800">Auto Customer Status Alerts</label>
                  <button
                    type="button"
                    onClick={() => setAutoCustomerWhatsAppAlerts(!autoCustomerWhatsAppAlerts)}
                    className={cn(
                      "text-[10px] font-bold px-2 py-0.5 rounded cursor-pointer",
                      autoCustomerWhatsAppAlerts ? "bg-purple-100 text-purple-800" : "bg-gray-200 text-gray-500"
                    )}
                  >
                    {autoCustomerWhatsAppAlerts ? 'ON' : 'OFF'}
                  </button>
                </div>
                <p className="text-[11px] text-gray-500">
                  Order status change karte samay customer ke number par direct alert bhej sakein
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SECTION 8: GOOGLE ADMOB MONETIZATION */}
      {/* ========================================================================= */}
      {(selectedCategory === 'all' || selectedCategory === 'admob') && (
        <div className="bg-white rounded-3xl p-5 border border-orange-200 shadow-2xs space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-gray-100">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-2xl bg-orange-100 text-orange-700 flex items-center justify-center font-bold">
                <DollarSign size={20} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-black text-gray-900">8. Google AdMob & Monetization</h3>
                  <span className="bg-orange-100 text-orange-800 text-[9px] font-black px-1.5 py-0.2 rounded uppercase">
                    ऐडमॉब
                  </span>
                </div>
                <p className="text-[11px] text-gray-500">Android APK / Play Store ke liye banner aur interstitial ads</p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setAdmobEnabled(!admobEnabled)}
              className={cn(
                "w-12 h-6 rounded-full transition-all relative cursor-pointer",
                admobEnabled ? "bg-orange-600" : "bg-gray-300"
              )}
            >
              <div className={cn(
                "absolute top-1 w-4 h-4 bg-white rounded-full transition-all shadow-xs",
                admobEnabled ? "right-1" : "left-1"
              )} />
            </button>
          </div>

          <div className="flex items-center justify-between p-3 bg-orange-50 rounded-2xl border border-orange-200">
            <span className="text-xs font-bold text-orange-950">AdMob Test Mode (Google Test Ads)</span>
            <button
              type="button"
              onClick={() => setAdmobTesting(!admobTesting)}
              className={cn(
                "text-[10px] font-bold px-2 py-0.5 rounded cursor-pointer",
                admobTesting ? "bg-amber-200 text-amber-900" : "bg-emerald-200 text-emerald-900"
              )}
            >
              {admobTesting ? 'Testing Mode ON' : 'Live Production Ads'}
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className="text-[10px] font-bold text-gray-600 uppercase block mb-1">AdMob App ID</label>
              <Input
                value={admobAppId}
                onChange={(e) => setAdmobAppId(e.target.value)}
                placeholder="ca-app-pub-..."
                className="bg-white font-mono text-xs"
              />
            </div>
            <div>
              <label className="text-[10px] font-bold text-gray-600 uppercase block mb-1">Banner Ad Unit ID</label>
              <Input
                value={admobBannerId}
                onChange={(e) => setAdmobBannerId(e.target.value)}
                placeholder="ca-app-pub-.../..."
                className="bg-white font-mono text-xs"
              />
            </div>
            <div>
              <label className="text-[10px] font-bold text-gray-600 uppercase block mb-1">Interstitial Ad Unit ID</label>
              <Input
                value={admobInterstitialId}
                onChange={(e) => setAdmobInterstitialId(e.target.value)}
                placeholder="ca-app-pub-.../..."
                className="bg-white font-mono text-xs"
              />
            </div>
            <div>
              <label className="text-[10px] font-bold text-gray-600 uppercase block mb-1">Rewarded Video Ad Unit ID</label>
              <Input
                value={admobRewardedId}
                onChange={(e) => setAdmobRewardedId(e.target.value)}
                placeholder="ca-app-pub-.../..."
                className="bg-white font-mono text-xs"
              />
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SECTION 9: TELEGRAM ADMIN ALERTS */}
      {/* ========================================================================= */}
      {(selectedCategory === 'all' || selectedCategory === 'telegram') && (
        <div className="bg-white rounded-3xl p-5 border border-sky-200 shadow-2xs space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-gray-100">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-2xl bg-sky-100 text-sky-700 flex items-center justify-center font-bold">
                <Send size={20} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-black text-gray-900">9. Telegram Admin Alerts</h3>
                  <span className="bg-sky-100 text-sky-800 text-[9px] font-black px-1.5 py-0.2 rounded uppercase">
                    टेलीग्राम
                  </span>
                </div>
                <p className="text-[11px] text-gray-500">Naye order aane par admin ko instant Telegram notification</p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setTelegramEnabled(!telegramEnabled)}
              className={cn(
                "w-12 h-6 rounded-full transition-all relative cursor-pointer",
                telegramEnabled ? "bg-sky-600" : "bg-gray-300"
              )}
            >
              <div className={cn(
                "absolute top-1 w-4 h-4 bg-white rounded-full transition-all shadow-xs",
                telegramEnabled ? "right-1" : "left-1"
              )} />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            <div>
              <label className="text-xs font-bold text-gray-700 block mb-1">Telegram Bot Token</label>
              <Input
                placeholder="123456789:ABCdefGhI..."
                value={telegramBotToken}
                onChange={(e) => setTelegramBotToken(e.target.value)}
                className="bg-white font-mono text-xs"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-gray-700 block mb-1">Telegram Chat ID</label>
              <Input
                placeholder="e.g. -100123456789 or 987654321"
                value={telegramChatId}
                onChange={(e) => setTelegramChatId(e.target.value)}
                className="bg-white font-mono text-xs"
              />
            </div>
          </div>
        </div>
      )}

      {/* Save Button at the Bottom */}
      <div className="p-4 bg-white rounded-3xl border border-gray-200 shadow-sm flex items-center justify-between gap-4">
        <div>
          <p className="text-xs font-black text-gray-900">Setting badalne ke baad Save karna na bhoolein:</p>
          <p className="text-[10px] text-gray-400">Sabhi changes instant app me live ho jayenge</p>
        </div>

        <Button
          onClick={handleSave}
          disabled={isSaving}
          className="px-8 py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-2xl shadow-md flex items-center gap-2 cursor-pointer"
        >
          {isSaving ? <Loader2 size={18} className="animate-spin" /> : <Check size={18} />}
          <span>{isSaving ? 'Saving...' : 'Save Settings (सेव करें)'}</span>
        </Button>
      </div>
    </div>
  );
};
