import React, { useState, useEffect } from 'react';
import { 
  ChevronLeft, BellOff, Bell, Package, CheckCircle2, Sparkles, Tag, Zap, 
  Megaphone, AlertCircle, HelpCircle, ShieldCheck, Play, Send 
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { db } from '../firebase';
import { collection, query, orderBy, onSnapshot, limit } from 'firebase/firestore';
import { Notification } from '../types';
import { motion } from 'motion/react';
import { cacheUtils } from '../lib/cache-utils';
import { 
  isFcmSupported, 
  getFcmPermissionStatus, 
  requestBrowserNotificationPermission, 
  requestFcmToken, 
  sendLocalTestNotification, 
  getNotificationDiagnostic 
} from '../lib/fcm-utils';

export const Notifications = () => {
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [readIds, setReadIds] = useState<string[]>([]);
  const [pushStatus, setPushStatus] = useState<string>('default');
  const [pushLoading, setPushLoading] = useState(false);
  const [testSent, setTestSent] = useState(false);
  const [diagnostic, setDiagnostic] = useState(getNotificationDiagnostic());

  useEffect(() => {
    setPushStatus(getFcmPermissionStatus());
    setDiagnostic(getNotificationDiagnostic());
  }, []);

  const handleEnablePush = async () => {
    setPushLoading(true);
    try {
      const perm = await requestBrowserNotificationPermission();
      setPushStatus(perm);
      setDiagnostic(getNotificationDiagnostic());
      if (perm === 'granted') {
        await sendLocalTestNotification(
          'Lumaro Mart Alerts 🔔',
          'Aapke mobile par notifications bilkul sahi chalu ho gaye hain! 🎉'
        );
        setTestSent(true);
        setTimeout(() => setTestSent(false), 4000);
        requestFcmToken().catch(() => {});
      }
    } finally {
      setPushLoading(false);
    }
  };

  const handleTestAlert = async () => {
    setPushLoading(true);
    try {
      const success = await sendLocalTestNotification(
        'Lumaro Mart Live Test 🔔',
        'Badhai ho! Aapke Android phone par alerts bilkul sahi kaam kar rahe hain. 🎉'
      );
      if (success) {
        setTestSent(true);
        setTimeout(() => setTestSent(false), 4000);
      }
    } finally {
      setPushLoading(false);
    }
  };

  const unreadNotifCount = notifications.filter(n => !readIds.includes(n.id)).length;

  // Load cached notifications on mount
  useEffect(() => {
    const cachedNotifs = cacheUtils.getItem('notifications_cache');
    if (cachedNotifs) {
      try {
        setNotifications(JSON.parse(cachedNotifs));
        setLoading(false);
      } catch (e) {
        console.error('Error parsing notifications cache', e);
      }
    }
  }, []);

  useEffect(() => {
    // Load read IDs from localStorage
    const saved = cacheUtils.getItem('read_notifications');
    if (saved) {
      try {
        setReadIds(JSON.parse(saved));
      } catch (e) {
        console.error('Error parsing read notifications', e);
      }
    }

    const q = query(collection(db, 'notifications'), orderBy('createdAt', 'desc'), limit(40));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const notifs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Notification));
      setNotifications(notifs);
      cacheUtils.setItem('notifications_cache', notifs);
      setLoading(false);
    }, (error) => {
      console.error('Snapshot error in notifications', error);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleNotificationClick = (notif: Notification) => {
    // Mark as read
    if (!readIds.includes(notif.id)) {
      const newReadIds = [...readIds, notif.id];
      setReadIds(newReadIds);
      cacheUtils.setItem('read_notifications', newReadIds);
    }

    if (notif.orderId) {
      navigate('/my-orders');
    } else if (notif.productId) {
      navigate(`/product/${notif.productId}`);
    }
  };

  return (
    <div className="min-h-screen bg-[#F8FBF9] pb-24">
      <div className="bg-white px-6 py-6 flex items-center gap-4 border-b border-gray-100 sticky top-0 z-10">
        <button 
          onClick={() => navigate(-1)}
          className="w-10 h-10 bg-[#F0F7F4] rounded-xl flex items-center justify-center text-gray-600"
        >
          <ChevronLeft size={20} />
        </button>
        <h1 className="text-lg font-bold text-[#1A1A1A]">Updates & Offers</h1>
        {notifications.length > 0 && unreadNotifCount > 0 && (
          <button 
            onClick={() => {
              const allIds = notifications.map(n => n.id);
              setReadIds(allIds);
              cacheUtils.setItem('read_notifications', allIds);
            }}
            className="ml-auto text-[10px] font-bold text-[#66D2A4] uppercase tracking-wider"
          >
            Mark all read
          </button>
        )}
      </div>

      <div className="px-6 py-6">
        {/* Device Push Notification Card */}
        {pushStatus === 'granted' ? (
          <div className="mb-5 bg-gradient-to-br from-emerald-50 to-teal-50/60 border border-emerald-200/90 rounded-2xl p-4 shadow-xs space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-emerald-800">
                <div className="w-8 h-8 rounded-xl bg-emerald-500 text-white flex items-center justify-center shrink-0">
                  <CheckCircle2 size={18} />
                </div>
                <div>
                  <h4 className="text-xs font-bold">Device Push Notifications Active</h4>
                  <p className="text-[10px] text-emerald-700">Phone lock screen aur notification tray par alerts milenge</p>
                </div>
              </div>
              <button
                onClick={handleTestAlert}
                disabled={pushLoading}
                className="bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white text-[11px] font-bold px-3 py-1.5 rounded-xl shadow-xs transition-all flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
              >
                <Send size={12} />
                <span>{pushLoading ? 'Sending...' : 'Test Alert'}</span>
              </button>
            </div>
            {testSent && (
              <motion.div 
                initial={{ opacity: 0, y: -4 }} 
                animate={{ opacity: 1, y: 0 }} 
                className="text-[10px] font-bold text-emerald-700 bg-white/80 border border-emerald-200 px-2.5 py-1.5 rounded-lg flex items-center gap-1.5"
              >
                <Sparkles size={12} className="text-amber-500" />
                <span>Test notification bheja gaya! Apne mobile ka notification bar check karein.</span>
              </motion.div>
            )}
          </div>
        ) : pushStatus === 'denied' ? (
          <div className="mb-5 bg-amber-50 border border-amber-200 rounded-2xl p-4 shadow-xs space-y-2">
            <div className="flex items-start gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-amber-500 text-white flex items-center justify-center shrink-0 mt-0.5">
                <AlertCircle size={18} />
              </div>
              <div className="flex-1">
                <h4 className="text-xs font-bold text-amber-950">Android Chrome me Notifications Blocked Hain</h4>
                <p className="text-[11px] text-amber-800 leading-snug mt-0.5">
                  Browser me notification permission band ho gayi hai. Isse unblock karne ke steps:
                </p>
                <div className="mt-2 bg-white/80 p-2.5 rounded-xl border border-amber-200/80 text-[10px] text-amber-900 space-y-1">
                  <p>1. Chrome ke upar URL ke bagal me 🔒 <b>Lock</b> (ya ⚙️ Tune) icon dabayein.</p>
                  <p>2. <b>Permissions (अनुमतियाँ)</b> option par tap karein.</p>
                  <p>3. <b>Notifications</b> ko <b>Allow (चालू)</b> karein.</p>
                  <p>4. Browser page ko <b>Refresh (पुनः लोड)</b> karein.</p>
                </div>
              </div>
            </div>
          </div>
        ) : diagnostic.status === 'unsupported_webview' ? (
          <div className="mb-5 bg-sky-50 border border-sky-200 rounded-2xl p-4 shadow-xs space-y-1.5">
            <div className="flex items-center gap-2.5 text-sky-900">
              <div className="w-8 h-8 rounded-xl bg-sky-500 text-white flex items-center justify-center shrink-0">
                <HelpCircle size={18} />
              </div>
              <div>
                <h4 className="text-xs font-bold">In-App Browser Detected</h4>
                <p className="text-[10px] text-sky-700">WhatsApp ya Instagram ke browser me web notifications support nahi hote.</p>
              </div>
            </div>
            <p className="text-[10px] text-sky-800 bg-white/70 p-2 rounded-xl border border-sky-200">
              👉 Screen ke top-right me <b>3 dots (⋮)</b> par click karke <b>"Open in Chrome" (Chrome me kholein)</b> select karein.
            </p>
          </div>
        ) : (
          <div className="mb-5 bg-emerald-50 border border-emerald-200/80 rounded-2xl p-3.5 flex items-center justify-between gap-3 shadow-xs">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-emerald-500 text-white flex items-center justify-center shrink-0">
                <Bell size={16} />
              </div>
              <div>
                <p className="text-xs font-bold text-emerald-950">Push Notifications Off</p>
                <p className="text-[10px] text-emerald-700">Phone screen par alerts pane ke liye chalu karein</p>
              </div>
            </div>
            <button
              onClick={handleEnablePush}
              disabled={pushLoading}
              className="bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white text-[11px] font-bold px-3 py-1.5 rounded-xl shadow-xs transition-all disabled:opacity-50 cursor-pointer"
            >
              {pushLoading ? '...' : 'Turn On'}
            </button>
          </div>
        )}

        {loading ? (
          <div className="flex justify-center py-20">
            <div className="w-8 h-8 border-4 border-[#66D2A4] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-32 px-12 text-center">
            <div className="w-24 h-24 bg-white rounded-full flex items-center justify-center mb-6 shadow-sm">
              <BellOff size={40} className="text-gray-200" />
            </div>
            <h2 className="text-xl font-bold text-[#1A1A1A] mb-2">No updates yet</h2>
            <p className="text-gray-400 text-sm">
              New products and special offers will appear here.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {notifications.map((notif) => {
              const isRead = readIds.includes(notif.id);
              return (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  key={notif.id}
                  className="bg-white p-4 rounded-3xl shadow-sm border border-gray-50 flex gap-4 cursor-pointer relative overflow-hidden"
                  onClick={() => handleNotificationClick(notif)}
                >
                  {!isRead && (
                    <div className="absolute top-4 right-4 w-2 h-2 bg-red-500 rounded-full shadow-sm shadow-red-200" />
                  )}
                  <div className={cn(
                    "w-12 h-12 rounded-2xl flex items-center justify-center shrink-0",
                    notif.type === 'flash_sale' ? "bg-amber-100 text-amber-600" :
                    notif.type === 'offer' || notif.type === 'discount' ? "bg-rose-100 text-rose-600" :
                    notif.type === 'announcement' ? "bg-purple-100 text-purple-600" :
                    notif.type === 'new_product' ? "bg-emerald-100 text-emerald-600" :
                    "bg-blue-100 text-blue-600"
                  )}>
                    {notif.type === 'flash_sale' ? <Zap size={22} className="animate-pulse" /> :
                     notif.type === 'offer' || notif.type === 'discount' ? <Tag size={22} /> :
                     notif.type === 'announcement' ? <Megaphone size={22} /> :
                     notif.type === 'new_product' ? <Package size={22} /> :
                     <Bell size={22} />}
                  </div>
                  <div className="flex-grow">
                    <div className="flex justify-between items-start mb-1">
                      <div>
                        {notif.type && notif.type !== 'order_update' && (
                          <span className={cn(
                            "text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.2 rounded mb-1 inline-block",
                            notif.type === 'flash_sale' ? "bg-amber-50 text-amber-700" :
                            notif.type === 'offer' || notif.type === 'discount' ? "bg-rose-50 text-rose-700" :
                            notif.type === 'announcement' ? "bg-purple-50 text-purple-700" :
                            "bg-emerald-50 text-emerald-700"
                          )}>
                            {notif.type === 'flash_sale' ? '⚡ Flash Sale' :
                             notif.type === 'offer' ? '🏷️ Special Offer' :
                             notif.type === 'discount' ? '🎁 Discount' :
                             notif.type === 'announcement' ? '📢 Notice' :
                             '📦 New Arrival'}
                          </span>
                        )}
                        <h3 className={cn(
                          "text-sm text-[#1A1A1A]",
                          isRead ? "font-medium opacity-70" : "font-bold"
                        )}>{notif.title}</h3>
                      </div>
                      <span className="text-[10px] text-gray-400">
                        {notif.createdAt?.toDate ? notif.createdAt.toDate().toLocaleDateString() : 'Just now'}
                      </span>
                    </div>
                    <p className={cn(
                      "text-xs leading-relaxed",
                      isRead ? "text-gray-400" : "text-gray-500"
                    )}>
                      {notif.message}
                    </p>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

// Helper for conditional classes if not already imported
const cn = (...classes: any[]) => classes.filter(Boolean).join(' ');
