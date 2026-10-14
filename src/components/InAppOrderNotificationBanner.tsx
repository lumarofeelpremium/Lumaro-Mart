import React, { useEffect, useState } from 'react';
import { CheckCircle2, Package, Truck, PartyPopper, Clock, XCircle, ChevronRight, X, BellRing } from 'lucide-react';

export interface InAppOrderNotificationData {
  orderId: string;
  status: string;
  title: string;
  message: string;
  createdAt?: number;
}

interface InAppOrderNotificationBannerProps {
  notification: InAppOrderNotificationData | null;
  onClose: () => void;
  onNavigateToOrders: (orderId: string) => void;
}

export const InAppOrderNotificationBanner: React.FC<InAppOrderNotificationBannerProps> = ({
  notification,
  onClose,
  onNavigateToOrders
}) => {
  const [progress, setProgress] = useState(100);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (!notification) {
      setIsVisible(false);
      return;
    }

    setIsVisible(true);
    setProgress(100);

    const startTime = Date.now();
    const duration = 9000; // 9 seconds auto-dismiss
    const interval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const remaining = Math.max(0, 100 - (elapsed / duration) * 100);
      setProgress(remaining);
      if (remaining <= 0) {
        clearInterval(interval);
        setIsVisible(false);
        setTimeout(onClose, 300);
      }
    }, 50);

    return () => clearInterval(interval);
  }, [notification?.orderId, notification?.status, notification?.createdAt]);

  if (!notification && !isVisible) return null;

  const rawStatus = (notification?.status || '').toLowerCase().trim();

  // Normalize status and map to rich badge styling
  const config = (() => {
    if (rawStatus === 'confirmed' || rawStatus === 'confirm') {
      return {
        icon: <CheckCircle2 className="w-5 h-5 text-emerald-600 animate-pulse" />,
        badgeBg: 'bg-emerald-500 text-white shadow-xs shadow-emerald-500/30',
        badgeText: 'CONFIRMED ✅',
        statusLabel: 'Order Confirmed',
        barColor: 'bg-emerald-500',
        borderColor: 'border-emerald-500',
        lightBg: 'bg-emerald-50/80',
        ringColor: 'ring-emerald-400'
      };
    } else if (rawStatus === 'packed' || rawStatus === 'packing' || rawStatus === 'processing') {
      return {
        icon: <Package className="w-5 h-5 text-blue-600 animate-bounce" />,
        badgeBg: 'bg-blue-500 text-white shadow-xs shadow-blue-500/30',
        badgeText: 'PACKED 📦',
        statusLabel: 'Order Packed',
        barColor: 'bg-blue-500',
        borderColor: 'border-blue-500',
        lightBg: 'bg-blue-50/80',
        ringColor: 'ring-blue-400'
      };
    } else if (rawStatus === 'out_for_delivery' || rawStatus === 'shipped' || rawStatus === 'dispatched') {
      return {
        icon: <Truck className="w-5 h-5 text-purple-600 animate-pulse" />,
        badgeBg: 'bg-purple-600 text-white shadow-xs shadow-purple-500/30',
        badgeText: 'OUT FOR DELIVERY 🚚',
        statusLabel: 'Out For Delivery',
        barColor: 'bg-purple-600',
        borderColor: 'border-purple-500',
        lightBg: 'bg-purple-50/80',
        ringColor: 'ring-purple-400'
      };
    } else if (rawStatus === 'delivered' || rawStatus === 'completed') {
      return {
        icon: <PartyPopper className="w-5 h-5 text-emerald-600" />,
        badgeBg: 'bg-emerald-600 text-white shadow-xs shadow-emerald-500/30',
        badgeText: 'DELIVERED 🎉',
        statusLabel: 'Order Delivered',
        barColor: 'bg-emerald-600',
        borderColor: 'border-emerald-500',
        lightBg: 'bg-emerald-50/80',
        ringColor: 'ring-emerald-400'
      };
    } else if (rawStatus === 'pending') {
      return {
        icon: <Clock className="w-5 h-5 text-amber-600 animate-pulse" />,
        badgeBg: 'bg-amber-500 text-white shadow-xs shadow-amber-500/30',
        badgeText: 'PENDING ⏳',
        statusLabel: 'Order Pending',
        barColor: 'bg-amber-500',
        borderColor: 'border-amber-500',
        lightBg: 'bg-amber-50/80',
        ringColor: 'ring-amber-400'
      };
    } else if (rawStatus === 'canceled' || rawStatus === 'cancelled' || rawStatus === 'rejected') {
      return {
        icon: <XCircle className="w-5 h-5 text-rose-600" />,
        badgeBg: 'bg-rose-500 text-white shadow-xs shadow-rose-500/30',
        badgeText: 'CANCELED ❌',
        statusLabel: 'Order Canceled',
        barColor: 'bg-rose-500',
        borderColor: 'border-rose-500',
        lightBg: 'bg-rose-50/80',
        ringColor: 'ring-rose-400'
      };
    } else {
      return {
        icon: <BellRing className="w-5 h-5 text-teal-600" />,
        badgeBg: 'bg-teal-500 text-white shadow-xs shadow-teal-500/30',
        badgeText: (rawStatus || 'STATUS UPDATE').toUpperCase(),
        statusLabel: 'Order Status Update',
        barColor: 'bg-teal-500',
        borderColor: 'border-teal-500',
        lightBg: 'bg-teal-50/80',
        ringColor: 'ring-teal-400'
      };
    }
  })();

  const shortId = (notification?.orderId || '').slice(-6).toUpperCase();

  return (
    <div className="fixed top-2 left-2 right-2 sm:left-auto sm:right-4 sm:w-[420px] z-[999999] pointer-events-auto transition-all duration-300 ease-out transform"
      style={{
        transform: isVisible ? 'translateY(0px)' : 'translateY(-120%)',
        opacity: isVisible ? 1 : 0
      }}
    >
      <div className={`bg-white rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.25)] border-2 ${config.borderColor} overflow-hidden backdrop-blur-md ring-4 ${config.ringColor}/20 transition-all`}>
        {/* Top Header Strip with Status Indicator */}
        <div className={`px-3.5 py-2 ${config.lightBg} border-b border-gray-100 flex items-center justify-between gap-2`}>
          <div className="flex items-center gap-2 min-w-0">
            <span className="relative flex h-2.5 w-2.5 shrink-0">
              <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${config.barColor}`} />
              <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${config.barColor}`} />
            </span>
            <span className="text-[11px] font-black tracking-wide uppercase text-gray-800">
              Order Status Update
            </span>
          </div>

          <button
            type="button"
            onClick={() => {
              setIsVisible(false);
              setTimeout(onClose, 250);
            }}
            className="p-1 text-gray-400 hover:text-gray-700 hover:bg-white/80 rounded-lg transition-colors cursor-pointer shrink-0"
            title="Band Karein"
          >
            <X size={15} />
          </button>
        </div>

        <div className="p-3.5 sm:p-4">
          {/* Big Status Badge and Order ID */}
          <div className="flex items-center justify-between gap-2 mb-2.5 flex-wrap">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-gray-50 flex items-center justify-center shrink-0 border border-gray-100 shadow-2xs">
                {config.icon}
              </div>
              <span className={`text-xs font-black px-2.5 py-1 rounded-lg uppercase tracking-wider ${config.badgeBg}`}>
                {config.badgeText}
              </span>
            </div>

            {shortId && (
              <span className="text-xs font-mono font-black text-gray-700 bg-gray-100 px-2.5 py-1 rounded-lg border border-gray-200">
                #{shortId}
              </span>
            )}
          </div>

          {/* Notification Title & Body */}
          <h4 className="text-sm font-black text-gray-900 leading-snug mb-1">
            {notification?.title || config.statusLabel}
          </h4>
          <p className="text-xs text-gray-600 leading-relaxed mb-3 font-medium">
            {notification?.message || `Aapke order ka status ab ${config.statusLabel} hai.`}
          </p>

          {/* Action Button: View Order Status */}
          <button
            type="button"
            onClick={() => {
              if (notification?.orderId) {
                onNavigateToOrders(notification.orderId);
              }
              setIsVisible(false);
              setTimeout(onClose, 200);
            }}
            className="w-full py-2.5 px-3 bg-gray-900 hover:bg-black text-white text-xs font-bold rounded-xl flex items-center justify-between transition-all cursor-pointer shadow-sm active:scale-[0.99]"
          >
            <span className="flex items-center gap-1.5">
              <span>🔍</span>
              <span>Live Order Status Dekhein</span>
            </span>
            <ChevronRight size={15} />
          </button>
        </div>

        {/* Shrinking Progress Timer Bar */}
        <div className="h-1 bg-gray-100 w-full overflow-hidden">
          <div
            className={`h-full ${config.barColor} transition-all duration-75 ease-linear`}
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
    </div>
  );
};

