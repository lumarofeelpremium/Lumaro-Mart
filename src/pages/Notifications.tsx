import React, { useState, useEffect } from 'react';
import { ChevronLeft, BellOff, Bell, Package, CheckCircle2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { db } from '../firebase';
import { collection, query, orderBy, onSnapshot, limit } from 'firebase/firestore';
import { Notification } from '../types';
import { motion } from 'motion/react';
import { cacheUtils } from '../lib/cache-utils';
import { isFcmSupported, getFcmPermissionStatus, requestFcmToken } from '../lib/fcm-utils';

export const Notifications = () => {
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [readIds, setReadIds] = useState<string[]>([]);
  const [pushStatus, setPushStatus] = useState<string>('default');
  const [pushLoading, setPushLoading] = useState(false);

  useEffect(() => {
    setPushStatus(getFcmPermissionStatus());
  }, []);

  const handleEnablePush = async () => {
    setPushLoading(true);
    try {
      const token = await requestFcmToken();
      if (token) {
        setPushStatus('granted');
      } else {
        setPushStatus(getFcmPermissionStatus());
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

    if (notif.productId) {
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
        {isFcmSupported() && pushStatus !== 'granted' && (
          <div className="mb-4 bg-emerald-50 border border-emerald-200/80 rounded-2xl p-3.5 flex items-center justify-between gap-3 shadow-xs">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-emerald-500 text-white flex items-center justify-center shrink-0">
                <Bell size={16} />
              </div>
              <div>
                <p className="text-xs font-bold text-emerald-950">Push Notifications Off</p>
                <p className="text-[10px] text-emerald-700">Phone screen par alerts pane ke liye on karein</p>
              </div>
            </div>
            <button
              onClick={handleEnablePush}
              disabled={pushLoading}
              className="bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white text-[11px] font-bold px-3 py-1.5 rounded-xl shadow-xs transition-all disabled:opacity-50"
            >
              {pushLoading ? '...' : 'Turn On'}
            </button>
          </div>
        )}

        {isFcmSupported() && pushStatus === 'granted' && (
          <div className="mb-4 bg-white border border-gray-100 rounded-2xl p-3 flex items-center gap-2 text-emerald-600 shadow-xs">
            <CheckCircle2 size={16} />
            <span className="text-[11px] font-bold">Device Push Notifications Active</span>
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
                    notif.type === 'new_product' ? "bg-green-50 text-green-500" : "bg-blue-50 text-blue-500"
                  )}>
                    {notif.type === 'new_product' ? <Package size={24} /> : <Bell size={24} />}
                  </div>
                  <div className="flex-grow">
                    <div className="flex justify-between items-start mb-1">
                      <h3 className={cn(
                        "text-sm text-[#1A1A1A]",
                        isRead ? "font-medium opacity-70" : "font-bold"
                      )}>{notif.title}</h3>
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
