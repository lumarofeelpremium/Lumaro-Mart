import React from 'react';
import { X, Send, CheckCircle2, PackageCheck, Truck, Check, AlertCircle } from 'lucide-react';
import { Order, User, AppSettings } from '../types';
import { formatOrderStatusWhatsAppText, sendOrderStatusWhatsAppAlert } from '../lib/receipt-utils';
import { motion, AnimatePresence } from 'motion/react';
import { useModalBackHandler } from '../lib/back-button-handler';

interface WhatsAppStatusAlertModalProps {
  order: Order | null;
  newStatus: Order['status'];
  customer?: User | null;
  storeSettings?: AppSettings;
  onClose: () => void;
}

export const WhatsAppStatusAlertModal: React.FC<WhatsAppStatusAlertModalProps> = ({
  order,
  newStatus,
  customer,
  storeSettings,
  onClose,
}) => {
  // Sync with mobile back button
  useModalBackHandler(Boolean(order), onClose, 'whatsapp_status_modal');

  if (!order) return null;

  const rawPhone = order?.userPhone || customer?.phoneNumber || '';
  const customerPhone = String(rawPhone || '').trim();
  const customerName = order?.userName || customer?.displayName || 'Customer';
  const rawId = order?.id ? String(order.id) : '';
  const orderDisplayId = rawId ? rawId.slice(-6).toUpperCase() : 'ORDER';
  const previewText = formatOrderStatusWhatsAppText(order, newStatus, customer, storeSettings);

  const handleSend = () => {
    sendOrderStatusWhatsAppAlert(order, newStatus, customer, storeSettings);
    onClose();
  };

  const getStatusBadge = () => {
    switch (newStatus) {
      case 'confirmed':
        return {
          icon: <CheckCircle2 size={24} className="text-blue-500" />,
          title: 'Order Confirmed',
          desc: 'Customer ko confirmation notification bhejein',
          bg: 'bg-blue-50',
          border: 'border-blue-200',
          btnBg: 'bg-blue-600 hover:bg-blue-700'
        };
      case 'packed':
        return {
          icon: <PackageCheck size={24} className="text-purple-600" />,
          title: 'Order Packed',
          desc: 'Customer ko inform karein ki order pack ho chuka hai',
          bg: 'bg-purple-50',
          border: 'border-purple-200',
          btnBg: 'bg-purple-600 hover:bg-purple-700'
        };
      case 'out_for_delivery':
        return {
          icon: <Truck size={24} className="text-amber-600" />,
          title: 'Out for Delivery',
          desc: 'Customer ko batayein ki delivery partner nikal chuka hai',
          bg: 'bg-amber-50',
          border: 'border-amber-200',
          btnBg: 'bg-amber-600 hover:bg-amber-700'
        };
      case 'delivered':
        return {
          icon: <Check size={24} className="text-emerald-600" />,
          title: 'Order Delivered',
          desc: 'Delivered confirmation & earned loyalty points alert bhejein',
          bg: 'bg-emerald-50',
          border: 'border-emerald-200',
          btnBg: 'bg-emerald-600 hover:bg-emerald-700'
        };
      case 'canceled':
        return {
          icon: <AlertCircle size={24} className="text-red-500" />,
          title: 'Order Canceled',
          desc: 'Customer ko order cancellation ki jankari bhejein',
          bg: 'bg-red-50',
          border: 'border-red-200',
          btnBg: 'bg-red-600 hover:bg-red-700'
        };
      default:
        return {
          icon: <CheckCircle2 size={24} className="text-gray-600" />,
          title: `Status: ${newStatus}`,
          desc: 'Order status update alert bhejein',
          bg: 'bg-gray-50',
          border: 'border-gray-200',
          btnBg: 'bg-gray-800 hover:bg-black'
        };
    }
  };

  const badge = getStatusBadge();

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[220] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          className="bg-white rounded-3xl shadow-2xl max-w-md w-full overflow-hidden border border-gray-100 flex flex-col"
        >
          {/* Header */}
          <div className="p-5 border-b border-gray-100 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`w-11 h-11 rounded-2xl ${badge.bg} border ${badge.border} flex items-center justify-center shrink-0`}>
                {badge.icon}
              </div>
              <div>
                <h3 className="font-extrabold text-base text-gray-900 leading-tight">
                  WhatsApp Alert Bhejein?
                </h3>
                <p className="text-xs text-gray-500 font-medium mt-0.5">
                  Order #{orderDisplayId} • {badge.title}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-gray-100 text-gray-500 hover:bg-gray-200 flex items-center justify-center cursor-pointer transition-colors"
            >
              <X size={16} />
            </button>
          </div>

          {/* Body Content */}
          <div className="p-5 space-y-4">
            {/* Customer Details info strip */}
            <div className="bg-gray-50 rounded-2xl p-3.5 border border-gray-100 flex items-center justify-between text-xs">
              <div>
                <span className="text-gray-400 block text-[10px] font-bold uppercase tracking-wider">Customer Name</span>
                <span className="font-bold text-gray-900 text-sm">{customerName}</span>
              </div>
              <div className="text-right">
                <span className="text-gray-400 block text-[10px] font-bold uppercase tracking-wider">Mobile Number</span>
                <span className="font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-lg">
                  {customerPhone ? (customerPhone.length >= 10 ? `+91 ${customerPhone.slice(-10)}` : customerPhone) : 'Phone not provided'}
                </span>
              </div>
            </div>

            {/* Message Preview Box */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[11px] font-bold uppercase tracking-wider text-gray-500">
                  Pre-filled WhatsApp Message:
                </span>
                <span className="text-[10px] text-gray-400 font-medium">Ready to send</span>
              </div>
              <div className="bg-emerald-50/60 border border-emerald-100 rounded-2xl p-3 max-h-44 overflow-y-auto text-[11px] font-mono whitespace-pre-wrap text-gray-800 leading-relaxed shadow-inner">
                {previewText}
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="p-4 bg-gray-50/80 border-t border-gray-100 flex items-center gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 rounded-2xl bg-white border border-gray-200 text-gray-700 text-xs font-bold hover:bg-gray-100 transition-colors cursor-pointer"
            >
              Skip (Nahi Bhejna)
            </button>
            <button
              type="button"
              onClick={handleSend}
              disabled={!customerPhone}
              className="flex-[1.4] py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-md shadow-emerald-600/25 flex items-center justify-center gap-1.5 transition-all active:scale-95 cursor-pointer disabled:opacity-50"
            >
              <Send size={14} />
              <span>Send WhatsApp Alert</span>
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
