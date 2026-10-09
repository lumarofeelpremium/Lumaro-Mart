import React, { useState, useEffect } from 'react';
import { Bell, X, Check, ShieldCheck, Sparkles, AlertCircle, HelpCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  getFcmPermissionStatus, 
  requestBrowserNotificationPermission, 
  requestFcmToken, 
  saveFcmToken,
  sendLocalTestNotification,
  getNotificationDiagnostic 
} from '../lib/fcm-utils';
import { User } from '../types';

interface NotificationPermissionBannerProps {
  user: User | null;
}

export const NotificationPermissionBanner: React.FC<NotificationPermissionBannerProps> = ({ user }) => {
  const [isVisible, setIsVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [permissionState, setPermissionState] = useState<NotificationPermission | 'unsupported'>('default');
  const [showAndroidHelp, setShowAndroidHelp] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined' || !('Notification' in window)) return;

    const currentPermission = getFcmPermissionStatus();
    setPermissionState(currentPermission);

    // If permission already granted, no need to show banner
    if (currentPermission === 'granted') return;

    // Check if dismissed in this session
    const isDismissed = sessionStorage.getItem('lumaro_notif_dismissed');
    if (isDismissed) return;

    // Delay display slightly so it doesn't block immediate initial render
    const timer = setTimeout(() => {
      setIsVisible(true);
    }, 2000);

    return () => clearTimeout(timer);
  }, [user]);

  const handleEnable = async () => {
    setLoading(true);
    setStatusMessage(null);
    try {
      // 1. Direct synchronous user gesture to trigger Android Chrome prompt
      const permission = await requestBrowserNotificationPermission();
      setPermissionState(permission);

      if (permission === 'granted') {
        setStatusMessage('Notifications active ho gaye! 🎉');
        
        // Send instant test notification on Android lock screen / notification tray
        try {
          await sendLocalTestNotification(
            'Lumaro Mart Alerts 🔔',
            'Aapke phone par alerts active ho gaye hain! Order updates ab yahi milenge.'
          );
        } catch (_) {}

        // In background, register FCM token
        try {
          const token = await requestFcmToken();
          if (token && user?.uid) {
            await saveFcmToken(user.uid, token, user.role);
          }
        } catch (_) {}

        setTimeout(() => {
          setIsVisible(false);
        }, 2200);
      } else if (permission === 'denied') {
        setStatusMessage('Browser me Notifications Blocked hain.');
        setShowAndroidHelp(true);
      } else {
        // User closed the prompt without choosing
        setIsVisible(false);
        sessionStorage.setItem('lumaro_notif_dismissed', 'true');
      }
    } catch (e) {
      console.warn('Error enabling notifications:', e);
      setIsVisible(false);
    } finally {
      setLoading(false);
    }
  };

  const handleDismiss = () => {
    setIsVisible(false);
    sessionStorage.setItem('lumaro_notif_dismissed', 'true');
  };

  if (!isVisible) return null;

  const isAndroid = typeof navigator !== 'undefined' && /android/i.test(navigator.userAgent);

  return (
    <AnimatePresence>
      <motion.div
        initial={{ y: 80, opacity: 0, scale: 0.95 }}
        animate={{ y: 0, opacity: 1, scale: 1 }}
        exit={{ y: 80, opacity: 0, scale: 0.95 }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        className="fixed bottom-20 left-4 right-4 sm:left-auto sm:right-6 sm:w-96 z-40"
      >
        <div className="bg-white/95 backdrop-blur-md rounded-2xl p-4 shadow-xl border border-[#66D2A4]/30 shadow-emerald-500/10">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#66D2A4] to-[#4EB88A] text-white flex items-center justify-center shrink-0 shadow-sm shadow-[#66D2A4]/20">
              <Bell size={20} className="animate-bounce" />
            </div>

            <div className="flex-1 pr-2">
              <div className="flex items-center gap-1.5 mb-0.5">
                <h4 className="text-xs font-bold text-[#1A1A1A]">Order Alerts & Chhoot Offers</h4>
                <Sparkles size={12} className="text-amber-500 shrink-0" />
              </div>
              <p className="text-[11px] text-gray-500 leading-snug">
                Apne order ka real-time status aur discounts ke instant alerts pane ke liye notifications chalu karein.
              </p>

              {statusMessage && (
                <div className={`mt-2.5 flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1.5 rounded-lg ${
                  permissionState === 'granted' 
                    ? 'text-emerald-700 bg-emerald-50' 
                    : 'text-amber-800 bg-amber-50'
                }`}>
                  {permissionState === 'granted' ? <Check size={14} /> : <AlertCircle size={14} />}
                  <span>{statusMessage}</span>
                </div>
              )}

              {showAndroidHelp && (
                <div className="mt-2.5 p-2 bg-amber-50 border border-amber-200 rounded-xl text-[10px] text-amber-900 space-y-1">
                  <p className="font-bold">📱 Android Chrome me Unblock kaise karein:</p>
                  <ol className="list-decimal list-inside space-y-0.5 text-[10px] text-amber-800">
                    <li>Chrome ke top me URL ke bagal me 🔒 <b>Lock</b> icon par tap karein</li>
                    <li><b>Permissions (अनुमतियाँ)</b> par tap karein</li>
                    <li><b>Notifications</b> ko <b>Allow</b> karein aur page reload karein</li>
                  </ol>
                </div>
              )}

              {!statusMessage && (
                <div className="flex items-center gap-2 mt-3">
                  <button
                    onClick={handleEnable}
                    disabled={loading}
                    className="flex-1 bg-[#66D2A4] hover:bg-[#52be90] active:scale-95 text-white text-xs font-bold py-2 px-3 rounded-xl shadow-sm transition-all flex items-center justify-center gap-1.5 disabled:opacity-60 cursor-pointer"
                  >
                    {loading ? (
                      <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <>
                        <ShieldCheck size={14} />
                        <span>Allow Notifications</span>
                      </>
                    )}
                  </button>

                  <button
                    onClick={handleDismiss}
                    className="px-3 py-2 text-xs font-semibold text-gray-400 hover:text-gray-600 active:scale-95 transition-colors cursor-pointer"
                  >
                    Baad Me
                  </button>
                </div>
              )}
            </div>

            <button
              onClick={handleDismiss}
              className="text-gray-400 hover:text-gray-600 p-1 -mr-1 -mt-1 transition-colors cursor-pointer"
              title="Close"
            >
              <X size={16} />
            </button>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};
