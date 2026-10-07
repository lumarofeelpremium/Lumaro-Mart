import React, { useState, useEffect } from 'react';
import { Bell, X, Check, ShieldCheck, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { isFcmSupported, getFcmPermissionStatus, requestFcmToken, saveFcmToken } from '../lib/fcm-utils';
import { User } from '../types';

interface NotificationPermissionBannerProps {
  user: User | null;
}

export const NotificationPermissionBanner: React.FC<NotificationPermissionBannerProps> = ({ user }) => {
  const [isVisible, setIsVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  useEffect(() => {
    // Check if browser supports Web Push & Notifications
    if (!isFcmSupported()) return;

    // If permission already granted or denied, don't show prompt
    const currentPermission = getFcmPermissionStatus();
    if (currentPermission !== 'default') return;

    // Check if dismissed in this session
    const isDismissed = sessionStorage.getItem('lumaro_notif_dismissed');
    if (isDismissed) return;

    // Delay display slightly so it doesn't block immediate initial render
    const timer = setTimeout(() => {
      setIsVisible(true);
    }, 2500);

    return () => clearTimeout(timer);
  }, [user]);

  const handleEnable = async () => {
    setLoading(true);
    try {
      const token = await requestFcmToken();
      if (token) {
        if (user?.uid) {
          await saveFcmToken(user.uid, token, user.role);
        }
        setStatusMessage('Notifications active ho gaye!');
        setTimeout(() => {
          setIsVisible(false);
        }, 1800);
      } else {
        // User may have denied or closed prompt
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

              {statusMessage ? (
                <div className="mt-2.5 flex items-center gap-1 text-[11px] font-bold text-emerald-600 bg-emerald-50 px-2.5 py-1.5 rounded-lg">
                  <Check size={14} />
                  <span>{statusMessage}</span>
                </div>
              ) : (
                <div className="flex items-center gap-2 mt-3">
                  <button
                    onClick={handleEnable}
                    disabled={loading}
                    className="flex-1 bg-[#66D2A4] hover:bg-[#52be90] active:scale-95 text-white text-xs font-bold py-2 px-3 rounded-xl shadow-sm transition-all flex items-center justify-center gap-1.5 disabled:opacity-60"
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
                    className="px-3 py-2 text-xs font-semibold text-gray-400 hover:text-gray-600 active:scale-95 transition-colors"
                  >
                    Baad Me
                  </button>
                </div>
              )}
            </div>

            <button
              onClick={handleDismiss}
              className="text-gray-400 hover:text-gray-600 p-1 -mr-1 -mt-1 transition-colors"
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
